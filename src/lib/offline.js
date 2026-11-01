// Hors-ligne, temps A : copie locale du catalogue et cache des photos.
// - Catalogue : instantané JSON dans AsyncStorage, remplacé à chaque synchronisation réussie.
// - Photos : fichiers dans le dossier « photos » du stockage de l'app (expo-file-system), téléchargés à la demande.
import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Directory, Paths } from 'expo-file-system';
import * as Network from 'expo-network';

const CLE_CATALOGUE = 'maison1822_catalogue_v1';
const CLE_ADMIN = 'maison1822_est_admin_v1';

// ---------- Catalogue ----------

export async function sauverCatalogue(donnees) {
  try {
    await AsyncStorage.setItem(CLE_CATALOGUE, JSON.stringify({ maj: Date.now(), ...donnees }));
    return true;
  } catch (e) {
    return false; // stockage plein ou indisponible : l'app continue sans copie locale
  }
}

export async function lireCatalogue() {
  try {
    const brut = await AsyncStorage.getItem(CLE_CATALOGUE);
    return brut ? JSON.parse(brut) : null;
  } catch (e) {
    return null;
  }
}

// ---------- Rôle admin (pour garder l'onglet Fournisseurs hors réseau) ----------

export async function sauverEstAdmin(valeur) {
  try { await AsyncStorage.setItem(CLE_ADMIN, valeur ? '1' : '0'); } catch (e) { /* silencieux */ }
}

export async function lireEstAdmin() {
  try { return (await AsyncStorage.getItem(CLE_ADMIN)) === '1'; } catch (e) { return false; }
}

// ---------- Réseau ----------

export async function estEnLigne() {
  try {
    const etat = await Network.getNetworkStateAsync();
    return !!etat.isConnected && etat.isInternetReachable !== false;
  } catch (e) {
    return true; // dans le doute, on tente la requête
  }
}

export function surChangementReseau(rappel) {
  const abonnement = Network.addNetworkStateListener((etat) => {
    rappel(!!etat.isConnected && etat.isInternetReachable !== false);
  });
  return () => abonnement.remove();
}

// ---------- Photos ----------

let dossierPhotos = null;
function dossier() {
  if (!dossierPhotos) {
    dossierPhotos = new Directory(Paths.document, 'photos');
    try { dossierPhotos.create({ intermediates: true, idempotent: true }); } catch (e) { /* déjà créé */ }
  }
  return dossierPhotos;
}

function nomFichier(url) {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) >>> 0;
  return `${h.toString(16)}_${url.length}.img`;
}

function fichierPour(url) {
  return new File(dossier(), nomFichier(url));
}

// Adresse locale si la photo est déjà en cache, sinon null
export function uriLocale(url) {
  if (!url) return null;
  try {
    const f = fichierPour(url);
    return f.exists ? f.uri : null;
  } catch (e) {
    return null;
  }
}

const enCours = new Map(); // url -> promesse, évite les téléchargements en double

export function telechargerPhoto(url) {
  if (!url) return Promise.resolve(null);
  const deja = uriLocale(url);
  if (deja) return Promise.resolve(deja);
  if (enCours.has(url)) return enCours.get(url);
  const p = (async () => {
    try {
      const f = fichierPour(url);
      const sortie = await File.downloadFileAsync(url, f, { idempotent: true });
      return sortie.uri;
    } catch (e) {
      return null; // l'image distante reste utilisée
    } finally {
      enCours.delete(url);
    }
  })();
  enCours.set(url, p);
  return p;
}

// Précharge toutes les photos (3 en parallèle), seulement en Wi-Fi ou câble
export async function prechargerPhotos(urls) {
  try {
    const etat = await Network.getNetworkStateAsync();
    const type = etat.type;
    if (type !== Network.NetworkStateType.WIFI && type !== Network.NetworkStateType.ETHERNET) return;
  } catch (e) {
    return;
  }
  const a_faire = [...new Set(urls.filter(Boolean))].filter((u) => !uriLocale(u));
  let i = 0;
  async function ouvrier() {
    while (i < a_faire.length) {
      const url = a_faire[i++];
      await telechargerPhoto(url);
    }
  }
  await Promise.all([ouvrier(), ouvrier(), ouvrier()]);
}

// Image qui utilise la copie locale quand elle existe, et la télécharge en arrière-plan sinon
export function ImageLocale({ url, style, resizeMode }) {
  const [uri, setUri] = useState(() => uriLocale(url) || url);
  useEffect(() => {
    let annule = false;
    const local = uriLocale(url);
    setUri(local || url);
    if (url && !local) {
      telechargerPhoto(url).then((u) => { if (!annule && u) setUri(u); });
    }
    return () => { annule = true; };
  }, [url]);
  if (!url) return null;
  return <Image source={{ uri }} style={style} resizeMode={resizeMode} />;
}

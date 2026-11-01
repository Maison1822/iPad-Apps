// Hors ligne, temps B : file d'attente d'envoi.
// Une écriture faite sans réseau (note de visite, devis) est gardée sur l'appareil, puis envoyée dès le retour du réseau.
// Chaque élément est rejoué avec un « upsert » sur une clé fixe (id ou numéro) : un rejeu ne crée jamais de doublon.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const CLE = 'maison1822_outbox_v1';
let enCoursDeVidage = false;
const ecouteurs = new Set();

// uuid v4 généré sur l'appareil (clé stable pour rejouer une écriture sans doublon)
export function nouvelUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function lire() {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    return brut ? JSON.parse(brut) : [];
  } catch (e) {
    return [];
  }
}

async function ecrire(liste) {
  try {
    await AsyncStorage.setItem(CLE, JSON.stringify(liste));
  } catch (e) { /* stockage indisponible : la file reste en mémoire pour cette session seulement */ }
  const n = liste.filter((x) => !x.erreur).length;
  ecouteurs.forEach((cb) => { try { cb(n); } catch (e) { /* silencieux */ } });
}

export async function nombreEnAttente() {
  return (await lire()).filter((x) => !x.erreur).length;
}

export function surNombreEnAttente(rappel) {
  ecouteurs.add(rappel);
  nombreEnAttente().then(rappel);
  return () => ecouteurs.delete(rappel);
}

// Une erreur réseau n'a pas de code d'erreur base de données ; une erreur de droits ou de données en a un.
export function estErreurReseau(error) {
  if (!error) return false;
  // Session expirée : temporaire, l'élément reste en file et sera rejoué après reconnexion
  if (String(error.code || '').startsWith('PGRST30') || /jwt/i.test(String(error.message || ''))) return true;
  if (error.code) return false;
  const m = String(error.message || error).toLowerCase();
  return m.includes('network') || m.includes('fetch') || m.includes('timeout') || m.includes('connection') || m.includes('offline');
}

async function envoyer(element) {
  const { error } = await supabase.from(element.table).upsert(element.payload, { onConflict: element.onConflict });
  return error;
}

// Envoie tout de suite ; si le réseau manque, met en file d'attente.
// Retourne { statut: 'envoye' | 'en_attente' | 'erreur', error }.
export async function envoyerOuMettreEnFile({ table, payload, onConflict, libelle }) {
  const element = { cle: nouvelUuid(), table, payload, onConflict, libelle: libelle || table, cree: Date.now() };
  const error = await envoyer(element);
  if (!error) return { statut: 'envoye' };
  if (estErreurReseau(error)) {
    const liste = await lire();
    liste.push(element);
    await ecrire(liste);
    return { statut: 'en_attente' };
  }
  return { statut: 'erreur', error };
}

// Rejoue la file dans l'ordre. S'arrête au premier échec réseau. Un refus de la base (droits, données) est mis de côté
// avec son message, pour ne pas bloquer les éléments suivants ni être rejoué indéfiniment.
export async function viderFile() {
  if (enCoursDeVidage) return { envoyes: 0 };
  enCoursDeVidage = true;
  let envoyes = 0;
  try {
    // Sans session active, les droits refuseraient tout : on attend la reconnexion
    const { data } = await supabase.auth.getSession();
    if (!data?.session) return { envoyes: 0 };
    let liste = await lire();
    const restants = [];
    let reseauCoupe = false;
    for (const element of liste) {
      if (element.erreur || reseauCoupe) { restants.push(element); continue; }
      const error = await envoyer(element);
      if (!error) { envoyes++; continue; }
      if (estErreurReseau(error)) { reseauCoupe = true; restants.push(element); continue; }
      restants.push({ ...element, erreur: String(error.message || error) });
    }
    await ecrire(restants);
  } finally {
    enCoursDeVidage = false;
  }
  return { envoyes };
}

export async function elementsEnErreur() {
  return (await lire()).filter((x) => x.erreur);
}

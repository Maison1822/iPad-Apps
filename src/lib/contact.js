// Boutons d'action (appeler, WhatsApp, e-mail) réutilisés dans les fiches prospects, fournisseurs et clients.
// WhatsApp : lien direct wa.me, message vide. L'appli qui s'ouvre (WhatsApp ou WhatsApp Business) est celle choisie par iOS.
import React from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';

const GOLD = '#C8A45A', WHITE = '#FFFFFF', CARD = '#2C2C2E', BORDER = '#3A3A3C';

// 'France', 'FR', 'Brésil', 'Brasil', 'BR'... -> 'FR' | 'BR' | null
export function codePays(pays) {
  const p = String(pays || '').trim().toLowerCase();
  if (p.startsWith('fr')) return 'FR';
  if (p.startsWith('br')) return 'BR';
  return null;
}

// Numéro au format international sans « + » (attendu par wa.me). Retourne null si inutilisable.
export function numeroInternational(tel, pays) {
  if (!tel) return null;
  const brut = String(tel).trim();
  let chiffres = brut.replace(/\D/g, '');
  if (chiffres.length < 6) return null;
  if (brut.startsWith('+')) return chiffres;
  if (chiffres.startsWith('00')) return chiffres.slice(2);
  const code = codePays(pays);
  if (code === 'FR') {
    if (chiffres.startsWith('33') && chiffres.length >= 11) return chiffres;
    if (chiffres.startsWith('0') && chiffres.length === 10) return '33' + chiffres.slice(1);
  }
  if (code === 'BR') {
    if (chiffres.startsWith('55') && chiffres.length >= 12) return chiffres;
    if (chiffres.startsWith('0')) chiffres = chiffres.replace(/^0+/, '');
    if (chiffres.length === 10 || chiffres.length === 11) return '55' + chiffres;
  }
  return chiffres;
}

async function ouvrir(url, messageErreur) {
  try {
    await Linking.openURL(url);
  } catch (e) {
    Alert.alert('Impossible d\'ouvrir', messageErreur);
  }
}

export function appeler(tel) {
  const num = String(tel || '').trim().replace(/[^\d+]/g, '');
  if (!num) return;
  ouvrir(`tel:${num}`, 'Cet appareil ne peut pas passer d\'appel.');
}

export function ouvrirWhatsApp(tel, pays) {
  const num = numeroInternational(tel, pays);
  if (!num) {
    Alert.alert('WhatsApp', 'Numéro invalide ou incomplet.');
    return;
  }
  ouvrir(`https://wa.me/${num}`, 'WhatsApp n\'est pas disponible sur cet appareil.');
}

export function ecrireEmail(email) {
  const adresse = String(email || '').trim();
  if (!adresse) return;
  ouvrir(`mailto:${adresse}`, 'Aucune application de messagerie disponible.');
}

const vide = (v) => v == null || String(v).trim() === '';

// Rangée de boutons : n'affiche que les actions possibles.
// telephone : appel ; whatsapp : numéro WhatsApp (à défaut, le téléphone) ; email : adresse ; pays : aide à compléter l'indicatif.
export function BoutonsContact({ telephone, whatsapp, email, pays }) {
  const numWhatsApp = !vide(whatsapp) ? whatsapp : telephone;
  const boutons = [];
  if (!vide(telephone)) boutons.push({ cle: 'tel', label: '📞 Appeler', action: () => appeler(telephone) });
  if (!vide(numWhatsApp)) boutons.push({ cle: 'wa', label: '💬 WhatsApp', action: () => ouvrirWhatsApp(numWhatsApp, pays) });
  if (!vide(email)) boutons.push({ cle: 'mail', label: '✉️ E-mail', action: () => ecrireEmail(email) });
  if (boutons.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
      {boutons.map((b) => (
        <TouchableOpacity key={b.cle} onPress={b.action} activeOpacity={0.7}
          style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: GOLD, backgroundColor: CARD }}>
          <Text style={{ color: WHITE, fontSize: 13, fontWeight: '600' }}>{b.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

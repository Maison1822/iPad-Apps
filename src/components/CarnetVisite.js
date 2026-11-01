// Carnet de visite : notes datées rattachées à un prospect, un client ou un fournisseur (table « Notes de Visite »).
// Chaque utilisateur ne voit que ses propres notes, l'admin voit tout (règles d'accès côté base).
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { envoyerOuMettreEnFile, nouvelUuid } from '../lib/outbox';

const GOLD = '#C8A45A', WHITE = '#FFFFFF', MUTED = '#8E8E93', BORDER = '#3A3A3C', CARD = '#2C2C2E', NAVY = '#0F1E3C';
const COLONNE = { prospect: 'prospect_id', client: 'client_id', fournisseur: 'fournisseur_id' };
const REGEX_DATE = /^\d{4}-\d{2}-\d{2}$/;

function aujourdhui() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const [a, m, j] = String(iso).split('-');
  return `${j}/${m}/${a}`;
}

const formVide = () => ({ date_visite: aujourdhui(), resume: '', prochaine_action: '', date_relance: '' });

// type : 'prospect' | 'client' | 'fournisseur' ; id : identifiant de la fiche
export default function CarnetVisite({ type, id }) {
  const colonne = COLONNE[type];
  const [notes, setNotes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [form, setForm] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      const { data, error } = await supabase.from('Notes de Visite').select('*')
        .eq(colonne, id).order('date_visite', { ascending: false }).order('cree_le', { ascending: false });
      if (annule) return;
      if (error) Alert.alert('Carnet de visite', error.message);
      setNotes(data || []);
      setChargement(false);
    })();
    return () => { annule = true; };
  }, [colonne, id]);

  async function enregistrer() {
    const resume = (form.resume || '').trim();
    if (!resume) { Alert.alert('Carnet de visite', 'Le résumé est obligatoire.'); return; }
    if (!REGEX_DATE.test(form.date_visite)) { Alert.alert('Date de visite', 'Format attendu : AAAA-MM-JJ'); return; }
    if (form.date_relance && !REGEX_DATE.test(form.date_relance)) { Alert.alert('Date de relance', 'Format attendu : AAAA-MM-JJ'); return; }
    setEnregistrement(true);
    // L'identifiant est créé ici : si le réseau manque, la note est gardée sur l'appareil puis envoyée plus tard sans doublon.
    const payload = {
      id: nouvelUuid(),
      [colonne]: id,
      date_visite: form.date_visite,
      resume,
      prochaine_action: (form.prochaine_action || '').trim() || null,
      date_relance: form.date_relance || null,
    };
    const resultat = await envoyerOuMettreEnFile({ table: 'Notes de Visite', payload, onConflict: 'id', libelle: 'Note de visite' });
    setEnregistrement(false);
    if (resultat.statut === 'erreur') { Alert.alert('Erreur', resultat.error?.message || 'Enregistrement refusé (droits insuffisants).'); return; }
    const attente = resultat.statut === 'en_attente';
    setNotes((prev) => [{ ...payload, fait: false, enAttente: attente }, ...prev]);
    setForm(null);
    if (attente) Alert.alert('Hors ligne', "La note est enregistrée sur l'appareil. Elle sera envoyée dès le retour du réseau.");
  }

  async function basculerFait(note) {
    const nouveau = !note.fait;
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, fait: nouveau } : n)));
    const { error } = await supabase.from('Notes de Visite').update({ fait: nouveau, maj: new Date().toISOString() }).eq('id', note.id);
    if (error) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, fait: note.fait } : n)));
      Alert.alert('Erreur', error.message);
    }
  }

  const champ = (cle) => (t) => setForm((f) => ({ ...f, [cle]: t }));
  const styleInput = { backgroundColor: CARD, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: WHITE, borderWidth: 1, borderColor: BORDER };
  const styleLabel = { color: MUTED, fontSize: 12, marginBottom: 4 };

  return (
    <View>
      <Text style={{ color: GOLD, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Carnet de visite</Text>

      {chargement && <ActivityIndicator color={GOLD} style={{ marginVertical: 8 }} />}
      {!chargement && notes.length === 0 && !form && <Text style={{ color: MUTED, fontSize: 13, marginBottom: 8 }}>Aucune note.</Text>}

      {notes.map((n) => (
        <View key={n.id} style={{ backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 14, marginBottom: 10, opacity: n.fait ? 0.6 : 1 }}>
          <Text style={{ color: GOLD, fontSize: 12, fontWeight: '700' }}>{formatDate(n.date_visite)}{n.enAttente ? "  ·  ⏳ en attente d'envoi" : ''}</Text>
          <Text style={{ color: WHITE, fontSize: 14, marginTop: 4, lineHeight: 20 }}>{n.resume}</Text>
          {!!n.prochaine_action && <Text style={{ color: WHITE, fontSize: 13, marginTop: 6 }}>➜ {n.prochaine_action}</Text>}
          {(!!n.date_relance || !!n.prochaine_action) && !n.enAttente && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: MUTED, fontSize: 12 }}>{n.date_relance ? `Relance le ${formatDate(n.date_relance)}` : ''}</Text>
              <TouchableOpacity onPress={() => basculerFait(n)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: n.fait ? MUTED : GOLD, fontSize: 13, fontWeight: '600' }}>{n.fait ? '✓ Fait (annuler)' : 'Marquer fait'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      {form ? (
        <View style={{ backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: GOLD, padding: 14 }}>
          <Text style={styleLabel}>Date de visite (AAAA-MM-JJ)</Text>
          <TextInput style={styleInput} value={form.date_visite} onChangeText={champ('date_visite')} autoCapitalize="none" autoCorrect={false} placeholderTextColor={MUTED} />
          <Text style={[styleLabel, { marginTop: 12 }]}>Résumé *</Text>
          <TextInput style={[styleInput, { minHeight: 90, textAlignVertical: 'top' }]} multiline value={form.resume} onChangeText={champ('resume')} placeholderTextColor={MUTED} />
          <Text style={[styleLabel, { marginTop: 12 }]}>Prochaine action</Text>
          <TextInput style={styleInput} value={form.prochaine_action} onChangeText={champ('prochaine_action')} placeholderTextColor={MUTED} />
          <Text style={[styleLabel, { marginTop: 12 }]}>Date de relance (AAAA-MM-JJ, facultatif)</Text>
          <TextInput style={styleInput} value={form.date_relance} onChangeText={champ('date_relance')} autoCapitalize="none" autoCorrect={false} placeholder="2026-11-15" placeholderTextColor={MUTED} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity style={{ flex: 1, borderRadius: 8, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: BORDER }} onPress={() => setForm(null)} disabled={enregistrement}>
              <Text style={{ color: WHITE, fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, backgroundColor: GOLD, borderRadius: 8, paddingVertical: 14, alignItems: 'center', opacity: enregistrement ? 0.5 : 1 }} onPress={enregistrer} disabled={enregistrement}>
              {enregistrement ? <ActivityIndicator color={NAVY} /> : <Text style={{ color: NAVY, fontWeight: '700', fontSize: 15 }}>Enregistrer la note</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={{ borderRadius: 8, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: BORDER, backgroundColor: CARD }} onPress={() => setForm(formVide())}>
          <Text style={{ color: GOLD, fontWeight: '700' }}>+ Ajouter une note de visite</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

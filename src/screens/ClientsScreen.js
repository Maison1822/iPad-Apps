import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Modal, ScrollView, Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { COLORS, SPACING, RADIUS } from '../lib/theme';
import { useApp } from '../lib/AppContext';
import { BoutonsContact } from '../lib/contact';
import CarnetVisite from '../components/CarnetVisite';

const emptyForm = {
  Nom: '', Prénom: '', Société: '', Email: '', Téléphone: '',
  Adresse: '', Ville: '', Pays: 'Brésil', Notes: '',
  'Type de client': 'b2b', CNPJ: '',
};

export default function ClientsScreen({ navigation }) {
  const { t, devisCourant, setDevisCourant } = useApp();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [historique, setHistorique] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from('Clients')
      .select('*')
      .order('Nom');
    if (data) setClients(data);
    setLoading(false);
  }

  async function chargerHistorique(clientId) {
    const { data } = await supabase
      .from('Devis')
      .select('id, numero, date, total_ttc, statut')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(10);
    setHistorique(data || []);
  }

  async function sauvegarder() {
    if (!form.Nom && !form.Société) {
      Alert.alert(t.erreur, 'Nom ou Société requis');
      return;
    }
    setSaving(true);
    if (editId) {
      await supabase.from('Clients').update(form).eq('id', editId);
    } else {
      await supabase.from('Clients').insert(form);
    }
    setSaving(false);
    setModal(false);
    charger();
  }

  async function supprimer(id) {
    Alert.alert('Supprimer', 'Confirmer la suppression ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          await supabase.from('Clients').delete().eq('id', id);
          charger();
        },
      },
    ]);
  }

  function ouvrirCreation() {
    setForm(emptyForm);
    setEditId(null);
    setHistorique(null);
    setModal(true);
  }

  function ouvrirEdition(client) {
    setForm({ ...emptyForm, ...client });
    setEditId(client.id);
    chargerHistorique(client.id);
    setModal(true);
  }

  function selectionnerClient(client) {
    setDevisCourant(prev => ({ ...prev, client }));
    Alert.alert('Client sélectionné', `${client.Société || client.Nom} ajouté au devis`);
  }

  const clientsFiltres = clients.filter(c => {
    const q = search.toLowerCase();
    return !search || (c.Nom || '').toLowerCase().includes(q) ||
      (c.Société || '').toLowerCase().includes(q) ||
      (c.Email || '').toLowerCase().includes(q);
  });

  function Field({ label, field, placeholder, keyboardType }) {
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={styles.fieldInput}
          value={form[field] || ''}
          onChangeText={v => setForm(f => ({ ...f, [field]: v }))}
          placeholder={placeholder || ''}
          placeholderTextColor={COLORS.textMuted}
          keyboardType={keyboardType || 'default'}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titre}>MAISON 1822</Text>
        <Text style={styles.sousTitre}>{t.clients}</Text>
      </View>

      <View style={styles.toolbar}>
        <TextInput
          style={[styles.searchInput, { flex: 1 }]}
          placeholder="Rechercher..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.btnNouveau} onPress={ouvrirCreation}>
          <Text style={styles.btnNouveauTxt}>+ {t.nouveau_client}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={clientsFiltres}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.clientRow} onPress={() => ouvrirEdition(item)}>
            <View style={styles.clientInfo}>
              <Text style={styles.clientNom}>{item.Société || `${item.Prénom || ''} ${item.Nom}`}</Text>
              <Text style={styles.clientSub}>{item.Email} {item.Ville ? `· ${item.Ville}` : ''}</Text>
            </View>
            <TouchableOpacity
              style={styles.btnSelClient}
              onPress={() => selectionnerClient(item)}
            >
              <Text style={styles.btnSelClientTxt}>→ Devis</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      {/* Modal édition */}
      <Modal visible={modal} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitre}>{editId ? 'Modifier le client' : t.nouveau_client}</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {editId && (
            <View style={{ paddingHorizontal: 20 }}>
              <BoutonsContact telephone={form['Téléphone']} email={form.Email} pays={form.Pays} />
            </View>
          )}

          <Field label={t.nom} field="Nom" />
          <Field label="Prénom" field="Prénom" />
          <Field label={t.etablissement} field="Société" />
          <Field label={t.email} field="Email" keyboardType="email-address" />
          <Field label={t.telephone} field="Téléphone" keyboardType="phone-pad" />
          <Field label="CNPJ" field="CNPJ" />
          <Field label={t.adresse} field="Adresse" />
          <Field label="Ville" field="Ville" />
          <Field label="Pays" field="Pays" />
          <Field label="Notes" field="Notes" />

          {historique && historique.length > 0 && (
            <View style={styles.historique}>
              <Text style={styles.historiqueTitre}>Historique devis</Text>
              {historique.map(d => (
                <View key={d.id} style={styles.devisRow}>
                  <Text style={styles.devisNum}>{d.numero}</Text>
                  <Text style={styles.devisDate}>{d.date}</Text>
                  <Text style={styles.devisMtant}>R$ {parseFloat(d.total_ttc || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                  <Text style={[styles.devisStatut, d.statut === 'Validé' && { color: COLORS.success }]}>{d.statut || '—'}</Text>
                </View>
              ))}
            </View>
          )}

          {editId && (
            <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
              <CarnetVisite type="client" id={editId} />
            </View>
          )}

          <View style={styles.modalFooter}>
            {editId && (
              <TouchableOpacity style={styles.btnDanger} onPress={() => { setModal(false); supprimer(editId); }}>
                <Text style={styles.btnDangerTxt}>Supprimer</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnSave} onPress={sauvegarder} disabled={saving}>
              <Text style={styles.btnSaveTxt}>{saving ? '...' : t.enregistrer}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  header: { backgroundColor: '#1C1C1E', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  titre: { color: COLORS.gold, fontSize: 11, letterSpacing: 4, fontWeight: '600' },
  sousTitre: { color: COLORS.white, fontSize: 22, fontWeight: '300', marginTop: 2 },
  toolbar: { flexDirection: 'row', padding: 16, gap: 10 },
  searchInput: { backgroundColor: '#2C2C2E', borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: '#3A3A3C' },
  btnNouveau: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingHorizontal: 14, justifyContent: 'center' },
  btnNouveauTxt: { color: COLORS.white, fontWeight: '600', fontSize: 13 },
  clientRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#2C2C2E' },
  clientInfo: { flex: 1 },
  clientNom: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  clientSub: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  btnSelClient: { backgroundColor: '#1C1C1E', borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 6 },
  btnSelClientTxt: { color: COLORS.gold, fontWeight: '600', fontSize: 13 },
  sep: { height: 1, backgroundColor: COLORS.border },
  modal: { flex: 1, backgroundColor: '#1C1C1E' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#1C1C1E' },
  modalTitre: { color: COLORS.white, fontSize: 18, fontWeight: '600' },
  modalClose: { color: COLORS.gold, fontSize: 22 },
  field: { paddingHorizontal: 20, paddingTop: 14 },
  fieldLabel: { fontSize: 11, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  fieldInput: { backgroundColor: '#2C2C2E', borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: '#3A3A3C' },
  historique: { margin: 20, backgroundColor: '#2C2C2E', borderRadius: RADIUS.md, padding: 16, borderWidth: 1, borderColor: '#3A3A3C' },
  historiqueTitre: { fontSize: 12, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  devisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  devisNum: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', flex: 1 },
  devisDate: { fontSize: 12, color: '#8E8E93', flex: 1 },
  devisMtant: { fontSize: 13, color: COLORS.gold, fontWeight: '600', flex: 1, textAlign: 'right' },
  devisStatut: { fontSize: 12, color: '#8E8E93', flex: 1, textAlign: 'right' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 20 },
  btnDanger: { borderWidth: 1, borderColor: COLORS.error, borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 12 },
  btnDangerTxt: { color: COLORS.error, fontWeight: '600' },
  btnSave: { backgroundColor: '#1C1C1E', borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 12 },
  btnSaveTxt: { color: COLORS.white, fontWeight: '600', fontSize: 15 },
});

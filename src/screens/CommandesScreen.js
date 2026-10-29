import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/AppContext';

const BG = '#1C1C1E';
const CARD = '#2C2C2E';
const NAVY = '#0F1E3C';
const GOLD = '#C8A45A';
const WHITE = '#FFFFFF';
const MUTED = '#8E8E93';
const BORDER = '#3A3A3C';
const SUCCESS = '#2D7A4F';
const ERROR = '#C0392B';

const STATUTS = ['Tous', 'Brouillon', 'Envoyé', 'Validé', 'Annulé'];
const STATUT_COULEUR = { Brouillon: MUTED, Envoyé: '#2563EB', Validé: SUCCESS, Annulé: ERROR };

export default function CommandesScreen() {
  const { t } = useApp();
  const [devis, setDevis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statutFiltre, setStatutFiltre] = useState('Tous');
  const [detail, setDetail] = useState(null);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from('Devis')
      .select('*, Clients(Nom, Société, Email)')
      .order('date', { ascending: false });
    if (data) setDevis(data);
    setLoading(false);
  }

  async function changerStatut(id, statut) {
    await supabase.from('Devis').update({ statut_app: statut }).eq('id', id);
    charger();
    if (detail?.id === id) setDetail(d => ({ ...d, statut_app: statut }));
  }

  const devisfiltres = devis.filter(d =>
    statutFiltre === 'Tous' || d.statut_app === statutFiltre
  );

  function Badge({ statut }) {
    const color = STATUT_COULEUR[statut] || MUTED;
    return (
      <View style={[s.badge, { borderColor: color }]}>
        <Text style={[s.badgeTxt, { color }]}>{statut || 'Brouillon'}</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.marque}>MAISON 1822</Text>
        <Text style={s.titre}>{t.commandes}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ paddingVertical: 10, maxHeight: 50 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}>
        {STATUTS.map(s => (
          <TouchableOpacity
            key={s}
            style={[style.filtreBtn, statutFiltre === s && style.filtreBtnActive]}
            onPress={() => setStatutFiltre(s)}>
            <Text style={[style.filtreTxt, statutFiltre === s && style.filtreTxtActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={GOLD} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={devisfiltres}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => setDetail(item)}>
              <View style={s.rowInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <Text style={s.num}>{item.numero || '—'}</Text>
                  <Badge statut={item.statut_app} />
                </View>
                <Text style={s.client}>{item.Clients?.Société || item.Clients?.Nom || 'Client non défini'}</Text>
                <Text style={s.date}>{item.date || '—'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.montant}>R$ {parseFloat(item.total_ttc || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                <Text style={s.ttcLabel}>TTC</Text>
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: BORDER }} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={<Text style={s.vide}>Aucun devis trouvé</Text>}
        />
      )}

      <Modal visible={!!detail} animationType="slide" presentationStyle="formSheet">
        {detail && (
          <ScrollView style={{ flex: 1, backgroundColor: BG }}>
            <View style={[s.header, { paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', backgroundColor: '#1C1C1E' }]}>
              <View>
                <Text style={s.marque}>DEVIS</Text>
                <Text style={s.titre}>{detail.numero || '—'}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetail(null)}>
                <Text style={{ color: GOLD, fontSize: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={s.detailBlock}>
              <Text style={s.detailLabel}>Client</Text>
              <Text style={s.detailVal}>{detail.Clients?.Société || detail.Clients?.Nom || '—'}</Text>
            </View>
            <View style={s.detailBlock}>
              <Text style={s.detailLabel}>Date</Text>
              <Text style={s.detailVal}>{detail.date || '—'}</Text>
            </View>
            <View style={s.detailBlock}>
              <Text style={s.detailLabel}>État · ICMS</Text>
              <Text style={s.detailVal}>{detail.etat_dest || '—'} · {detail.icms_pct || 0}%</Text>
            </View>

            <View style={[s.detailBlock, { backgroundColor: CARD, borderRadius: 10, margin: 16, padding: 16 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ color: MUTED, fontSize: 13 }}>Total HT</Text>
                <Text style={{ color: WHITE, fontSize: 13 }}>R$ {parseFloat(detail.total_ht || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ color: MUTED, fontSize: 13 }}>ICMS</Text>
                <Text style={{ color: WHITE, fontSize: 13 }}>R$ {parseFloat(detail.icms_montant || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 2, borderTopColor: GOLD, marginTop: 4 }}>
                <Text style={{ color: WHITE, fontSize: 16, fontWeight: '700' }}>TOTAL TTC</Text>
                <Text style={{ color: GOLD, fontSize: 16, fontWeight: '700' }}>R$ {parseFloat(detail.total_ttc || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>

            <View style={s.detailBlock}>
              <Text style={s.detailLabel}>Changer le statut</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {STATUTS.filter(s => s !== 'Tous').map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[style.filtreBtn, detail.statut_app === st && { backgroundColor: STATUT_COULEUR[st], borderColor: STATUT_COULEUR[st] }]}
                    onPress={() => changerStatut(detail.id, st)}>
                    <Text style={[style.filtreTxt, detail.statut_app === st && { color: WHITE }]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

const style = StyleSheet.create({
  filtreBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: BORDER, marginRight: 8, backgroundColor: CARD },
  filtreBtnActive: { backgroundColor: GOLD, borderColor: GOLD },
  filtreTxt: { fontSize: 13, color: WHITE, fontWeight: '500' },
  filtreTxtActive: { color: NAVY, fontWeight: '700' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { backgroundColor: '#1C1C1E', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: GOLD + '40' },
  marque: { color: GOLD, fontSize: 10, letterSpacing: 4, fontWeight: '700' },
  titre: { color: WHITE, fontSize: 24, fontWeight: '200', letterSpacing: 1, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: CARD },
  rowInfo: { flex: 1 },
  num: { fontSize: 14, fontWeight: '700', color: WHITE },
  client: { fontSize: 13, color: WHITE },
  date: { fontSize: 11, color: MUTED, marginTop: 2 },
  montant: { fontSize: 15, fontWeight: '700', color: GOLD },
  ttcLabel: { fontSize: 10, color: MUTED },
  badge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { fontSize: 11, fontWeight: '600' },
  vide: { textAlign: 'center', color: MUTED, padding: 40, fontStyle: 'italic' },
  detailBlock: { paddingHorizontal: 20, paddingTop: 14 },
  detailLabel: { fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  detailVal: { fontSize: 15, color: WHITE, fontWeight: '500' },
});

import React, { useCallback, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { BoutonsContact } from '../lib/contact';
import { chargerRelances, publierNombreRelances, totalRelances, joursDepuis, JOURS_FOURNISSEUR } from '../lib/relances';

const BG = '#1C1C1E', CARD = '#2C2C2E', GOLD = '#C8A45A', WHITE = '#FFFFFF', MUTED = '#8E8E93', BORDER = '#3A3A3C', RED = '#E06C75';

const formatDate = (iso) => {
  if (!iso) return '';
  const [a, m, j] = String(iso).slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
};

function retard(dateIso) {
  const n = joursDepuis(dateIso);
  if (n == null) return '';
  if (n <= 0) return "Aujourd'hui";
  return `En retard de ${n} jour${n > 1 ? 's' : ''}`;
}

// Lignes : composants hors de l'écran, pour ne pas être recréés à chaque rendu
function LigneProspect({ item }) {
  return (
    <View style={s.carte}>
      <Text style={s.nom}>{item.nom}</Text>
      {!!item.nom_etablissement && item.nom_etablissement !== item.nom && <Text style={s.sous}>{item.nom_etablissement}</Text>}
      <Text style={[s.sous, { color: RED }]}>Relance prévue le {formatDate(item.date_prochaine_relance)} · {retard(item.date_prochaine_relance)}</Text>
      <BoutonsContact
        telephone={item.telephone_portable || item.telephone_fixe}
        whatsapp={item.whatsapp} email={item.email} pays={item.pays} />
    </View>
  );
}

function LigneNote({ item, onFait }) {
  return (
    <View style={s.carte}>
      <Text style={s.nom}>{item.cible}</Text>
      <Text style={{ color: WHITE, fontSize: 13, marginTop: 4 }} numberOfLines={3}>{item.resume}</Text>
      {!!item.prochaine_action && <Text style={{ color: WHITE, fontSize: 13, marginTop: 4 }}>➜ {item.prochaine_action}</Text>}
      <Text style={[s.sous, { color: RED }]}>Relance le {formatDate(item.date_relance)} · {retard(item.date_relance)}</Text>
      <TouchableOpacity onPress={() => onFait(item)} style={s.boutonFait} activeOpacity={0.7}>
        <Text style={{ color: GOLD, fontWeight: '700', fontSize: 13 }}>Marquer fait</Text>
      </TouchableOpacity>
    </View>
  );
}

function LigneFournisseur({ item }) {
  const n = joursDepuis(item.derniere);
  const c = item.contact;
  return (
    <View style={s.carte}>
      <Text style={s.nom}>{item.nom}</Text>
      <Text style={s.sous}>Étape : {item.etape}</Text>
      <Text style={[s.sous, { color: RED }]}>Aucun mouvement depuis {n} jours (dernier : {formatDate(item.derniere)})</Text>
      {!!c && <Text style={s.sous}>Contact : {c.nom}</Text>}
      {!!c && <BoutonsContact telephone={c.telephone} whatsapp={c.whatsapp} email={c.email} pays={item.pays} />}
    </View>
  );
}

export default function RelancesScreen() {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(async (silencieux) => {
    if (!silencieux) setChargement(true);
    try {
      const r = await chargerRelances();
      setDonnees(r);
      setErreur(null);
      publierNombreRelances(totalRelances(r));
    } catch (e) {
      setErreur(e.message || 'Chargement impossible (hors ligne ?)');
    }
    setChargement(false);
    setRafraichit(false);
  }, []);

  useFocusEffect(useCallback(() => { charger(!!donnees); }, [charger]));

  async function noteFaite(note) {
    const { error } = await supabase.from('Notes de Visite').update({ fait: true, maj: new Date().toISOString() }).eq('id', note.id);
    if (error) { Alert.alert('Erreur', error.message); return; }
    setDonnees((prev) => {
      if (!prev) return prev;
      const suivant = { ...prev, notes: prev.notes.filter((n) => n.id !== note.id) };
      publierNombreRelances(totalRelances(suivant));
      return suivant;
    });
  }

  const sections = donnees ? [
    { cle: 'p', titre: `Prospects à rappeler · ${donnees.prospects.length}`, data: donnees.prospects },
    { cle: 'n', titre: `Notes de visite à traiter · ${donnees.notes.length}`, data: donnees.notes },
    { cle: 'f', titre: `Fournisseurs sans mouvement depuis ${JOURS_FOURNISSEUR} jours · ${donnees.fournisseurs.length}`, data: donnees.fournisseurs },
  ].filter((x) => x.data.length > 0) : [];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.marque}>MAISON 1822</Text>
        <Text style={s.titre}>Relances</Text>
      </View>

      {chargement && !donnees && <ActivityIndicator color={GOLD} size="large" style={{ marginTop: 60 }} />}

      {!!erreur && (
        <Text style={{ color: RED, paddingHorizontal: 20, paddingTop: 12, fontSize: 13 }}>
          {donnees ? 'Mise à jour impossible (hors ligne ?). Données affichées : dernier chargement.' : erreur}
        </Text>
      )}

      {donnees && sections.length === 0 && !erreur && (
        <Text style={{ color: MUTED, textAlign: 'center', marginTop: 60, fontSize: 15 }}>Aucune relance en attente.</Text>
      )}

      {donnees && sections.length > 0 && (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => `${item.id || item.fournisseur_id || i}`}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={rafraichit} tintColor={GOLD} onRefresh={() => { setRafraichit(true); charger(true); }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          renderSectionHeader={({ section }) => <Text style={s.sectionTitre}>{section.titre}</Text>}
          renderItem={({ item, section }) => (
            section.cle === 'p' ? <LigneProspect item={item} />
              : section.cle === 'n' ? <LigneNote item={item} onFait={noteFaite} />
                : <LigneFournisseur item={item} />
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { backgroundColor: BG, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: GOLD + '40' },
  marque: { color: GOLD, fontSize: 10, letterSpacing: 4, fontWeight: '700' },
  titre: { color: WHITE, fontSize: 24, fontWeight: '200', letterSpacing: 1, marginTop: 2 },
  sectionTitre: { color: GOLD, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  carte: { backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 14, marginBottom: 10 },
  nom: { color: WHITE, fontSize: 15, fontWeight: '700' },
  sous: { color: MUTED, fontSize: 12, marginTop: 3 },
  boutonFait: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: GOLD },
});

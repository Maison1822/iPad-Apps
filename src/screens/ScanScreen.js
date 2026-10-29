import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { COLORS, RADIUS } from '../lib/theme';
import { useApp } from '../lib/AppContext';

// Analyse OCR via l'API Anthropic (Claude Vision)
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

async function analyserMenuAvecClaude(base64Image) {
  // Appel à Claude Vision pour extraire les vins du menu
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': '', // La clé est injectée par le proxy Anthropic
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
          },
          {
            type: 'text',
            text: `Analyse cette carte des vins ou ce menu et extrais UNIQUEMENT la liste des vins.
Pour chaque vin trouvé, retourne un JSON array avec ces champs:
- nom: string (nom du vin ou du domaine)
- appellation: string (appellation si visible)
- millesime: number ou null
- couleur: "Rouge" | "Blanc" | "Rosé" | null

Réponds UNIQUEMENT avec le JSON array, sans texte avant ni après. Exemple:
[{"nom":"Château Margaux","appellation":"Margaux","millesime":2019,"couleur":"Rouge"}]

Si aucun vin n'est visible, retourne [].`,
          },
        ],
      }],
    }),
  });
  const data = await response.json();
  const text = data.content?.[0]?.text || '[]';
  try {
    return JSON.parse(text.trim());
  } catch {
    return [];
  }
}

async function rapprochemtAvecBase(vinsExtraits) {
  if (!vinsExtraits || vinsExtraits.length === 0) return [];

  // Pour chaque vin extrait, chercher dans Supabase
  const resultats = await Promise.all(
    vinsExtraits.map(async (vin) => {
      const mots = (vin.nom || '').split(' ').filter(m => m.length > 3);
      let query = supabase
        .from('Produits')
        .select('id, SKU, Nom, Producteur, "Nom de la Cuvée", Couleur, Millésime, "Contenance (mL)", "Vignette URL", pvc_ttc_brl, Appellations(name)')
        .eq('Actif', true)
        .limit(3);

      if (vin.couleur) query = query.eq('Couleur', vin.couleur);
      if (vin.millesime) query = query.eq('Millésime', vin.millesime);

      // Recherche par nom
      if (mots.length > 0) {
        query = query.or(mots.slice(0, 2).map(m => `Nom.ilike.%${m}%,Producteur.ilike.%${m}%`).join(','));
      }

      const { data } = await query;
      return {
        vinExtrait: vin,
        correspondances: data || [],
      };
    })
  );

  return resultats;
}

export default function ScanScreen() {
  const { t, addLigneDevis } = useApp();
  const [image, setImage] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [resultats, setResultats] = useState(null);
  const [ajouts, setAjouts] = useState({});

  async function prendrephoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.erreur, 'Permission caméra refusée');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage(asset.uri);
      analyser(asset.base64);
    }
  }

  async function choisirGalerie() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage(asset.uri);
      analyser(asset.base64);
    }
  }

  async function analyser(base64) {
    setAnalysing(true);
    setResultats(null);
    try {
      const vinsExtraits = await analyserMenuAvecClaude(base64);
      if (vinsExtraits.length === 0) {
        setResultats([]);
        setAnalysing(false);
        return;
      }
      const rapprochemts = await rapprochemtAvecBase(vinsExtraits);
      setResultats(rapprochemts);
    } catch (e) {
      Alert.alert(t.erreur, 'Impossible d\'analyser l\'image : ' + e.message);
    }
    setAnalysing(false);
  }

  function handleAjouter(produit) {
    addLigneDevis(produit);
    setAjouts(prev => ({ ...prev, [produit.id]: true }));
    setTimeout(() => setAjouts(prev => ({ ...prev, [produit.id]: false })), 1500);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titre}>MAISON 1822</Text>
        <Text style={styles.sousTitre}>{t.scan}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Zone d'action */}
        <View style={styles.actionZone}>
          <TouchableOpacity style={styles.btnScan} onPress={prendrephoto}>
            <Text style={styles.btnScanIcon}>📷</Text>
            <Text style={styles.btnScanTxt}>{t.scanner_menu}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnScan, { backgroundColor: '#1C1C1E' }]} onPress={choisirGalerie}>
            <Text style={styles.btnScanIcon}>🖼️</Text>
            <Text style={[styles.btnScanTxt, { color: '#FFFFFF' }]}>Depuis la galerie</Text>
          </TouchableOpacity>
        </View>

        {/* Aperçu image */}
        {image && (
          <Image source={{ uri: image }} style={styles.preview} resizeMode="cover" />
        )}

        {/* Chargement */}
        {analysing && (
          <View style={styles.loadingZone}>
            <ActivityIndicator color={COLORS.gold} size="large" />
            <Text style={styles.loadingTxt}>{t.analyse_en_cours}</Text>
            <Text style={styles.loadingSubTxt}>Claude Vision analyse le menu...</Text>
          </View>
        )}

        {/* Résultats */}
        {resultats !== null && !analysing && (
          <View>
            <Text style={styles.resultsTitre}>
              {resultats.length === 0
                ? t.aucun_vin
                : `${resultats.reduce((n, r) => n + r.correspondances.length, 0)} correspondance(s) trouvée(s)`}
            </Text>

            {resultats.map((r, idx) => (
              <View key={idx} style={styles.resultBlock}>
                <View style={styles.vinExtrait}>
                  <Text style={styles.vinExtraitNom}>"{r.vinExtrait.nom}"</Text>
                  {r.vinExtrait.appellation && <Text style={styles.vinExtraitApp}>{r.vinExtrait.appellation}</Text>}
                  {r.vinExtrait.millesime && <Text style={styles.vinExtraitApp}>{r.vinExtrait.millesime}</Text>}
                </View>

                {r.correspondances.length === 0 ? (
                  <Text style={styles.nonTrouve}>Pas de correspondance dans le catalogue</Text>
                ) : (
                  r.correspondances.map(prod => (
                    <View key={prod.id} style={styles.correspondanceRow}>
                      {prod['Vignette URL'] && (
                        <Image source={{ uri: prod['Vignette URL'] }} style={styles.prodThumb} />
                      )}
                      <View style={styles.prodInfo}>
                        <Text style={styles.prodNom}>{prod.Producteur} {prod['Nom de la Cuvée'] || prod.Nom}</Text>
                        <Text style={styles.prodApp}>{prod.Appellations?.name} · {prod.Millésime || '—'}</Text>
                        {prod.pvc_ttc_brl && (
                          <Text style={styles.prodPrix}>R$ {parseFloat(prod.pvc_ttc_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[styles.btnAjouter, ajouts[prod.id] && styles.btnAjouterOk]}
                        onPress={() => handleAjouter(prod)}
                      >
                        <Text style={styles.btnAjouterTxt}>{ajouts[prod.id] ? '✓' : '+'}</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            ))}
          </View>
        )}

        {/* État initial */}
        {!image && !analysing && resultats === null && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🍷</Text>
            <Text style={styles.emptyTxt}>Photographiez une carte des vins ou un menu pour identifier les vins présents dans votre catalogue.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  header: { backgroundColor: '#1C1C1E', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  titre: { color: COLORS.gold, fontSize: 11, letterSpacing: 4, fontWeight: '600' },
  sousTitre: { color: COLORS.white, fontSize: 22, fontWeight: '300', marginTop: 2 },
  actionZone: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  btnScan: { flex: 1, backgroundColor: '#1C1C1E', borderRadius: RADIUS.md, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#3A3A3C' },
  btnScanIcon: { fontSize: 32 },
  btnScanTxt: { color: COLORS.white, fontWeight: '600', fontSize: 14, textAlign: 'center' },
  preview: { width: '100%', height: 200, borderRadius: RADIUS.md, marginBottom: 16 },
  loadingZone: { alignItems: 'center', padding: 32 },
  loadingTxt: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 16 },
  loadingSubTxt: { color: '#8E8E93', fontSize: 13, marginTop: 4 },
  resultsTitre: { fontSize: 13, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  resultBlock: { backgroundColor: '#2C2C2E', borderRadius: RADIUS.md, marginBottom: 12, borderWidth: 1, borderColor: '#3A3A3C', overflow: 'hidden' },
  vinExtrait: { backgroundColor: COLORS.cream, padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  vinExtraitNom: { fontSize: 13, fontStyle: 'italic', color: '#FFFFFF', fontWeight: '600' },
  vinExtraitApp: { fontSize: 12, color: '#8E8E93' },
  nonTrouve: { padding: 12, fontSize: 13, color: '#8E8E93', fontStyle: 'italic' },
  correspondanceRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  prodThumb: { width: 36, height: 54, marginRight: 10, borderRadius: 3 },
  prodInfo: { flex: 1 },
  prodNom: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  prodApp: { fontSize: 11, color: '#8E8E93', marginTop: 1 },
  prodPrix: { fontSize: 12, color: COLORS.gold, fontWeight: '600', marginTop: 2 },
  btnAjouter: { backgroundColor: '#1C1C1E', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnAjouterOk: { backgroundColor: COLORS.success },
  btnAjouterTxt: { color: COLORS.white, fontSize: 18, lineHeight: 20 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTxt: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 22 },
});

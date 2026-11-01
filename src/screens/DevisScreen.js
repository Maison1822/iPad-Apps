import React, { useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { COLORS, SPACING, RADIUS } from '../lib/theme';
import { useApp } from '../lib/AppContext';
import SignaturePad from '../components/SignaturePad';
import { envoyerOuMettreEnFile } from '../lib/outbox';

const ICMS_PAR_ETAT = {
  SP: 18, RJ: 20, MG: 18, RS: 17, PR: 15, SC: 17,
  BA: 20, PE: 18, CE: 18, GO: 17, DF: 18,
};

export default function DevisScreen() {
  const { t, lang, devisCourant, setDevisCourant, updateQuantite, removeLigneDevis, resetDevis } = useApp();
  const [sigModal, setSigModal] = useState(null); // 'client' | 'commercial'
  const [generating, setGenerating] = useState(false);
  const [etatDest, setEtatDest] = useState('SP');
  const [icmsPct, setIcmsPct] = useState(18);
  const [bMode, setBMode] = useState(false); // Noir et blanc

  const { lignes, client, date, numero, signatureClient, signatureCommercial } = devisCourant;

  function totalHT() {
    return lignes.reduce((s, l) => s + (parseFloat(l.prixUnitaire) || 0) * l.quantite, 0);
  }

  function montantIcms() {
    const ht = totalHT();
    const icms = icmsPct / 100;
    return ht * icms / (1 - icms);
  }

  function totalTTC() {
    return totalHT() + montantIcms();
  }

  function genererHTML() {
    const nomClient = client ? (client.Société || `${client.Prénom || ''} ${client.Nom}`) : '—';
    const adresseClient = client ? [client.Adresse, client.Ville, client.Pays].filter(Boolean).join(', ') : '';
    const cnpj = client?.CNPJ || '';

    const lignesHTML = lignes.map((l, i) => {
      const pu = parseFloat(l.prixUnitaire) || 0;
      const total = pu * l.quantite;
      const ncm = l.produit.NCMs?.code || '';
      return `
        <tr style="border-bottom:1px solid #e5ddd0;">
          <td style="padding:8px 6px;font-size:11px;color:#1A1A1A;">${i + 1}</td>
          <td style="padding:8px 6px;font-size:11px;color:#1A1A1A;font-weight:600;">${l.produit.producteur || l.produit.Producteur || ''} ${l.produit.cuvee || l.produit['Nom de la Cuvée'] || l.produit.nom || l.produit.Nom || ''}</td>
          <td style="padding:8px 6px;font-size:10px;color:#6B6B6B;">${ncm}</td>
          <td style="padding:8px 6px;font-size:11px;text-align:center;">${l.quantite}</td>
          <td style="padding:8px 6px;font-size:11px;text-align:right;">R$ ${pu.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          <td style="padding:8px 6px;font-size:11px;text-align:right;font-weight:600;">R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    const sigClientHTML = signatureClient
      ? `<img src="${signatureClient}" style="height:60px;display:block;margin:0 auto;" />`
      : '<div style="height:60px;border-bottom:1px solid #0F1E3C;"></div>';
    const sigCommercialHTML = signatureCommercial
      ? `<img src="${signatureCommercial}" style="height:60px;display:block;margin:0 auto;" />`
      : '<div style="height:60px;border-bottom:1px solid #0F1E3C;"></div>';

    const ht = totalHT();
    const icms = montantIcms();
    const ttc = totalTTC();

    const accent = bMode ? '#000000' : '#C8A45A';
    const navy = bMode ? '#000000' : '#0F1E3C';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 40px; color: #1A1A1A; background: white; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid ${accent}; }
  .logo-zone { }
  .marque { font-size: 22px; font-weight: 300; letter-spacing: 4px; color: ${navy}; }
  .slogan { font-size: 9px; color: #6B6B6B; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
  .devis-info { text-align: right; }
  .devis-num { font-size: 18px; font-weight: 700; color: ${navy}; }
  .devis-date { font-size: 11px; color: #6B6B6B; margin-top: 4px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
  .partie-label { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #6B6B6B; margin-bottom: 6px; }
  .partie-nom { font-size: 14px; font-weight: 600; color: ${navy}; }
  .partie-sub { font-size: 11px; color: #6B6B6B; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead tr { background: ${navy}; }
  thead th { padding: 8px 6px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: white; text-align: left; }
  thead th:nth-child(4), thead th:nth-child(5), thead th:nth-child(6) { text-align: right; }
  tbody tr:nth-child(even) { background: #FAFAF7; }
  .totaux { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-bottom: 32px; }
  .total-ligne { display: flex; gap: 40px; font-size: 12px; }
  .total-label { color: #6B6B6B; }
  .total-ttc { font-size: 16px; font-weight: 700; color: ${navy}; border-top: 2px solid ${accent}; padding-top: 6px; margin-top: 2px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 24px; border-top: 1px solid #E5DDD0; }
  .sig-label { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #6B6B6B; margin-bottom: 12px; text-align: center; }
  .footer { margin-top: 32px; font-size: 9px; color: #6B6B6B; text-align: center; border-top: 1px solid #E5DDD0; padding-top: 12px; }
  .legal-id { font-size: 9px; color: #6B6B6B; margin-top: 2px; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo-zone">
      <div class="marque">MAISON <span style="font-weight:700">1822</span></div>
      <div class="slogan">Expédition d'Exception</div>
      <div class="legal-id" style="margin-top:8px;font-weight:600;color:#0F1E3C;">BC GLOBAL TRADE LTDA</div>
      <div class="legal-id">CNPJ : 68.819.776/0001-71</div>
      <div class="legal-id">Rua Uruguai, 458 — Itajaí, SC 88301-700 — Brasil</div>
      <div class="legal-id">brasil@maison1822.com · www.maison1822.com.br</div>
    </div>
    <div class="devis-info">
      <div class="devis-num">${numero}</div>
      <div class="devis-date">${date}</div>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="partie-label">Vendeur</div>
      <div class="partie-nom">BC GLOBAL TRADE LTDA</div>
      <div class="partie-sub">CNPJ : 68.819.776/0001-71</div>
      <div class="partie-sub">Rua Uruguai, 458 — Itajaí, SC 88301-700 — Brasil</div>
      <div class="partie-sub">brasil@maison1822.com</div>
    </div>
    <div>
      <div class="partie-label">Acheteur</div>
      <div class="partie-nom">${nomClient}</div>
      ${adresseClient ? `<div class="partie-sub">${adresseClient}</div>` : ''}
      ${cnpj ? `<div class="partie-sub">CNPJ : ${cnpj}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:3%">#</th>
        <th style="width:42%">Désignation</th>
        <th style="width:12%">NCM</th>
        <th style="width:8%;text-align:right">Qté</th>
        <th style="width:15%;text-align:right">Prix unit.</th>
        <th style="width:20%;text-align:right">TOTAL TTC</th>
      </tr>
    </thead>
    <tbody>
      ${lignesHTML}
    </tbody>
  </table>

  <div class="totaux">
    <div class="total-ligne">
      <span class="total-label">Total HT</span>
      <span>R$ ${ht.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
    </div>
    <div class="total-ligne">
      <span class="total-label">ICMS ${icmsPct}% (${etatDest})</span>
      <span>R$ ${icms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
    </div>
    <div class="total-ligne total-ttc">
      <span>TOTAL TTC</span>
      <span>R$ ${ttc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
    </div>
  </div>

  <div class="signatures">
    <div>
      <div class="sig-label">${t.signature_client}</div>
      ${sigClientHTML}
      <div style="text-align:center;font-size:10px;margin-top:6px;color:#6B6B6B;">${nomClient}</div>
    </div>
    <div>
      <div class="sig-label">${t.signature_commercial}</div>
      ${sigCommercialHTML}
      <div style="text-align:center;font-size:10px;margin-top:6px;color:#6B6B6B;">Commercial MAISON 1822</div>
    </div>
  </div>

  <div class="footer">
    BC GLOBAL TRADE LTDA — CNPJ 68.819.776/0001-71 — brasil@maison1822.com — www.maison1822.com.br<br/>
    Document généré le ${new Date().toLocaleDateString('fr-FR')}<br/>
    <span style="margin-top:4px;display:inline-block;">Condições Gerais de Venda : <a href="https://www.maison1822.com.br/termos-de-venda-brasil" style="color:#C8A45A;">www.maison1822.com.br/termos-de-venda-brasil</a></span>
  </div>
</body>
</html>`;
  }

  async function genererPDF() {
    if (lignes.length === 0) { Alert.alert(t.erreur, 'Aucun produit dans le devis'); return; }
    setGenerating(true);
    try {
      const html = genererHTML();
      const encoded = encodeURIComponent(html);
      await Linking.openURL(`data:text/html,${encoded}`);
    } catch (e) {
      Alert.alert(t.erreur, e.message);
    }
    setGenerating(false);
  }

  async function envoyerEmail() {
    if (lignes.length === 0) { Alert.alert(t.erreur, 'Aucun produit dans le devis'); return; }
    setGenerating(true);
    try {
      const nomClient = client ? (client.Société || client.Nom) : 'Client';
      const sujet = encodeURIComponent(`${t.devis} ${numero} — MAISON 1822`);
      const corps = encodeURIComponent(
        lang === 'PT'
          ? `Prezado(a) ${nomClient},\n\nSegue em anexo o orçamento ${numero}.\n\nAtenciosamente,\nMAISON 1822`
          : lang === 'EN'
          ? `Dear ${nomClient},\n\nPlease find attached quote ${numero}.\n\nBest regards,\nMAISON 1822`
          : `Cher(e) ${nomClient},\n\nVeuillez trouver ci-joint le devis ${numero}.\n\nCordialement,\nMAISON 1822`
      );
      const dest = client?.Email || 'brasil@maison1822.com';
      await Linking.openURL(`mailto:${dest}?subject=${sujet}&body=${corps}`);
      await sauvegarderDevis('Envoyé');
    } catch (e) {
      Alert.alert(t.erreur, e.message);
    }
    setGenerating(false);
  }

  async function sauvegarderDevis(statut = 'Brouillon') {
    const payload = {
      numero,
      date,
      client_id: client?.id || null,
      lignes: JSON.stringify(lignes),
      total_ht: totalHT(),
      icms_pct: icmsPct,
      icms_montant: montantIcms(),
      total_ttc: totalTTC(),
      etat_dest: etatDest,
      statut,
      signature_client: signatureClient,
      signature_commercial: signatureCommercial,
    };
    // Enregistrement par numéro : rejouable sans doublon. Sans réseau, le devis est gardé sur l'appareil puis envoyé plus tard.
    const resultat = await envoyerOuMettreEnFile({ table: 'Devis', payload, onConflict: 'numero', libelle: `Devis ${numero}` });
    if (resultat.statut === 'envoye') Alert.alert(t.succes, statut === 'Envoyé' ? t.devis_envoye : t.devis_enregistre);
    else if (resultat.statut === 'en_attente') Alert.alert('Hors ligne', "Le devis est enregistré sur l'appareil. Il sera envoyé dès le retour du réseau.");
    else Alert.alert(t.erreur, resultat.error?.message || 'Enregistrement refusé.');
  }

  function LigneDevis({ item }) {
    const pu = parseFloat(item.prixUnitaire) || 0;
    return (
      <View style={styles.ligneRow}>
        <View style={styles.ligneInfo}>
          <Text style={styles.ligneNom} numberOfLines={1}>
            {item.produit.producteur || item.produit.Producteur} {item.produit.cuvee || item.produit['Nom de la Cuvée'] || item.produit.nom || item.produit.Nom}
          </Text>
          <Text style={styles.ligneApp}>
            {item.produit.appellation || item.produit.Appellations?.name || ''} · {item.produit.millesime || item.produit.Millésime || '—'}
          </Text>
        </View>
        <View style={styles.ligneQte}>
          <TouchableOpacity onPress={() => item.quantite > 1 ? updateQuantite(item.produit.id, item.quantite - 1) : removeLigneDevis(item.produit.id)} style={styles.qteBtn}>
            <Text style={styles.qteBtnTxt}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qteVal}>{item.quantite}</Text>
          <TouchableOpacity onPress={() => updateQuantite(item.produit.id, item.quantite + 1)} style={styles.qteBtn}>
            <Text style={styles.qteBtnTxt}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.lignePrix}>
          <Text style={styles.ligneTotal}>R$ {(pu * item.quantite).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
          <Text style={styles.lignePU}>R$ {pu.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / u</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.titre}>MAISON 1822</Text>
          <Text style={styles.sousTitre}>{t.devis}</Text>
        </View>
        <Text style={styles.numero}>{numero}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
        {/* Client */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.client}</Text>
          {client ? (
            <Text style={styles.clientNom}>{client.Société || `${client.Prénom || ''} ${client.Nom}`}</Text>
          ) : (
            <Text style={styles.clientVide}>— Aucun client sélectionné —</Text>
          )}
        </View>

        {/* Lignes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.produits} ({lignes.length})</Text>
          {lignes.length === 0 ? (
            <Text style={styles.vide}>Ajoutez des vins depuis le catalogue</Text>
          ) : (
            lignes.map(item => <LigneDevis key={item.produit.id} item={item} />)
          )}
        </View>

        {/* ICMS */}
        {lignes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Fiscalité Brésil</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {Object.keys(ICMS_PAR_ETAT).map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.etatBtn, etatDest === e && styles.etatBtnActive]}
                  onPress={() => { setEtatDest(e); setIcmsPct(ICMS_PAR_ETAT[e]); }}
                >
                  <Text style={[styles.etatBtnTxt, etatDest === e && styles.etatBtnTxtActive]}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.icmsInfo}>ICMS {etatDest} : {icmsPct}%</Text>
          </View>
        )}

        {/* Totaux */}
        {lignes.length > 0 && (
          <View style={styles.totaux}>
            <View style={styles.totalLigne}>
              <Text style={styles.totalLabel}>{t.total_ht}</Text>
              <Text style={styles.totalVal}>R$ {totalHT().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.totalLigne}>
              <Text style={styles.totalLabel}>{t.icms} {icmsPct}%</Text>
              <Text style={styles.totalVal}>R$ {montantIcms().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={[styles.totalLigne, styles.totalTTCRow]}>
              <Text style={styles.totalTTCLabel}>{t.total_ttc}</Text>
              <Text style={styles.totalTTCVal}>R$ {totalTTC().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Signatures</Text>
          <View style={styles.sigRow}>
            <TouchableOpacity style={styles.sigBtn} onPress={() => setSigModal('client')}>
              <Text style={styles.sigBtnLabel}>{t.signature_client}</Text>
              {signatureClient
                ? <Text style={styles.sigOk}>✓ Signée</Text>
                : <Text style={styles.sigAttente}>Appuyer pour signer</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.sigBtn} onPress={() => setSigModal('commercial')}>
              <Text style={styles.sigBtnLabel}>{t.signature_commercial}</Text>
              {signatureCommercial
                ? <Text style={styles.sigOk}>✓ Signée</Text>
                : <Text style={styles.sigAttente}>Appuyer pour signer</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnSecondaire} onPress={() => setBMode(b => !b)}>
          <Text style={styles.btnSecondaireTxt}>{bMode ? 'Couleur' : 'N&B'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondaire} onPress={() => sauvegarderDevis()}>
          <Text style={styles.btnSecondaireTxt}>💾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnAction} onPress={genererPDF} disabled={generating}>
          {generating ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnActionTxt}>{t.imprimer}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnAction, { backgroundColor: COLORS.gold }]} onPress={envoyerEmail} disabled={generating}>
          <Text style={styles.btnActionTxt}>{t.envoyer_email}</Text>
        </TouchableOpacity>
      </View>

      {/* Modal signature */}
      <Modal visible={!!sigModal} animationType="slide" presentationStyle="fullScreen">
        <SignaturePad
          titre={sigModal === 'client' ? t.signature_client : t.signature_commercial}
          onSave={sig => {
            if (sigModal === 'client') setDevisCourant(d => ({ ...d, signatureClient: sig }));
            else setDevisCourant(d => ({ ...d, signatureCommercial: sig }));
            setSigModal(null);
          }}
          onClose={() => setSigModal(null)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  header: { backgroundColor: '#1C1C1E', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  titre: { color: COLORS.gold, fontSize: 11, letterSpacing: 4, fontWeight: '600' },
  sousTitre: { color: COLORS.white, fontSize: 22, fontWeight: '300', marginTop: 2 },
  numero: { color: COLORS.gold, fontSize: 12, fontWeight: '600' },
  section: { backgroundColor: '#2C2C2E', margin: 16, borderRadius: RADIUS.md, padding: 16, borderWidth: 1, borderColor: '#3A3A3C' },
  sectionLabel: { fontSize: 10, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 },
  clientNom: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  clientVide: { fontSize: 14, color: '#8E8E93', fontStyle: 'italic' },
  vide: { fontSize: 14, color: '#8E8E93', textAlign: 'center', paddingVertical: 20 },
  ligneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  ligneInfo: { flex: 1 },
  ligneNom: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  ligneApp: { fontSize: 11, color: '#8E8E93', marginTop: 1 },
  ligneQte: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12 },
  qteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  qteBtnTxt: { color: COLORS.white, fontSize: 16, lineHeight: 18 },
  qteVal: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', minWidth: 24, textAlign: 'center' },
  lignePrix: { alignItems: 'flex-end' },
  ligneTotal: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  lignePU: { fontSize: 10, color: '#8E8E93' },
  etatBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: '#3A3A3C', marginRight: 6, backgroundColor: '#1C1C1E' },
  etatBtnActive: { backgroundColor: '#1C1C1E', borderColor: COLORS.navy },
  etatBtnTxt: { fontSize: 12, color: '#8E8E93' },
  etatBtnTxtActive: { color: COLORS.white },
  icmsInfo: { fontSize: 12, color: '#8E8E93' },
  totaux: { backgroundColor: '#383838', marginHorizontal: 16, borderRadius: RADIUS.md, padding: 16, borderWidth: 1, borderColor: '#C8A45A60' },
  totalLigne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 15, color: '#FFFFFF' },
  totalVal: { fontSize: 15, color: '#C8A45A', fontWeight: '700' },
  totalTTCRow: { borderTopWidth: 2, borderTopColor: COLORS.gold, marginTop: 6, paddingTop: 10 },
  totalTTCLabel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  totalTTCVal: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  sigRow: { flexDirection: 'row', gap: 12 },
  sigBtn: { flex: 1, borderWidth: 1, borderColor: '#3A3A3C', borderRadius: RADIUS.sm, padding: 12, alignItems: 'center' },
  sigBtnLabel: { fontSize: 10, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  sigOk: { fontSize: 13, color: COLORS.success, fontWeight: '600' },
  sigAttente: { fontSize: 12, color: '#8E8E93', fontStyle: 'italic' },
  actions: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 8, padding: 16, backgroundColor: '#2C2C2E', borderTopWidth: 1, borderTopColor: COLORS.border },
  btnSecondaire: { borderWidth: 1, borderColor: '#3A3A3C', borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12 },
  btnSecondaireTxt: { color: COLORS.text, fontSize: 13 },
  btnAction: { flex: 1, backgroundColor: '#1C1C1E', borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  btnActionTxt: { color: COLORS.white, fontWeight: '600', fontSize: 13 },
});

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { supabase } from '../lib/supabase';

const BG='#1C1C1E',CARD='#2C2C2E',GOLD='#C8A45A',WHITE='#FFFFFF',MUTED='#8E8E93',BORDER='#3A3A3C',NAVY='#0F1E3C',ERROR='#E57373';
const FORMATS=[375,500,750,1500];
const TYPES=['Tranquille','Champagne','Crémant','Pétillant','Spiritueux'];
const ETATS=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const TOLERANCE=25;

function fmt(v){
  if(v==null||v==='')return '—';
  return Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function parseNum(v){
  const n=parseFloat(String(v).replace(',','.'));
  return isNaN(n)?null:n;
}
// Libellé lisible : "CÔTES-DU-RHÔNE" → "Côtes-du-rhône"
function titre(v){
  const t=String(v).trim().toLowerCase();
  return t.charAt(0).toUpperCase()+t.slice(1);
}

function Chip({label,active,onPress}){
  return(
    <TouchableOpacity onPress={onPress} style={[s.chip,active&&s.chipActive]}>
      <Text style={[s.chipTxt,active&&s.chipTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ChipsScroll({children}){
  return(
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
      {children}
    </ScrollView>
  );
}

// Menu déroulant : bouton + liste dans une fenêtre modale
function Dropdown({label,valeur,options,onChange,placeholder,disabled}){
  const [ouvert,setOuvert]=useState(false);
  const choisi=options.find(o=>o.key===valeur);
  return(
    <>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity disabled={disabled} onPress={()=>setOuvert(true)} style={[s.select,disabled&&{opacity:0.4}]}>
        <Text style={[s.selectTxt,!choisi&&{color:MUTED}]} numberOfLines={1}>
          {choisi?choisi.label:(placeholder||'Choisir')}
        </Text>
        <Text style={s.selectFleche}>▾</Text>
      </TouchableOpacity>
      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={()=>setOuvert(false)}>
        <TouchableOpacity style={s.modalFond} activeOpacity={1} onPress={()=>setOuvert(false)}>
          <View style={s.modalBoite}>
            <Text style={s.modalTitre}>{label}</Text>
            <ScrollView>
              {options.map(o=>(
                <TouchableOpacity key={String(o.key)} onPress={()=>{onChange(o.key);setOuvert(false);}}
                  style={[s.option,o.key===valeur&&s.optionActive]}>
                  <Text style={[s.optionTxt,o.key===valeur&&s.optionTxtActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function Carte({titre,valeur,sous,accent}){
  return(
    <View style={[s.carte,accent&&{borderColor:GOLD}]}>
      <Text style={s.carteTitre}>{titre}</Text>
      <Text style={[s.carteValeur,accent&&{color:GOLD}]}>{valeur}</Text>
      <Text style={s.carteSous}>{sous}</Text>
    </View>
  );
}

export default function SimulateurScreen(){
  const [origine,setOrigine]=useState('BR');
  const [achat,setAchat]=useState('15');
  const [ml,setMl]=useState(750);
  const [type,setType]=useState('Tranquille');
  const [alcool,setAlcool]=useState('13');
  const [ncmId,setNcmId]=useState(null);
  const [paysKey,setPaysKey]=useState(null);
  const [regionKey,setRegionKey]=useState(null);
  const [appellation,setAppellation]=useState(null);
  const [etat,setEtat]=useState('SC');
  const [mmin,setMmin]=useState('30');
  const [mmax,setMmax]=useState('60');

  const [catalogue,setCatalogue]=useState([]);
  const [ncmList,setNcmList]=useState([]);
  const [res,setRes]=useState(null);
  const [loading,setLoading]=useState(false);
  const [erreur,setErreur]=useState('');
  const [similaires,setSimilaires]=useState([]);
  const [loadingSim,setLoadingSim]=useState(false);

  // Pays, régions et appellations : uniquement ceux des vins du catalogue
  useEffect(()=>{
    supabase.from('Catalogue App').select('pays,region,appellation').then(({data,error})=>{
      if(!error&&data)setCatalogue(data);
    });
    supabase.rpc('simulateur_references').then(({data,error})=>{
      if(!error&&data)setNcmList(data.ncm||[]);
    });
  },[]);

  // Cascade : Pays → Région → Appellation (valeurs normalisées en majuscules pour fusionner les doublons)
  const paysOptions=useMemo(()=>{
    const m=new Map();
    catalogue.forEach(r=>{
      if(!r.pays)return;
      const k=r.pays.trim().toUpperCase();
      if(!m.has(k))m.set(k,{key:k,label:titre(r.pays)});
    });
    return [...m.values()].sort((a,b)=>a.label.localeCompare(b.label,'fr'));
  },[catalogue]);

  const regionOptions=useMemo(()=>{
    if(!paysKey)return [];
    const m=new Map();
    catalogue.forEach(r=>{
      if(!r.region||!r.pays||r.pays.trim().toUpperCase()!==paysKey)return;
      const k=r.region.trim().toUpperCase();
      if(!m.has(k))m.set(k,{key:k,label:titre(r.region)});
    });
    return [...m.values()].sort((a,b)=>a.label.localeCompare(b.label,'fr'));
  },[catalogue,paysKey]);

  const appellationOptions=useMemo(()=>{
    if(!paysKey||!regionKey)return [];
    const m=new Map();
    catalogue.forEach(r=>{
      if(!r.appellation||!r.pays||!r.region)return;
      if(r.pays.trim().toUpperCase()!==paysKey||r.region.trim().toUpperCase()!==regionKey)return;
      const k=r.appellation.trim();
      if(!m.has(k))m.set(k,{key:k,label:k});
    });
    return [...m.values()].sort((a,b)=>a.label.localeCompare(b.label,'fr'));
  },[catalogue,paysKey,regionKey]);

  const ncmChoisi=ncmList.find(n=>n.id===ncmId);

  // Simulation de prix
  useEffect(()=>{
    const a=parseNum(achat);
    if(origine!=='BR'||!a||a<=0){setRes(null);setErreur('');return;}
    const t=setTimeout(async()=>{
      setLoading(true);
      setErreur('');
      const{data,error}=await supabase.rpc('simuler_prix_brl',{
        p_achat_eur:a,
        p_ml:ml,
        p_etat:etat,
        p_marge_min:parseNum(mmin)??30,
        p_marge_max:parseNum(mmax)??60,
        p_ncm_id:ncmId,
      });
      setLoading(false);
      if(error){setErreur(error.message);setRes(null);return;}
      setRes(Array.isArray(data)?data[0]:data);
    },400);
    return()=>clearTimeout(t);
  },[origine,achat,ml,etat,mmin,mmax,ncmId]);

  // Produits similaires (±25 % sur le prix d'achat)
  useEffect(()=>{
    const a=parseNum(achat);
    if(origine!=='BR'||!a||a<=0){setSimilaires([]);return;}
    const t=setTimeout(async()=>{
      setLoadingSim(true);
      const{data,error}=await supabase.rpc('produits_similaires',{
        p_prix_achat:a,
        p_tolerance:TOLERANCE,
        p_appellation:appellation,
        p_region:null,
        p_type:type,
        p_limit:10,
      });
      setLoadingSim(false);
      setSimilaires(error?[]:(data||[]));
    },400);
    return()=>clearTimeout(t);
  },[origine,achat,appellation,type]);

  return(
    <ScrollView style={s.container} contentContainerStyle={{paddingBottom:100}}>
      <View style={s.header}>
        <Text style={s.marque}>MAISON 1822</Text>
        <Text style={s.titre}>Simulateur de prix</Text>
        <Text style={s.sousTitre}>Prix d'achat en euros · Simulation uniquement</Text>
      </View>

      <View style={s.onglets}>
        {[{code:'BR',label:'BR · Brésil'},{code:'FR',label:'FR · France'}].map(o=>(
          <TouchableOpacity key={o.code} onPress={()=>setOrigine(o.code)} style={[s.onglet,origine===o.code&&s.ongletActif]}>
            <Text style={[s.ongletTxt,origine===o.code&&s.ongletTxtActif]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {origine==='FR'?(
        <Text style={s.info}>Origine France : onglet FR — Marché non applicable à cette origine.</Text>
      ):(
        <View style={s.bloc}>
          <Text style={s.label}>Prix d'achat HT départ vignoble (€)</Text>
          <TextInput style={s.input} value={achat} onChangeText={setAchat} keyboardType="decimal-pad" placeholder="ex. 15,00" placeholderTextColor={MUTED}/>
          <Text style={s.aide}>Devise de saisie : EUR · Tolérance produits similaires ±{TOLERANCE} %</Text>

          <Text style={s.label}>Type de produit</Text>
          <ChipsScroll>
            {TYPES.map(t=>(<Chip key={t} label={t} active={type===t} onPress={()=>setType(t)}/>))}
          </ChipsScroll>

          <Text style={s.label}>Taux d'alcool (%)</Text>
          <TextInput style={s.input} value={alcool} onChangeText={setAlcool} keyboardType="decimal-pad"/>

          <Dropdown label="Code NCM" valeur={ncmId} placeholder="Par défaut"
            options={[{key:null,label:'Par défaut'},...ncmList.map(n=>({key:n.id,label:n.code}))]}
            onChange={setNcmId}/>
          {!!ncmChoisi&&<Text style={s.aide}>{ncmChoisi.description}</Text>}

          <Dropdown label="Pays" valeur={paysKey} placeholder="Choisir un pays"
            options={[{key:null,label:'Aucun'},...paysOptions]}
            onChange={k=>{setPaysKey(k);setRegionKey(null);setAppellation(null);}}/>

          <Dropdown label="Région" valeur={regionKey} placeholder="Choisir une région" disabled={!paysKey}
            options={[{key:null,label:'Toutes'},...regionOptions]}
            onChange={k=>{setRegionKey(k);setAppellation(null);}}/>

          <Dropdown label="Appellation" valeur={appellation} placeholder="Choisir une appellation" disabled={!regionKey}
            options={[{key:null,label:'Toutes'},...appellationOptions]}
            onChange={setAppellation}/>

          <Text style={s.label}>Format de bouteille</Text>
          <View style={s.ligne}>
            {FORMATS.map(f=>(<Chip key={f} label={`${f} ml`} active={ml===f} onPress={()=>setMl(f)}/>))}
          </View>

          <Dropdown label="État de destination" valeur={etat} placeholder="Choisir un état"
            options={ETATS.map(e=>({key:e,label:e}))}
            onChange={setEtat}/>

          <View style={{flexDirection:'row',gap:12,marginTop:12}}>
            <View style={{flex:1}}>
              <Text style={s.label}>Marge nette minimum (%)</Text>
              <TextInput style={s.input} value={mmin} onChangeText={setMmin} keyboardType="decimal-pad"/>
            </View>
            <View style={{flex:1}}>
              <Text style={s.label}>Marge nette maximum (%)</Text>
              <TextInput style={s.input} value={mmax} onChangeText={setMmax} keyboardType="decimal-pad"/>
            </View>
          </View>
        </View>
      )}

      {origine==='BR'&&loading&&<ActivityIndicator color={GOLD} style={{marginTop:20}}/>}
      {origine==='BR'&&!!erreur&&<Text style={s.erreur}>{erreur}</Text>}

      {origine==='BR'&&res&&!loading&&(
        <View style={s.grille}>
          <Carte titre="PRIX RENDU HT" valeur={`R$ ${fmt(res.rendu_ht_brl)}`} sous="Hors ICMS"/>
          <Carte titre="PRIX RENDU TTC" valeur={`R$ ${fmt(res.rendu_ttc_brl)}`} sous={`ICMS ${res.icms_pct} %`}/>
          <Carte titre="PRIX PUBLIC MINIMUM" valeur={`R$ ${fmt(res.prix_public_min_ttc)}`} sous={`Marge nette ${mmin} %`} accent/>
          <Carte titre="PRIX PUBLIC MAXIMUM" valeur={`R$ ${fmt(res.prix_public_max_ttc)}`} sous={`Marge nette ${mmax} %`} accent/>
        </View>
      )}

      {origine==='BR'&&res&&(
        <>
          <Text style={s.note}>
            Commission utilisée : {fmt(res.commission_pct)} %. Marge nette = (1 − rendu TTC ÷ prix public TTC) × 100 − commission.
          </Text>
          <Text style={s.note}>
            Formule : CIF (achat + marge logistique + fret + assurance + douane, converti en R$) + II + IPI + PIS + COFINS + frais de destination, puis ICMS ({res.icms_pct} %). Alcool {alcool} %.
          </Text>
        </>
      )}

      {origine==='BR'&&(
        <View style={s.bloc}>
          <Text style={s.titreSection}>Produits similaires</Text>
          <Text style={s.aide}>
            Prix d'achat compris entre {parseNum(achat)?fmt(parseNum(achat)*(1-TOLERANCE/100)):'—'} € et {parseNum(achat)?fmt(parseNum(achat)*(1+TOLERANCE/100)):'—'} € (±{TOLERANCE} %)
          </Text>
          {loadingSim&&<ActivityIndicator color={GOLD} style={{marginTop:10}}/>}
          {!loadingSim&&similaires.length===0&&<Text style={s.aide}>Aucun produit dans cette tranche.</Text>}
          {similaires.map(p=>(
            <View key={p.produit_id} style={s.similaire}>
              <Text style={s.simProducteur}>{p.producteur}</Text>
              <Text style={s.simNom}>{p.nom}{p.millesime?` · ${p.millesime}`:''}</Text>
              <Text style={s.simDetail}>
                {p.appellation||'—'} · Achat {fmt(p.prix_achat)} € · Public R$ {fmt(p.prix_public_ttc)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text style={s.pied}>Simulation uniquement : aucune donnée n'est enregistrée.</Text>
    </ScrollView>
  );
}

const s=StyleSheet.create({
  container:{flex:1,backgroundColor:BG},
  header:{backgroundColor:BG,paddingTop:52,paddingBottom:14,paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:GOLD+'40'},
  marque:{color:GOLD,fontSize:10,letterSpacing:4,fontWeight:'700'},
  titre:{color:WHITE,fontSize:24,fontWeight:'200',letterSpacing:1,marginTop:2},
  sousTitre:{color:MUTED,fontSize:12,marginTop:4},
  onglets:{flexDirection:'row',gap:8,paddingHorizontal:16,paddingTop:14},
  onglet:{flex:1,paddingVertical:10,borderRadius:8,borderWidth:1,borderColor:BORDER,backgroundColor:CARD,alignItems:'center'},
  ongletActif:{backgroundColor:GOLD,borderColor:GOLD},
  ongletTxt:{color:WHITE,fontSize:13,fontWeight:'600'},
  ongletTxtActif:{color:NAVY,fontWeight:'700'},
  info:{color:MUTED,fontSize:13,paddingHorizontal:16,marginTop:20,fontStyle:'italic'},
  bloc:{paddingHorizontal:16,paddingTop:16},
  label:{color:MUTED,fontSize:12,marginBottom:6,marginTop:12},
  aide:{color:MUTED,fontSize:11,marginTop:6,lineHeight:16},
  titreSection:{color:GOLD,fontSize:14,fontWeight:'700',marginBottom:4},
  input:{backgroundColor:CARD,color:WHITE,borderWidth:1,borderColor:BORDER,borderRadius:8,paddingHorizontal:14,paddingVertical:12,fontSize:16},
  select:{backgroundColor:CARD,borderWidth:1,borderColor:BORDER,borderRadius:8,paddingHorizontal:14,paddingVertical:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  selectTxt:{color:WHITE,fontSize:16,flex:1,marginRight:8},
  selectFleche:{color:GOLD,fontSize:16},
  modalFond:{flex:1,backgroundColor:'#000000AA',justifyContent:'center',padding:24},
  modalBoite:{backgroundColor:CARD,borderRadius:12,borderWidth:1,borderColor:BORDER,padding:14,maxHeight:'80%'},
  modalTitre:{color:GOLD,fontSize:13,fontWeight:'700',letterSpacing:1,marginBottom:10},
  option:{paddingVertical:12,paddingHorizontal:10,borderRadius:8},
  optionActive:{backgroundColor:GOLD},
  optionTxt:{color:WHITE,fontSize:15},
  optionTxtActive:{color:NAVY,fontWeight:'700'},
  ligne:{flexDirection:'row',flexWrap:'wrap',gap:8},
  chip:{paddingHorizontal:12,paddingVertical:7,borderRadius:16,borderWidth:1,borderColor:BORDER,backgroundColor:CARD},
  chipActive:{backgroundColor:GOLD,borderColor:GOLD},
  chipTxt:{color:WHITE,fontSize:13,fontWeight:'600'},
  chipTxtActive:{color:NAVY,fontWeight:'700'},
  grille:{flexDirection:'row',flexWrap:'wrap',gap:12,paddingHorizontal:16,marginTop:16},
  carte:{width:'47%',backgroundColor:CARD,borderRadius:10,borderWidth:1,borderColor:BORDER,padding:14},
  carteTitre:{color:MUTED,fontSize:11,letterSpacing:1,fontWeight:'700'},
  carteValeur:{color:WHITE,fontSize:20,fontWeight:'700',marginTop:8},
  carteSous:{color:MUTED,fontSize:12,marginTop:6},
  note:{color:MUTED,fontSize:12,paddingHorizontal:16,marginTop:16,lineHeight:18},
  erreur:{color:ERROR,fontSize:13,paddingHorizontal:16,marginTop:16},
  similaire:{backgroundColor:CARD,borderRadius:8,borderWidth:1,borderColor:BORDER,padding:12,marginTop:8},
  simProducteur:{color:GOLD,fontSize:11,letterSpacing:1,fontWeight:'700'},
  simNom:{color:WHITE,fontSize:15,fontWeight:'600',marginTop:3},
  simDetail:{color:MUTED,fontSize:12,marginTop:4},
  pied:{color:MUTED,fontSize:11,fontStyle:'italic',paddingHorizontal:16,marginTop:20},
});

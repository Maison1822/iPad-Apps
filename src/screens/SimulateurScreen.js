import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

const BG='#1C1C1E',CARD='#2C2C2E',GOLD='#C8A45A',WHITE='#FFFFFF',MUTED='#8E8E93',BORDER='#3A3A3C',NAVY='#0F1E3C',ERROR='#E57373';
const FORMATS=[375,500,750,1500];
const ETATS=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

function fmt(v){
  if(v==null||v==='')return '—';
  return Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function Chip({label,active,onPress}){
  return(
    <TouchableOpacity onPress={onPress} style={[s.chip,active&&s.chipActive]}>
      <Text style={[s.chipTxt,active&&s.chipTxtActive]}>{label}</Text>
    </TouchableOpacity>
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
  const [achat,setAchat]=useState('15');
  const [ml,setMl]=useState(750);
  const [etat,setEtat]=useState('SC');
  const [mmin,setMmin]=useState('30');
  const [mmax,setMmax]=useState('60');
  const [res,setRes]=useState(null);
  const [loading,setLoading]=useState(false);
  const [erreur,setErreur]=useState('');

  useEffect(()=>{
    const a=parseFloat(String(achat).replace(',','.'));
    if(!a||a<=0){setRes(null);setErreur('');return;}
    const t=setTimeout(async()=>{
      setLoading(true);
      setErreur('');
      const{data,error}=await supabase.rpc('simuler_prix_brl',{
        p_achat_eur:a,
        p_ml:ml,
        p_etat:etat,
        p_marge_min:parseFloat(String(mmin).replace(',','.'))||30,
        p_marge_max:parseFloat(String(mmax).replace(',','.'))||60,
      });
      setLoading(false);
      if(error){setErreur(error.message);setRes(null);return;}
      setRes(Array.isArray(data)?data[0]:data);
    },400);
    return()=>clearTimeout(t);
  },[achat,ml,etat,mmin,mmax]);

  return(
    <ScrollView style={s.container} contentContainerStyle={{paddingBottom:100}}>
      <View style={s.header}>
        <Text style={s.marque}>MAISON 1822</Text>
        <Text style={s.titre}>Simulateur de prix</Text>
        <Text style={s.sousTitre}>Origine Brésil · Prix d'achat en euros</Text>
      </View>

      <View style={s.bloc}>
        <Text style={s.label}>Prix d'achat HT départ vignoble (€)</Text>
        <TextInput style={s.input} value={achat} onChangeText={setAchat} keyboardType="decimal-pad" placeholder="ex. 15,00" placeholderTextColor={MUTED}/>

        <Text style={s.label}>Format de bouteille</Text>
        <View style={s.ligne}>
          {FORMATS.map(f=>(<Chip key={f} label={`${f} ml`} active={ml===f} onPress={()=>setMl(f)}/>))}
        </View>

        <Text style={s.label}>État de destination</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
          {ETATS.map(e=>(<Chip key={e} label={e} active={etat===e} onPress={()=>setEtat(e)}/>))}
        </ScrollView>

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

      {loading&&<ActivityIndicator color={GOLD} style={{marginTop:20}}/>}
      {!!erreur&&<Text style={s.erreur}>{erreur}</Text>}

      {res&&!loading&&(
        <View style={s.grille}>
          <Carte titre="PRIX RENDU HT" valeur={`R$ ${fmt(res.rendu_ht_brl)}`} sous="Hors ICMS"/>
          <Carte titre="PRIX RENDU TTC" valeur={`R$ ${fmt(res.rendu_ttc_brl)}`} sous={`ICMS ${res.icms_pct} %`}/>
          <Carte titre="PRIX PUBLIC MINIMUM" valeur={`R$ ${fmt(res.prix_public_min_ttc)}`} sous={`Marge nette ${mmin} %`} accent/>
          <Carte titre="PRIX PUBLIC MAXIMUM" valeur={`R$ ${fmt(res.prix_public_max_ttc)}`} sous={`Marge nette ${mmax} %`} accent/>
        </View>
      )}

      {res&&(
        <Text style={s.note}>
          Commission utilisée : {fmt(res.commission_pct)} %. Marge nette = (1 − rendu TTC ÷ prix public TTC) × 100 − commission.
        </Text>
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
  bloc:{paddingHorizontal:16,paddingTop:16},
  label:{color:MUTED,fontSize:12,marginBottom:6,marginTop:4},
  input:{backgroundColor:CARD,color:WHITE,borderWidth:1,borderColor:BORDER,borderRadius:8,paddingHorizontal:14,paddingVertical:12,fontSize:16},
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
  pied:{color:MUTED,fontSize:11,fontStyle:'italic',paddingHorizontal:16,marginTop:20},
});

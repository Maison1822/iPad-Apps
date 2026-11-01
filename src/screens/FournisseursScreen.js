import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';

const BG='#1C1C1E',CARD='#2C2C2E',GOLD='#C8A45A',WHITE='#FFFFFF',MUTED='#8E8E93',BORDER='#3A3A3C',NAVY='#0F1E3C';
const ETAPE_CLR={
  nouveau:'#8E8E93',decouverte:'#8E8E93',
  demande_tarifs:'#4A90D9',tarifs_recus:'#4A90D9',demande_echantillons:'#4A90D9',echantillons_recus:'#4A90D9',
  degustation:'#E67E22',validation:'#C8A45A',integration:'#2D7A4F',refuse:'#7A2138',suspendu:'#555',
};
const FILTRES=['Tous','En cours','Intégrés','Suspendus'];
const NOTES=[1,2,3,4,5];

const couleurEtape=code=>ETAPE_CLR[code]||MUTED;

// Ligne de liste : composant hors de l'écran, pour éviter de le recréer à chaque rendu
function LigneFournisseur({ item, code, date, libelle, onPress }){
  const couleur=couleurEtape(code);
  return(
    <TouchableOpacity style={s.row} onPress={()=>onPress(item)} activeOpacity={0.7}>
      <View style={{flex:1}}>
        <Text style={s.rowNom} numberOfLines={1}>{item.Domaine||'—'}</Text>
        <Text style={{color:MUTED,fontSize:11,marginTop:2}}>{item.Pays||''}{date?` · ${date}`:''}</Text>
      </View>
      <View style={[s.badge,{borderColor:couleur,backgroundColor:couleur+'30'}]}>
        <Text style={{color:couleur,fontSize:11,fontWeight:'600'}}>{libelle}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Fiche modale : composant hors de l'écran, reçoit ses données en propriétés
function FicheFournisseur({ selected, etapes, etapeChoisie, setEtapeChoisie, dateTxt, setDateTxt, note, setNote, commentaire, setCommentaire, saving, historique, libelleEtape, onFermer, onEnregistrer }){
  if(!selected)return null;
  return(
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
      <View style={{flex:1,backgroundColor:BG}}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitre} numberOfLines={1}>{selected.Domaine}</Text>
          <TouchableOpacity onPress={onFermer}>
            <Text style={{color:GOLD,fontSize:24}}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{padding:20,paddingBottom:60}}>
          <Text style={s.sectionTitre}>Étape</Text>
          <View style={{gap:8}}>
            {etapes.map(et=>(
              <TouchableOpacity key={et.code} onPress={()=>setEtapeChoisie(et.code)}
                style={[s.etapeOption,etapeChoisie===et.code&&{borderColor:GOLD,backgroundColor:GOLD+'20'}]}>
                <Text style={{color:etapeChoisie===et.code?GOLD:WHITE,fontSize:14,fontWeight:etapeChoisie===et.code?'700':'400'}}>
                  {et.ordre}. {et.libelle}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.sectionTitre,{marginTop:20}]}>Date (AAAA-MM-JJ, facultatif)</Text>
          <TextInput style={s.input} placeholder="2026-11-01" placeholderTextColor={MUTED}
            value={dateTxt} onChangeText={setDateTxt} autoCapitalize="none"/>

          {etapeChoisie==='degustation'&&(
            <>
              <Text style={[s.sectionTitre,{marginTop:20}]}>Note sur 5</Text>
              <View style={{flexDirection:'row',gap:10}}>
                {NOTES.map(n=>(
                  <TouchableOpacity key={n} onPress={()=>setNote(n)}
                    style={[s.noteBtn,note===n&&{backgroundColor:GOLD,borderColor:GOLD}]}>
                    <Text style={{color:note===n?NAVY:WHITE,fontWeight:'700'}}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={[s.sectionTitre,{marginTop:20}]}>Commentaire</Text>
          <TextInput style={[s.input,{minHeight:80,textAlignVertical:'top'}]} multiline placeholder="Facultatif"
            placeholderTextColor={MUTED} value={commentaire} onChangeText={setCommentaire}/>

          <TouchableOpacity style={[s.boutonSave,(!etapeChoisie||saving)&&{opacity:0.5}]}
            onPress={onEnregistrer} disabled={!etapeChoisie||saving}>
            {saving?<ActivityIndicator color={BG}/>:<Text style={s.boutonSaveTxt}>Enregistrer l'étape</Text>}
          </TouchableOpacity>

          <Text style={[s.sectionTitre,{marginTop:28}]}>Historique</Text>
          {historique.length===0&&<Text style={{color:MUTED,fontSize:13}}>Aucun historique.</Text>}
          {historique.map(h=>(
            <View key={h.id} style={s.histoLigne}>
              <Text style={{color:couleurEtape(h.etape_code),fontSize:13,fontWeight:'700'}}>{libelleEtape(h.etape_code)}</Text>
              <Text style={{color:MUTED,fontSize:12,marginTop:2}}>
                {h.date_etape||new Date(h.cree_le).toLocaleDateString('fr-FR')}
                {h.note_sur_5!=null?` · ${h.note_sur_5}/5`:''}
              </Text>
              {!!h.commentaire&&<Text style={{color:WHITE,fontSize:13,marginTop:4}}>{h.commentaire}</Text>}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function FournisseursScreen(){
  const [fournisseurs,setFournisseurs]=useState([]);
  const [suivis,setSuivis]=useState({});
  const [etapes,setEtapes]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [filtre,setFiltre]=useState('Tous');
  const [selected,setSelected]=useState(null);
  const [historique,setHistorique]=useState([]);
  const [etapeChoisie,setEtapeChoisie]=useState(null);
  const [dateTxt,setDateTxt]=useState('');
  const [note,setNote]=useState(null);
  const [commentaire,setCommentaire]=useState('');
  const [saving,setSaving]=useState(false);

  useEffect(()=>{charger();},[]);

  async function charger(){
    setLoading(true);
    const [f,s2,e]=await Promise.all([
      supabase.from('Fournisseurs').select('*').order('Domaine'),
      supabase.from('Suivi Fournisseurs').select('*'),
      supabase.from('Etapes Fournisseurs').select('*').order('ordre'),
    ]);
    const err=f.error||s2.error||e.error;
    if(err)Alert.alert('Erreur',err.message);
    setFournisseurs(f.data||[]);
    setSuivis(Object.fromEntries((s2.data||[]).map(x=>[x.fournisseur_id,x])));
    setEtapes(e.data||[]);
    setLoading(false);
  }

  const libelleEtape=code=>etapes.find(x=>x.code===code)?.libelle||'Non suivi';

  const liste=useMemo(()=>{
    const q=search.toLowerCase();
    return fournisseurs.filter(f=>{
      const code=suivis[f.id]?.etape_code||null;
      if(filtre==='En cours'&&(!code||['integration','refuse','suspendu'].includes(code)))return false;
      if(filtre==='Intégrés'&&code!=='integration')return false;
      if(filtre==='Suspendus'&&!['suspendu','refuse'].includes(code))return false;
      if(search&&!(f.Domaine||'').toLowerCase().includes(q))return false;
      return true;
    });
  },[fournisseurs,suivis,filtre,search]);

  async function ouvrir(f){
    const cur=suivis[f.id];
    setSelected(f);
    setEtapeChoisie(cur?.etape_code||null);
    setDateTxt(cur?.date_etape||'');
    setNote(null);
    setCommentaire('');
    setHistorique([]);
    const{data,error}=await supabase.from('Historique Etapes Fournisseurs').select('*').eq('fournisseur_id',f.id).order('cree_le',{ascending:false});
    if(error)Alert.alert('Erreur',error.message);
    else setHistorique(data||[]);
  }

  function fermer(){
    setSelected(null);
  }

  async function enregistrer(){
    if(!selected||!etapeChoisie)return;
    if(dateTxt&&!/^\d{4}-\d{2}-\d{2}$/.test(dateTxt)){
      Alert.alert('Date','Format attendu : AAAA-MM-JJ');
      return;
    }
    setSaving(true);
    const date=dateTxt||null;
    const{error:e1}=await supabase.from('Suivi Fournisseurs').upsert(
      {fournisseur_id:selected.id,etape_code:etapeChoisie,date_etape:date,maj:new Date().toISOString()},
      {onConflict:'fournisseur_id'}
    );
    if(e1){setSaving(false);Alert.alert('Erreur',e1.message);return;}
    const{error:e2}=await supabase.from('Historique Etapes Fournisseurs').insert(
      {fournisseur_id:selected.id,etape_code:etapeChoisie,date_etape:date,note_sur_5:note,commentaire:commentaire||null}
    );
    setSaving(false);
    if(e2){Alert.alert('Erreur',e2.message);return;}
    setSuivis(prev=>({...prev,[selected.id]:{fournisseur_id:selected.id,etape_code:etapeChoisie,date_etape:date}}));
    setSelected(null);
  }

  return(
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.marque}>MAISON 1822</Text>
        <Text style={s.titre}>Fournisseurs</Text>
      </View>

      <View style={{paddingHorizontal:16,paddingVertical:8}}>
        <TextInput style={s.searchInput} placeholder="Rechercher..." placeholderTextColor={MUTED} value={search} onChangeText={setSearch}/>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0}}
        contentContainerStyle={{paddingHorizontal:16,paddingBottom:8,gap:8,alignItems:'center'}}>
        {FILTRES.map(f=>(
          <TouchableOpacity key={f} style={[s.chip,filtre===f&&s.chipActive]} onPress={()=>setFiltre(f)}>
            <Text style={[s.chipTxt,filtre===f&&s.chipTxtActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={{paddingHorizontal:20,paddingBottom:4,fontSize:11,color:MUTED}}>
        {liste.length} fournisseur{liste.length>1?'s':''}
      </Text>

      {loading
        ?<ActivityIndicator color={GOLD} size="large" style={{marginTop:60}}/>
        :<FlatList
          style={{flex:1}}
          data={liste}
          keyExtractor={item=>item.id}
          ItemSeparatorComponent={()=><View style={{height:1,backgroundColor:BORDER}}/>}
          contentContainerStyle={{paddingBottom:100}}
          renderItem={({item})=>(
            <LigneFournisseur
              item={item}
              code={suivis[item.id]?.etape_code||null}
              date={suivis[item.id]?.date_etape}
              libelle={libelleEtape(suivis[item.id]?.etape_code||null)}
              onPress={ouvrir}
            />
          )}
        />
      }

      <FicheFournisseur
        selected={selected}
        etapes={etapes}
        etapeChoisie={etapeChoisie}
        setEtapeChoisie={setEtapeChoisie}
        dateTxt={dateTxt}
        setDateTxt={setDateTxt}
        note={note}
        setNote={setNote}
        commentaire={commentaire}
        setCommentaire={setCommentaire}
        saving={saving}
        historique={historique}
        libelleEtape={libelleEtape}
        onFermer={fermer}
        onEnregistrer={enregistrer}
      />
    </View>
  );
}

const s=StyleSheet.create({
  container:{flex:1,backgroundColor:BG},
  header:{backgroundColor:BG,paddingTop:52,paddingBottom:14,paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:GOLD+'40'},
  marque:{color:GOLD,fontSize:10,letterSpacing:4,fontWeight:'700'},
  titre:{color:WHITE,fontSize:24,fontWeight:'200',letterSpacing:1,marginTop:2},
  searchInput:{backgroundColor:CARD,borderRadius:8,paddingHorizontal:16,paddingVertical:10,fontSize:15,color:WHITE,borderWidth:1,borderColor:BORDER},
  chip:{paddingHorizontal:12,paddingVertical:6,borderRadius:16,borderWidth:1,borderColor:BORDER,backgroundColor:CARD},
  chipActive:{backgroundColor:GOLD,borderColor:GOLD},
  chipTxt:{color:WHITE,fontSize:12,fontWeight:'600'},
  chipTxtActive:{color:NAVY,fontWeight:'700'},
  row:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:12,backgroundColor:CARD,gap:10},
  rowNom:{fontSize:14,fontWeight:'600',color:WHITE},
  badge:{borderRadius:10,paddingHorizontal:8,paddingVertical:3,borderWidth:1},
  modalHeader:{paddingTop:20,paddingHorizontal:20,paddingBottom:16,borderBottomWidth:1,borderBottomColor:BORDER,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  modalTitre:{color:GOLD,fontSize:18,fontWeight:'700',flex:1,marginRight:12},
  sectionTitre:{color:GOLD,fontSize:12,textTransform:'uppercase',letterSpacing:1,marginBottom:8},
  etapeOption:{paddingVertical:10,paddingHorizontal:12,borderRadius:8,borderWidth:1,borderColor:BORDER,backgroundColor:CARD},
  input:{backgroundColor:CARD,borderRadius:8,paddingHorizontal:14,paddingVertical:12,fontSize:15,color:WHITE,borderWidth:1,borderColor:BORDER},
  noteBtn:{width:48,height:48,borderRadius:24,borderWidth:1,borderColor:BORDER,backgroundColor:CARD,alignItems:'center',justifyContent:'center'},
  boutonSave:{backgroundColor:GOLD,borderRadius:8,paddingVertical:14,alignItems:'center',marginTop:24},
  boutonSaveTxt:{color:NAVY,fontWeight:'700',fontSize:15},
  histoLigne:{paddingVertical:10,borderBottomWidth:1,borderBottomColor:BORDER},
});

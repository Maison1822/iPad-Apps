import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { BoutonsContact } from '../lib/contact';
import CarnetVisite from '../components/CarnetVisite';

const BG='#1C1C1E',CARD='#2C2C2E',GOLD='#C8A45A',WHITE='#FFFFFF',MUTED='#8E8E93',BORDER='#3A3A3C',NAVY='#0F1E3C',RED='#7A2138';
const ETAPE_CLR={
  nouveau:'#8E8E93',decouverte:'#8E8E93',
  demande_tarifs:'#4A90D9',tarifs_recus:'#4A90D9',demande_echantillons:'#4A90D9',echantillons_recus:'#4A90D9',
  degustation:'#E67E22',validation:'#C8A45A',integration:'#2D7A4F',refuse:'#7A2138',suspendu:'#555',
};
const NOTES=[1,2,3,4,5];

// Champs modifiables de la fiche fournisseur (colonne de la table -> libellé, clavier)
const CHAMPS_COORD=[
  {cle:'Adresse',label:'Adresse',multiline:true},
  {cle:'Pays',label:'Pays'},
  {cle:'Téléphone',label:'Téléphone',clavier:'phone-pad'},
  {cle:'Email',label:'E-mail',clavier:'email-address'},
  {cle:'Site web',label:'Site web',clavier:'url'},
  {cle:'Notes',label:'Notes',multiline:true},
];
const CONTACT_VIDE={id:null,nom:'',fonction:'',email:'',telephone:'',whatsapp:'',principal:false};

const couleurEtape=code=>ETAPE_CLR[code]||MUTED;
const vide=v=>(v==null||String(v).trim()==='')?null:String(v).trim();

// Ligne de liste : composant hors de l'écran, pour ne pas être recréé à chaque rendu
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

function Champ({ label, valeur, onChange, clavier, multiline }){
  return(
    <View style={{marginBottom:12}}>
      <Text style={s.labelChamp}>{label}</Text>
      <TextInput style={[s.input,multiline&&{minHeight:70,textAlignVertical:'top'}]}
        value={valeur} onChangeText={onChange} multiline={!!multiline}
        keyboardType={clavier||'default'} autoCapitalize={clavier?'none':'sentences'} autoCorrect={false}
        placeholderTextColor={MUTED}/>
    </View>
  );
}

// Fiche : composant hors de l'écran, avec son propre état (remise à zéro à chaque fournisseur via key)
function FicheFournisseur({ selected, etapes, suivi, libelleEtape, onFermer, onSuiviEnregistre, onFournisseurModifie }){
  const [etapeChoisie,setEtapeChoisie]=useState(suivi?.etape_code||null);
  const [dateTxt,setDateTxt]=useState(suivi?.date_etape||'');
  const [note,setNote]=useState(null);
  const [commentaire,setCommentaire]=useState('');
  const [saving,setSaving]=useState(false);
  const [historique,setHistorique]=useState([]);
  const [coord,setCoord]=useState(()=>Object.fromEntries(CHAMPS_COORD.map(c=>[c.cle,selected[c.cle]||''])));
  const [savingCoord,setSavingCoord]=useState(false);
  const [contacts,setContacts]=useState([]);
  const [contactForm,setContactForm]=useState(null);
  const [savingContact,setSavingContact]=useState(false);

  useEffect(()=>{
    let annule=false;
    (async()=>{
      const [h,c]=await Promise.all([
        supabase.from('Historique Etapes Fournisseurs').select('*').eq('fournisseur_id',selected.id).order('cree_le',{ascending:false}),
        supabase.from('Contacts Fournisseurs').select('*').eq('fournisseur_id',selected.id).order('principal',{ascending:false}).order('nom'),
      ]);
      if(annule)return;
      if(h.error||c.error)Alert.alert('Erreur',(h.error||c.error).message);
      setHistorique(h.data||[]);
      setContacts(c.data||[]);
    })();
    return()=>{annule=true;};
  },[selected.id]);

  async function enregistrerEtape(){
    if(!etapeChoisie)return;
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
    onSuiviEnregistre(selected.id,{fournisseur_id:selected.id,etape_code:etapeChoisie,date_etape:date});
    onFermer();
  }

  async function enregistrerCoord(){
    const modifs={};
    CHAMPS_COORD.forEach(c=>{
      const nouveau=vide(coord[c.cle]);
      if(nouveau!==vide(selected[c.cle]))modifs[c.cle]=nouveau;
    });
    if(Object.keys(modifs).length===0){Alert.alert('Coordonnées','Aucune modification.');return;}
    setSavingCoord(true);
    const{data,error}=await supabase.from('Fournisseurs').update(modifs).eq('id',selected.id).select().maybeSingle();
    setSavingCoord(false);
    if(error){Alert.alert('Erreur',error.message);return;}
    if(!data){Alert.alert('Erreur','Modification refusée (droits insuffisants).');return;}
    onFournisseurModifie(data);
    Alert.alert('Coordonnées','Enregistré.');
  }

  async function enregistrerContact(){
    const f=contactForm;
    if(!vide(f.nom)){Alert.alert('Correspondant','Le nom est obligatoire.');return;}
    setSavingContact(true);
    const valeurs={
      fournisseur_id:selected.id,nom:vide(f.nom),fonction:vide(f.fonction),email:vide(f.email),
      telephone:vide(f.telephone),whatsapp:vide(f.whatsapp),principal:!!f.principal,
    };
    const requete=f.id
      ?supabase.from('Contacts Fournisseurs').update({...valeurs,maj:new Date().toISOString()}).eq('id',f.id).select().maybeSingle()
      :supabase.from('Contacts Fournisseurs').insert(valeurs).select().maybeSingle();
    const{data,error}=await requete;
    if(error||!data){setSavingContact(false);Alert.alert('Erreur',error?error.message:'Enregistrement refusé.');return;}
    // un seul correspondant principal par fournisseur
    if(valeurs.principal){
      await supabase.from('Contacts Fournisseurs').update({principal:false}).eq('fournisseur_id',selected.id).neq('id',data.id);
    }
    const{data:liste}=await supabase.from('Contacts Fournisseurs').select('*').eq('fournisseur_id',selected.id).order('principal',{ascending:false}).order('nom');
    setContacts(liste||[]);
    setSavingContact(false);
    setContactForm(null);
  }

  function supprimerContact(c){
    Alert.alert('Supprimer le correspondant',`Supprimer ${c.nom} ?`,[
      {text:'Annuler',style:'cancel'},
      {text:'Supprimer',style:'destructive',onPress:async()=>{
        const{error}=await supabase.from('Contacts Fournisseurs').delete().eq('id',c.id);
        if(error){Alert.alert('Erreur',error.message);return;}
        setContacts(prev=>prev.filter(x=>x.id!==c.id));
      }},
    ]);
  }

  return(
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
      <View style={{flex:1,backgroundColor:BG}}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitre} numberOfLines={1}>{selected.Domaine}</Text>
          <TouchableOpacity onPress={onFermer}>
            <Text style={{color:GOLD,fontSize:24}}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{padding:20,paddingBottom:120}} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>

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
            onPress={enregistrerEtape} disabled={!etapeChoisie||saving}>
            {saving?<ActivityIndicator color={BG}/>:<Text style={s.boutonSaveTxt}>Enregistrer l'étape</Text>}
          </TouchableOpacity>

          <Text style={[s.sectionTitre,{marginTop:32}]}>Coordonnées</Text>
          <View style={{marginBottom:12}}>
            <BoutonsContact telephone={selected['Téléphone']} email={selected.Email} pays={selected.Pays}/>
          </View>
          {CHAMPS_COORD.map(c=>(
            <Champ key={c.cle} label={c.label} valeur={coord[c.cle]} clavier={c.clavier} multiline={c.multiline}
              onChange={t=>setCoord(prev=>({...prev,[c.cle]:t}))}/>
          ))}
          <TouchableOpacity style={[s.boutonSave,savingCoord&&{opacity:0.5}]} onPress={enregistrerCoord} disabled={savingCoord}>
            {savingCoord?<ActivityIndicator color={BG}/>:<Text style={s.boutonSaveTxt}>Enregistrer les coordonnées</Text>}
          </TouchableOpacity>

          <Text style={[s.sectionTitre,{marginTop:32}]}>Correspondants</Text>
          {contacts.length===0&&!contactForm&&<Text style={{color:MUTED,fontSize:13,marginBottom:8}}>Aucun correspondant.</Text>}
          {contacts.map(c=>(
            <View key={c.id} style={s.carteContact}>
              <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
                <Text style={{color:WHITE,fontSize:15,fontWeight:'700',flex:1}}>{c.nom}{c.principal?'  ★':''}</Text>
                <TouchableOpacity onPress={()=>setContactForm({...CONTACT_VIDE,...Object.fromEntries(Object.entries(c).map(([k,v])=>[k,v==null?'':v])),principal:!!c.principal})} style={s.lienAction}>
                  <Text style={{color:GOLD,fontSize:13}}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>supprimerContact(c)} style={s.lienAction}>
                  <Text style={{color:'#E06C75',fontSize:13}}>Supprimer</Text>
                </TouchableOpacity>
              </View>
              {!!c.fonction&&<Text style={{color:MUTED,fontSize:12,marginTop:2}}>{c.fonction}</Text>}
              {!!c.email&&<Text style={s.ligneContact}>✉️  {c.email}</Text>}
              {!!c.telephone&&<Text style={s.ligneContact}>📞  {c.telephone}</Text>}
              {!!c.whatsapp&&<Text style={s.ligneContact}>💬  WhatsApp : {c.whatsapp}</Text>}
              <BoutonsContact telephone={c.telephone} whatsapp={c.whatsapp} email={c.email} pays={selected.Pays}/>
            </View>
          ))}

          {contactForm?(
            <View style={[s.carteContact,{borderColor:GOLD}]}>
              <Text style={[s.sectionTitre,{marginBottom:12}]}>{contactForm.id?'Modifier le correspondant':'Nouveau correspondant'}</Text>
              <Champ label="Nom *" valeur={contactForm.nom} onChange={t=>setContactForm(f=>({...f,nom:t}))}/>
              <Champ label="Fonction" valeur={contactForm.fonction} onChange={t=>setContactForm(f=>({...f,fonction:t}))}/>
              <Champ label="E-mail" valeur={contactForm.email} clavier="email-address" onChange={t=>setContactForm(f=>({...f,email:t}))}/>
              <Champ label="Téléphone" valeur={contactForm.telephone} clavier="phone-pad" onChange={t=>setContactForm(f=>({...f,telephone:t}))}/>
              <Champ label="WhatsApp" valeur={contactForm.whatsapp} clavier="phone-pad" onChange={t=>setContactForm(f=>({...f,whatsapp:t}))}/>
              <TouchableOpacity onPress={()=>setContactForm(f=>({...f,principal:!f.principal}))}
                style={[s.etapeOption,contactForm.principal&&{borderColor:GOLD,backgroundColor:GOLD+'20'}]}>
                <Text style={{color:contactForm.principal?GOLD:WHITE,fontSize:14}}>{contactForm.principal?'★ Correspondant principal':'☆ Correspondant principal'}</Text>
              </TouchableOpacity>
              <View style={{flexDirection:'row',gap:10,marginTop:16}}>
                <TouchableOpacity style={[s.boutonSecondaire,{flex:1}]} onPress={()=>setContactForm(null)} disabled={savingContact}>
                  <Text style={{color:WHITE,fontWeight:'600'}}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.boutonSave,{flex:2,marginTop:0},savingContact&&{opacity:0.5}]} onPress={enregistrerContact} disabled={savingContact}>
                  {savingContact?<ActivityIndicator color={BG}/>:<Text style={s.boutonSaveTxt}>Enregistrer</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ):(
            <TouchableOpacity style={s.boutonSecondaire} onPress={()=>setContactForm({...CONTACT_VIDE})}>
              <Text style={{color:GOLD,fontWeight:'700'}}>+ Ajouter un correspondant</Text>
            </TouchableOpacity>
          )}

          <View style={{marginTop:32}}>
            <CarnetVisite type="fournisseur" id={selected.id}/>
          </View>

          <Text style={[s.sectionTitre,{marginTop:32}]}>Historique</Text>
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
  const [filtre,setFiltre]=useState('Tous'); // 'Tous' ou code d'étape
  const [selected,setSelected]=useState(null);

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

  // Nombre de fournisseurs par étape : seules les étapes utilisées deviennent des filtres
  const compteurs=useMemo(()=>{
    const c={};
    fournisseurs.forEach(f=>{const code=suivis[f.id]?.etape_code;if(code)c[code]=(c[code]||0)+1;});
    return c;
  },[fournisseurs,suivis]);

  const filtresEtapes=useMemo(()=>etapes.filter(et=>compteurs[et.code]>0),[etapes,compteurs]);

  useEffect(()=>{
    if(filtre!=='Tous'&&!(compteurs[filtre]>0))setFiltre('Tous');
  },[compteurs,filtre]);

  const liste=useMemo(()=>{
    const q=search.toLowerCase();
    return fournisseurs.filter(f=>{
      if(filtre!=='Tous'&&suivis[f.id]?.etape_code!==filtre)return false;
      if(search&&!(f.Domaine||'').toLowerCase().includes(q))return false;
      return true;
    });
  },[fournisseurs,suivis,filtre,search]);

  function ouvrir(f){
    setSelected(f);
  }

  function fermer(){
    setSelected(null);
  }

  function suiviEnregistre(fid,suivi){
    setSuivis(prev=>({...prev,[fid]:suivi}));
  }

  function fournisseurModifie(ligne){
    setFournisseurs(prev=>prev.map(f=>f.id===ligne.id?ligne:f));
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
        <TouchableOpacity style={[s.chip,filtre==='Tous'&&s.chipActive]} onPress={()=>setFiltre('Tous')}>
          <Text style={[s.chipTxt,filtre==='Tous'&&s.chipTxtActive]}>Tous · {fournisseurs.length}</Text>
        </TouchableOpacity>
        {filtresEtapes.map(et=>(
          <TouchableOpacity key={et.code} style={[s.chip,filtre===et.code&&s.chipActive]} onPress={()=>setFiltre(et.code)}>
            <Text style={[s.chipTxt,filtre===et.code&&s.chipTxtActive]}>{et.libelle} · {compteurs[et.code]}</Text>
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

      {selected&&(
        <FicheFournisseur
          key={selected.id}
          selected={selected}
          etapes={etapes}
          suivi={suivis[selected.id]}
          libelleEtape={libelleEtape}
          onFermer={fermer}
          onSuiviEnregistre={suiviEnregistre}
          onFournisseurModifie={fournisseurModifie}
        />
      )}
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
  labelChamp:{color:MUTED,fontSize:12,marginBottom:4},
  etapeOption:{paddingVertical:10,paddingHorizontal:12,borderRadius:8,borderWidth:1,borderColor:BORDER,backgroundColor:CARD},
  input:{backgroundColor:CARD,borderRadius:8,paddingHorizontal:14,paddingVertical:12,fontSize:15,color:WHITE,borderWidth:1,borderColor:BORDER},
  noteBtn:{width:48,height:48,borderRadius:24,borderWidth:1,borderColor:BORDER,backgroundColor:CARD,alignItems:'center',justifyContent:'center'},
  boutonSave:{backgroundColor:GOLD,borderRadius:8,paddingVertical:14,alignItems:'center',marginTop:24},
  boutonSaveTxt:{color:NAVY,fontWeight:'700',fontSize:15},
  boutonSecondaire:{borderRadius:8,paddingVertical:14,alignItems:'center',borderWidth:1,borderColor:BORDER,backgroundColor:CARD},
  carteContact:{backgroundColor:CARD,borderRadius:10,borderWidth:1,borderColor:BORDER,padding:14,marginBottom:12},
  ligneContact:{color:WHITE,fontSize:13,marginTop:6},
  lienAction:{paddingHorizontal:8,paddingVertical:4},
  histoLigne:{paddingVertical:10,borderBottomWidth:1,borderBottomColor:BORDER},
});

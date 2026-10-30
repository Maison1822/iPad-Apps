import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, ScrollView, Alert, Modal, useWindowDimensions,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/AppContext';
import * as Updates from 'expo-updates';

const BG='#1C1C1E',CARD='#2C2C2E',NAVY='#0F1E3C',GOLD='#C8A45A',WHITE='#FFFFFF',MUTED='#8E8E93',BORDER='#3A3A3C',SUCCESS='#2D7A4F';
const COULEURS=['Tous','Rouge','Blanc','Rosé','Ambré'];
const DOT_CLR={Rouge:'#8B1A2E',Blanc:'#C9B458','Rosé':'#D98A9A','Ambré':'#C8821A'};
const FILTRES=[{id:'couleur',label:'Couleur'},{id:'region',label:'Région'},{id:'appellation',label:'Appellation'},{id:'collection',label:'Collection'},{id:'certif',label:'Certification'},{id:'coup_coeur',label:'Coup de Cœur'},{id:'club1822',label:'Club 1822'}];
const ONGLETS=[{id:'desc',label:'Description'},{id:'cepages',label:'Cépages'},{id:'vinif',label:'Vinification'},{id:'degustation',label:'Dégustation'},{id:'condit',label:'Conditionnements'},{id:'accords',label:'Accords'},{id:'prix',label:'Tarifs pro'}];

const COLLECTIONS_ORDER=['Les Essentiels','Les Sélections','Gastronomie','Collection 1822','Héritage 1822','Editions Limitées'];

function fmt(v){return parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2});}
function parsePaliers(v){
  if(!v)return[];
  if(Array.isArray(v))return v;
  try{return JSON.parse(v);}catch(e){return[];}
}
// Prix pro = premier palier autorisé (paliers filtrés dans charger() selon paliers_autorises_cache)
function prixPro(v){
  const paliers=parsePaliers(v.brl_paliers);
  return(paliers.length>0)?paliers[0].prix_ttc:null;
}
// Prix affiché seulement si au moins un palier est autorisé
function margeOk(v){
  return parseFloat(prixPro(v))>0;
}

function Dot({c}){return <View style={{width:10,height:10,borderRadius:5,backgroundColor:DOT_CLR[c]||'#999'}}/>;}

export default function CatalogueScreen({navigation}){
  const {t,lang,addLigneDevis}=useApp();
  const {width}=useWindowDimensions();
  const [vins,setVins]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [vue,setVue]=useState('liste');
  const [detailIdx,setDetailIdx]=useState(null);
  const [onglet,setOnglet]=useState('desc');
  const [ajoutConfirm,setAjoutConfirm]=useState(null);
  const [activeFilter,setActiveFilter]=useState(null);
  const [selCouleur,setSelCouleur]=useState('Tous');
  const [selRegion,setSelRegion]=useState('Toutes');
  const [selApp,setSelApp]=useState('Toutes');
  const [selCol,setSelCol]=useState('Toutes');
  const [selCertif,setSelCertif]=useState('Toutes');
  const [selCoupCoeur,setSelCoupCoeur]=useState(false);
  const [selClub1822,setSelClub1822]=useState(false);
  const [triPrix,setTriPrix]=useState(null); // null | 'asc' | 'desc'
  const [cepagesMap,setCepagesMap]=useState({});
  const touchStartX=useRef(0);

  useEffect(()=>{charger();},[]);

  async function charger(){
    setLoading(true);
    try{
      const{data,error}=await supabase.from('Catalogue App')
        .select('produit_id,producteur,nom,cuvee,millesime,couleur,region,pays,appellation,collections,domaine,brl_public_ttc,brl_public_ht,brl_paliers,vignette_url,photo_url,ncm,desc_courte_fr,desc_courte_pt,desc_courte_en,desc_longue_fr,desc_longue_pt,desc_longue_en,nez_fr,nez_pt,nez_en,bouche_fr,bouche_pt,bouche_en,finale_fr,finale_pt,finale_en,accords_fr,accords_pt,accords_en,vinif_fr,vinif_pt,vinif_en,contenance_ml,alcool,bouteilles_par_carton,allergenes_fr,mention_fr,bio,biodynamie,vegan,hve,coup_de_coeur,club_1822,note_acidite,note_tanins,note_sucrosite,note_volume,note_fraicheur,note_gourmandise')
        .order('producteur').limit(1000);
      if(error)Alert.alert('Erreur',JSON.stringify(error));
      else if(data){
        // Filtrer uniquement les vins avec marge nette > 30% (paliers_autorises_cache)
        const{data:autorises}=await supabase.from('paliers_autorises_cache').select('produit_id,qtes');
        const autorisesMap={};
        if(autorises)autorises.forEach(a=>{autorisesMap[a.produit_id]=a.qtes||[];});
        const filtered=data.map(v=>{
          const qtesOk=autorisesMap[v.produit_id]||[];
          return {...v, brl_paliers: parsePaliers(v.brl_paliers).filter(p=>qtesOk.includes(p.qte))};
        }).filter(v=>autorisesMap[v.produit_id]||(parseFloat(v.brl_public_ttc)>0));
        setVins(filtered);
        const ids=filtered.map(v=>v.produit_id);
        const{data:cp}=await supabase.from('Catalogue Cepages').select('*').in('produit_id',ids);
        if(cp){const m={};cp.forEach(c=>{m[c.produit_id]=c;});setCepagesMap(m);}
      }
    }catch(e){Alert.alert('Erreur réseau',e.message);}
    setLoading(false);
  }

  const regions=useMemo(()=>['Toutes',...[...new Set(vins.map(v=>v.region).filter(Boolean))].sort()],[vins]);
  const appells=useMemo(()=>{
    const base=selRegion!=='Toutes'?vins.filter(v=>v.region===selRegion):vins;
    return['Toutes',...[...new Set(base.map(v=>v.appellation).filter(Boolean))].sort()];
  },[vins,selRegion]);
  const cols=useMemo(()=>{
    const s=new Set();
    vins.forEach(v=>(v.collections||[]).forEach(c=>s.add(c)));
    const sorted=[...COLLECTIONS_ORDER.filter(c=>s.has(c)),...[...s].filter(c=>!COLLECTIONS_ORDER.includes(c)).sort()];
    return['Toutes',...sorted];
  },[vins]);
  const certifs=['Toutes','Bio','Biodynamie','Vegan','Coup de Cœur'];

  const liste=useMemo(()=>vins.filter(v=>{
    const q=search.toLowerCase();
    if(search&&![(v.nom||''),(v.producteur||''),(v.cuvee||''),(v.appellation||'')].some(x=>x.toLowerCase().includes(q)))return false;
    if(selCouleur!=='Tous'&&v.couleur!==selCouleur)return false;
    if(selRegion!=='Toutes'&&v.region!==selRegion)return false;
    if(selApp!=='Toutes'&&v.appellation!==selApp)return false;
    if(selCol!=='Toutes'&&!(v.collections||[]).includes(selCol))return false;
    if(selCertif==='Bio'&&!v.bio)return false;
    if(selCertif==='Biodynamie'&&!v.biodynamie)return false;
    if(selCertif==='Vegan'&&!v.vegan)return false;
    if(selCertif==='Coup de Cœur'&&!v.coup_de_coeur)return false;
    if(selCoupCoeur&&!v.coup_de_coeur)return false;
    if(selClub1822&&!v.club_1822)return false;
    return true;
  }).sort((a,b)=>{
    if(!triPrix)return 0;
    const pa=margeOk(a)?(a.brl_public_ttc||0):triPrix==='asc'?9999999:0, pb=margeOk(b)?(b.brl_public_ttc||0):triPrix==='asc'?9999999:0;
    return triPrix==='asc'?pa-pb:pb-pa;
  }),[vins,search,selCouleur,selRegion,selApp,selCol,selCertif,selCoupCoeur,selClub1822,triPrix]);

  function handleAjouter(vin){
    addLigneDevis({...vin,id:vin.produit_id,pvc_ttc_brl:prixPro(vin)});
    setAjoutConfirm(vin.produit_id);
    setTimeout(()=>setAjoutConfirm(null),1500);
  }

  function badgeLabel(id){
    if(id==='couleur'&&selCouleur!=='Tous')return selCouleur;
    if(id==='region'&&selRegion!=='Toutes')return selRegion;
    if(id==='appellation'&&selApp!=='Toutes')return selApp.slice(0,12);
    if(id==='collection'&&selCol!=='Toutes')return selCol.slice(0,12);
    if(id==='certif'&&selCertif!=='Toutes')return selCertif;
    if(id==='coup_coeur'&&selCoupCoeur)return '★ Coup de Cœur';
    if(id==='club1822'&&selClub1822)return 'Club 1822';
    return null;
  }
  function resetFiltre(id){
    if(id==='couleur')setSelCouleur('Tous');
    if(id==='region')setSelRegion('Toutes');
    if(id==='appellation')setSelApp('Toutes');
    if(id==='collection')setSelCol('Toutes');
    if(id==='certif')setSelCertif('Toutes');
    if(id==='coup_coeur')setSelCoupCoeur(false);
    if(id==='club1822')setSelClub1822(false);
  }

  function ouvrirDetail(idx){
    setOnglet('desc');
    setDetailIdx(idx);
  }

  // Composants partagés - définis ici pour être accessibles partout
  function RowInfo({l,v}){
    if(!v)return null;
    return(
      <View style={{flexDirection:'row',paddingVertical:6,borderBottomWidth:1,borderBottomColor:BORDER}}>
        <Text style={{color:MUTED,fontSize:13,width:130}}>{l}</Text>
        <Text style={{color:WHITE,fontSize:13,flex:1}}>{v}</Text>
      </View>
    );
  }
  function Section({titre,txt}){
    return(
      <View style={{marginBottom:18}}>
        <Text style={{color:GOLD,fontSize:12,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{titre}</Text>
        <Text style={{color:WHITE,fontSize:14,lineHeight:22}}>{txt}</Text>
      </View>
    );
  }
  function Badge({label,gold}){
    return(
      <View style={{paddingHorizontal:10,paddingVertical:4,borderRadius:20,borderWidth:1,borderColor:gold?GOLD:MUTED,backgroundColor:gold?GOLD+'20':'transparent'}}>
        <Text style={{color:gold?GOLD:MUTED,fontSize:11,fontWeight:'600'}}>{label}</Text>
      </View>
    );
  }

  function VinRow({item,idx}){
    const confirme=ajoutConfirm===item.produit_id;
    const nom=item.cuvee||item.nom;
    return(
      <TouchableOpacity style={s.row} onPress={()=>ouvrirDetail(idx)}>
        {item.vignette_url?<Image source={{uri:item.vignette_url}} style={s.thumb} resizeMode="contain"/>:<View style={[s.thumb,s.thumbPh]}><Dot c={item.couleur}/></View>}
        <View style={s.rowInfo}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:2}}>
            <Dot c={item.couleur}/>
            <Text style={s.rowNom} numberOfLines={1}>{item.producteur} — {nom}</Text>
          </View>
          <Text style={s.rowApp} numberOfLines={1}>{item.appellation} · {item.millesime||'—'}{item.contenance_ml?` · ${item.contenance_ml} mL`:''}</Text>
        </View>
        <View style={s.rowRight}>
          {margeOk(item)?<Text style={s.prix}>R$ {fmt(item.brl_public_ttc)}</Text>:<Text style={[s.prix,{color:MUTED,fontSize:12}]}>Sur demande</Text>}
          <TouchableOpacity style={[s.btnAdd,confirme&&{backgroundColor:SUCCESS}]} onPress={()=>handleAjouter(item)}>
            <Text style={s.btnAddTxt}>{confirme?'✓':'+'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  function VinCard({item,idx}){
    const confirme=ajoutConfirm===item.produit_id;
    const nom=item.cuvee||item.nom;
    return(
      <TouchableOpacity style={s.card} onPress={()=>ouvrirDetail(idx)}>
        <View style={s.cardPhotoZone}>
          {item.vignette_url?<Image source={{uri:item.vignette_url}} style={s.cardPhoto} resizeMode="contain"/>:<View style={[s.cardPhoto,s.thumbPh]}><Dot c={item.couleur}/></View>}
        </View>
        <View style={s.cardInfoZone}>
          <View style={{flexDirection:'row',alignItems:'center',gap:5,marginBottom:4}}><Dot c={item.couleur}/><Text style={{color:MUTED,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>{item.couleur}</Text></View>
          <Text style={s.cardNom} numberOfLines={2}>{item.producteur}</Text>
          <Text style={s.cardCuvee} numberOfLines={1}>{nom}</Text>
          <Text style={s.cardApp} numberOfLines={1}>{item.appellation}</Text>
          <Text style={{color:MUTED,fontSize:11,marginBottom:8}}>{item.millesime||'—'}{item.contenance_ml?` · ${item.contenance_ml} mL`:''}</Text>
          {margeOk(item)?<Text style={s.cardPrix}>R$ {fmt(item.brl_public_ttc)}</Text>:<Text style={[s.cardPrix,{color:MUTED,fontSize:12}]}>Sur demande</Text>}
          <TouchableOpacity style={[s.cardBtn,confirme&&{backgroundColor:SUCCESS}]} onPress={()=>handleAjouter(item)}>
            <Text style={s.cardBtnTxt}>{confirme?'✓ Ajouté':t.ajouter_devis}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  function FiltrePanel(){
    if(!activeFilter)return null;
    const opts=activeFilter==='couleur'?COULEURS:activeFilter==='region'?regions:activeFilter==='appellation'?appells:activeFilter==='certif'?certifs:cols;
    const sel=activeFilter==='couleur'?selCouleur:activeFilter==='region'?selRegion:activeFilter==='appellation'?selApp:activeFilter==='certif'?selCertif:selCol;
    const setSel=activeFilter==='couleur'?setSelCouleur:activeFilter==='region'?setSelRegion:activeFilter==='appellation'?setSelApp:activeFilter==='certif'?setSelCertif:setSelCol;
    const lbl=FILTRES.find(f=>f.id===activeFilter)?.label||'';
    return(
      <Modal visible animationType="slide" transparent onRequestClose={()=>setActiveFilter(null)}>
        <TouchableOpacity style={{flex:1,backgroundColor:'#00000080'}} activeOpacity={1} onPress={()=>setActiveFilter(null)}/>
        <View style={s.panel}>
          <View style={s.panelHdr}>
            <Text style={s.panelTitre}>{lbl}</Text>
            <TouchableOpacity onPress={()=>{resetFiltre(activeFilter);setActiveFilter(null);}}>
              <Text style={{color:MUTED,fontSize:13}}>Réinitialiser</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {opts.map(o=>(
              <TouchableOpacity key={o} style={[s.panelOpt,o===sel&&s.panelOptActive]} onPress={()=>{setSel(o);setActiveFilter(null);}}>
                {activeFilter==='couleur'&&o!=='Tous'&&<Dot c={o}/>}
                <Text style={[s.panelOptTxt,o===sel&&{color:NAVY,fontWeight:'700'}]}>{o}</Text>
                {o===sel&&<Text style={{color:NAVY,marginLeft:'auto',fontSize:16}}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // Fiche produit - View absolue, pas de Modal
  function FicheProduit(){
    if(detailIdx===null)return null;
    const item=liste[detailIdx];
    if(!item)return null;
    const nom=item.cuvee||item.nom;
    const L=lang==='PT'?'pt':lang==='EN'?'en':'fr';
    const confirme=ajoutConfirm===item.produit_id;
    const paliers=item.brl_paliers||[];
    const cp=cepagesMap[item.produit_id]||{};
    const ceps=[[cp.cepage_1,cp.taux_cepage_1],[cp.cepage_2,cp.taux_cepage_2],[cp.cepage_3,cp.taux_cepage_3],[cp.cepage_4,cp.taux_cepage_4]].filter(([c])=>c);

    function OngletContent(){
      if(onglet==='desc'){
        const txt=item[`desc_longue_${L}`]||item[`desc_courte_${L}`]||'';
        return(<ScrollView contentContainerStyle={{padding:20}}>
          <RowInfo l="Appellation" v={item.appellation}/><RowInfo l="Région" v={item.region}/><RowInfo l="Pays" v={item.pays}/>
          <RowInfo l="Millésime" v={item.millesime}/><RowInfo l="Couleur" v={item.couleur}/>
          <RowInfo l="Contenance" v={item.contenance_ml?`${item.contenance_ml} mL`:null}/>
          <RowInfo l="Alcool" v={item.alcool?`${item.alcool}%`:null}/><RowInfo l="NCM" v={item.ncm}/>
          {(item.bio||item.biodynamie||item.vegan||item.coup_de_coeur)&&(
            <View style={{flexDirection:'row',gap:8,marginTop:12,flexWrap:'wrap'}}>
              {item.bio&&<Badge label="Bio"/>}{item.biodynamie&&<Badge label="Biodynamie"/>}
              {item.vegan&&<Badge label="Vegan"/>}{item.coup_de_coeur&&<Badge label="★ Coup de Cœur" gold/>}
            </View>
          )}
          {txt?<Text style={{color:WHITE,fontSize:14,lineHeight:22,marginTop:16}}>{txt}</Text>:null}
        </ScrollView>);
      }
      if(onglet==='cepages'){
        return(<ScrollView contentContainerStyle={{padding:20}}>
          {ceps.length===0?<Text style={{color:MUTED,fontStyle:'italic'}}>Non renseigné</Text>:ceps.map(([c,taux],i)=>(
            <View key={i} style={{flexDirection:'row',paddingVertical:10,borderBottomWidth:1,borderBottomColor:BORDER,alignItems:'center'}}>
              <Text style={{color:WHITE,fontSize:15,flex:1,fontWeight:'500'}}>{c}</Text>
              {taux&&<View style={{backgroundColor:GOLD+'30',borderRadius:12,paddingHorizontal:10,paddingVertical:4}}><Text style={{color:GOLD,fontSize:13,fontWeight:'700'}}>{taux}%</Text></View>}
            </View>
          ))}
          {item.domaine&&<View style={{marginTop:20}}><Text style={{color:GOLD,fontSize:12,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Domaine</Text><Text style={{color:WHITE,fontSize:14}}>{item.domaine}</Text></View>}
        </ScrollView>);
      }
      if(onglet==='vinif'){const txt=item[`vinif_${L}`];return(<ScrollView contentContainerStyle={{padding:20}}>{txt?<Text style={{color:WHITE,fontSize:14,lineHeight:22}}>{txt}</Text>:<Text style={{color:MUTED,fontStyle:'italic'}}>Non renseigné</Text>}</ScrollView>);}
      if(onglet==='degustation'){
        const nez=item[`nez_${L}`],bouche=item[`bouche_${L}`],finale=item[`finale_${L}`];
        return(<ScrollView contentContainerStyle={{padding:20}}>
          {nez&&<Section titre="Nez" txt={nez}/>}{bouche&&<Section titre="Bouche" txt={bouche}/>}{finale&&<Section titre="Finale" txt={finale}/>}
          {(item.note_acidite||item.note_tanins||item.note_sucrosite||item.note_volume)&&(
            <View style={{marginTop:8}}>
              <Text style={{color:MUTED,fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>Profil sensoriel</Text>
              {[['Acidité',item.note_acidite],['Tanins',item.note_tanins],['Sucrosité',item.note_sucrosite],['Volume',item.note_volume]].map(([l,v])=>v?(
                <View key={l} style={{marginBottom:10}}>
                  <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}><Text style={{color:MUTED,fontSize:12}}>{l}</Text><Text style={{color:GOLD,fontSize:12}}>{v}/5</Text></View>
                  <View style={{height:4,backgroundColor:BORDER,borderRadius:2}}><View style={{height:4,backgroundColor:GOLD,borderRadius:2,width:`${(v/5)*100}%`}}/></View>
                </View>
              ):null)}
            </View>
          )}
        </ScrollView>);
      }
      if(onglet==='condit'){
        return(<ScrollView contentContainerStyle={{padding:20}}>
          <RowInfo l="Contenance" v={item.contenance_ml?`${item.contenance_ml} mL`:null}/>
          <RowInfo l="Alcool" v={item.alcool?`${item.alcool}%`:null}/>
          <RowInfo l="Bouteilles / carton" v={item.bouteilles_par_carton?`${item.bouteilles_par_carton} bts`:null}/>
          <RowInfo l="NCM" v={item.ncm}/>
          {item.allergenes_fr&&<View style={{marginTop:16}}><Text style={{color:GOLD,fontSize:12,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Allergènes</Text><Text style={{color:WHITE,fontSize:14}}>{item.allergenes_fr}</Text></View>}
          {item.mention_fr&&<View style={{marginTop:16}}><Text style={{color:GOLD,fontSize:12,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Mentions légales</Text><Text style={{color:WHITE,fontSize:14}}>{item.mention_fr}</Text></View>}
        </ScrollView>);
      }
      if(onglet==='accords'){const txt=item[`accords_${L}`];return(<ScrollView contentContainerStyle={{padding:20}}>{txt?<Text style={{color:WHITE,fontSize:14,lineHeight:22}}>{txt}</Text>:<Text style={{color:MUTED,fontStyle:'italic'}}>Non renseigné</Text>}</ScrollView>);}
      if(onglet==='prix'){
        return(<ScrollView contentContainerStyle={{padding:20}}>
          <View style={{backgroundColor:CARD,borderRadius:10,padding:14,marginBottom:16,borderWidth:1,borderColor:BORDER}}>
            <Text style={{color:MUTED,fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Prix public TTC</Text>
            <Text style={{color:WHITE,fontSize:22,fontWeight:'300',textDecorationLine:'line-through'}}>R$ {fmt(item.brl_public_ttc)}</Text>
            <Text style={{color:MUTED,fontSize:12,marginTop:2}}>HT : R$ {fmt(item.brl_public_ht)}</Text>
          </View>
          {paliers.length>0&&(
            <View style={{backgroundColor:CARD,borderRadius:10,padding:14,borderWidth:1,borderColor:GOLD+'60'}}>
              <Text style={{color:GOLD,fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>Tarifs professionnels TTC</Text>
              <View style={{flexDirection:'row',marginBottom:8}}>
                {['Qté min.','Remise','HT','TTC'].map((h,i)=><Text key={i} style={{color:MUTED,fontSize:11,flex:i>1?1.5:1,textAlign:i>0?'right':'left'}}>{h}</Text>)}
              </View>
              {paliers.map((p,i)=>(
                <View key={i} style={{flexDirection:'row',paddingVertical:8,borderTopWidth:1,borderTopColor:BORDER}}>
                  <Text style={{color:WHITE,fontSize:14,flex:1}}>{p.qte} bts</Text>
                  <Text style={{color:GOLD,fontSize:14,flex:1,textAlign:'right',fontWeight:'600'}}>-{p.remise}%</Text>
                  <Text style={{color:WHITE,fontSize:14,flex:1.5,textAlign:'right'}}>R$ {fmt(p.prix_ht)}</Text>
                  <Text style={{color:GOLD,fontSize:15,flex:1.5,textAlign:'right',fontWeight:'700'}}>R$ {fmt(p.prix_ttc)}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>);
      }
      return null;
    }

    return(
      <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:999,flexDirection:'row',backgroundColor:BG}}
        onTouchStart={e=>{touchStartX.current=e.nativeEvent.pageX;}}
        onTouchEnd={e=>{
          const dx=e.nativeEvent.pageX-touchStartX.current;
          if(dx<-60&&detailIdx<liste.length-1)setDetailIdx(i=>i+1);
          else if(dx>60&&detailIdx>0)setDetailIdx(i=>i-1);
        }}>
        {/* Photo gauche */}
        <View style={{width:'33%',backgroundColor:'#111',alignItems:'center',justifyContent:'space-between',paddingVertical:20}}>
          <Text style={{color:MUTED,fontSize:12}}>{detailIdx+1} / {liste.length}</Text>
          {(item.photo_url||item.vignette_url)&&(
            <Image source={{uri:item.photo_url||item.vignette_url}} style={{width:'85%',flex:1,marginVertical:12}} resizeMode="contain"/>
          )}
          <TouchableOpacity
            style={{backgroundColor:confirme?SUCCESS:GOLD,borderRadius:10,paddingHorizontal:20,paddingVertical:12,width:'80%',alignItems:'center'}}
            onPress={()=>handleAjouter(item)}>
            <Text style={{color:NAVY,fontSize:15,fontWeight:'700'}}>{confirme?'✓ Ajouté':'+ Ajouter au devis'}</Text>
          </TouchableOpacity>
        </View>
        {/* Infos droite */}
        <View style={{flex:1}}>
          <View style={{paddingTop:52,paddingHorizontal:20,paddingBottom:14,borderBottomWidth:1,borderBottomColor:GOLD+'40',flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end'}}>
            <View style={{flex:1}}>
              <Text style={{color:GOLD,fontSize:10,letterSpacing:3,fontWeight:'700'}}>MAISON 1822</Text>
              <Text style={{color:WHITE,fontSize:20,fontWeight:'600',marginTop:2}} numberOfLines={1}>{item.producteur}</Text>
              <Text style={{color:MUTED,fontSize:14,marginTop:1}} numberOfLines={1}>{nom} · {item.millesime||'—'}</Text>
            </View>
            <TouchableOpacity onPress={()=>setDetailIdx(null)}>
              <Text style={{color:GOLD,fontSize:26,paddingLeft:16}}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{paddingHorizontal:20,paddingVertical:10,borderBottomWidth:1,borderBottomColor:BORDER}}>
            {margeOk(item)?<Text style={{color:GOLD,fontSize:22,fontWeight:'700'}}>R$ {fmt(item.brl_public_ttc)} <Text style={{fontSize:12,fontWeight:'400',color:MUTED}}>TTC public</Text></Text>:<Text style={{color:MUTED,fontSize:16,fontStyle:'italic'}}>Prix sur demande</Text>}
          </View>
          <View style={{flexDirection:'row',flexWrap:'wrap',paddingHorizontal:8,borderBottomWidth:1,borderBottomColor:BORDER}}>
            {ONGLETS.map(o=>(
              <TouchableOpacity key={o.id} style={[{paddingHorizontal:10,paddingVertical:10,borderBottomWidth:2,borderBottomColor:'transparent'},onglet===o.id&&{borderBottomColor:GOLD}]} onPress={()=>setOnglet(o.id)}>
                <Text style={{color:onglet===o.id?GOLD:MUTED,fontSize:13,fontWeight:onglet===o.id?'700':'400'}}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{flex:1}}><OngletContent/></View>
        </View>
      </View>
    );
  }

  return(
    <View style={[s.container,{position:'relative'}]}>
      <View style={s.header}>
        <View>
          <Text style={s.marque}>MAISON 1822</Text>
          <View style={{flexDirection:'row',alignItems:'baseline',gap:8}}>
            <Text style={s.titre}>{t.catalogue}</Text>
            <Text style={{color:WHITE,fontSize:10,opacity:0.4}}>{Updates.updateId?Updates.updateId.substring(0,8):'v34'}</Text>
          </View>
        </View>
        <TouchableOpacity style={s.toggleBtn} onPress={()=>navigation.navigate('Simulateur')}>
          <Text style={s.toggleTxt}>🧮</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.toggleBtn} onPress={()=>setVue(v=>v==='liste'?'bouteilles':'liste')}>
          <Text style={s.toggleTxt}>{vue==='liste'?'⊞':'☰'}</Text>
        </TouchableOpacity>
      </View>
      <View style={{paddingHorizontal:16,paddingVertical:8}}>
        <TextInput style={s.searchInput} placeholder={t.rechercher} placeholderTextColor={MUTED} value={search} onChangeText={setSearch}/>
      </View>
      <View style={{flexDirection:'row',alignItems:'center'}}>
        <View style={{flex:1,height:50,justifyContent:'center'}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:16,paddingRight:8,gap:10,alignItems:'center'}}>
          {FILTRES.map(f=>{
            const b=badgeLabel(f.id);const actif=!!b;
            return(
              <TouchableOpacity key={f.id} style={[s.filtreBtn,actif&&s.filtreBtnActive]} onPress={()=>{
                if(f.id==='coup_coeur'){setSelCoupCoeur(v=>!v);}
                else if(f.id==='club1822'){setSelClub1822(v=>!v);}
                else setActiveFilter(activeFilter===f.id?null:f.id);
              }}>
                {f.id==='couleur'&&actif&&<Dot c={b}/>}
                <Text style={[s.filtreTxt,actif&&s.filtreTxtActive]}>{actif?b:f.label}</Text>
                {actif&&<TouchableOpacity onPress={()=>resetFiltre(f.id)} hitSlop={{top:8,bottom:8,left:4,right:4}}><Text style={{color:NAVY,fontSize:14,marginLeft:2}}>✕</Text></TouchableOpacity>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        </View>
        <TouchableOpacity
          onPress={()=>setTriPrix(t=>t==='asc'?'desc':t==='desc'?null:'asc')}
          style={{paddingHorizontal:14,paddingVertical:6,marginRight:12,borderRadius:16,borderWidth:1.5,
            borderColor:triPrix?'#C8A45A':'#3A3A3C',backgroundColor:triPrix?'#C8A45A':'#2C2C2E'}}>
          <Text style={{color:triPrix?'#1C1C1E':'#ffffff',fontSize:12,fontWeight:'700'}}>
            {triPrix==='asc'?'Prix ↑':triPrix==='desc'?'Prix ↓':'Prix ↕'}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={{paddingHorizontal:20,paddingBottom:4,fontSize:11,color:MUTED}}>{liste.length} vins</Text>
      {loading?<ActivityIndicator color={GOLD} size="large" style={{marginTop:60}}/>
        :vue==='liste'
          ?<FlatList key="liste" data={liste} keyExtractor={(item)=>item.produit_id}
              renderItem={({item,index})=><VinRow item={item} idx={index}/>}
              ItemSeparatorComponent={()=><View style={{height:1,backgroundColor:BORDER}}/>}
              contentContainerStyle={{paddingBottom:100}}/>
          :<FlatList key={`grille-${width<700?1:2}`} data={liste} keyExtractor={(item)=>item.produit_id}
              renderItem={({item,index})=><VinCard item={item} idx={index}/>}
              numColumns={width<700?1:2}
              columnWrapperStyle={width<700?undefined:{gap:12,paddingHorizontal:12}}
              contentContainerStyle={{paddingVertical:12,gap:12,paddingBottom:100,paddingHorizontal:width<700?12:0}}/>
      }
      <FiltrePanel/>
      <FicheProduit/>
    </View>
  );
}

const s=StyleSheet.create({
  container:{flex:1,backgroundColor:BG},
  header:{backgroundColor:BG,paddingTop:52,paddingBottom:14,paddingHorizontal:20,flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',borderBottomWidth:1,borderBottomColor:GOLD+'40'},
  marque:{color:GOLD,fontSize:10,letterSpacing:4,fontWeight:'700'},
  titre:{color:WHITE,fontSize:24,fontWeight:'200',letterSpacing:1,marginTop:2},
  toggleBtn:{backgroundColor:GOLD,width:36,height:36,borderRadius:8,alignItems:'center',justifyContent:'center'},
  toggleTxt:{color:NAVY,fontSize:18,fontWeight:'700'},
  searchInput:{backgroundColor:CARD,borderRadius:8,paddingHorizontal:16,paddingVertical:10,fontSize:15,color:WHITE,borderWidth:1,borderColor:BORDER},
  filtreBtn:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:16,paddingVertical:10,borderRadius:22,borderWidth:1.5,borderColor:BORDER,backgroundColor:CARD},
  filtreBtnActive:{backgroundColor:GOLD,borderColor:GOLD},
  filtreTxt:{fontSize:14,color:WHITE,fontWeight:'600'},
  filtreTxtActive:{color:NAVY,fontWeight:'700'},
  row:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:12,backgroundColor:CARD},
  thumb:{width:40,height:65,borderRadius:4,marginRight:12},
  thumbPh:{backgroundColor:BG,alignItems:'center',justifyContent:'center'},
  rowInfo:{flex:1},
  rowNom:{fontSize:14,fontWeight:'600',color:WHITE,flex:1},
  rowApp:{fontSize:11,color:MUTED},
  rowRight:{alignItems:'flex-end',gap:6,marginLeft:10},
  prix:{color:GOLD,fontSize:14,fontWeight:'700'},
  btnAdd:{backgroundColor:GOLD,width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center'},
  btnAddTxt:{color:NAVY,fontSize:18,fontWeight:'700',lineHeight:20},
  card:{flex:1,backgroundColor:CARD,borderRadius:10,flexDirection:'row',borderWidth:1,borderColor:BORDER,overflow:'hidden'},
  cardPhotoZone:{width:120,backgroundColor:'#111',alignItems:'center',justifyContent:'center',padding:8},
  cardPhoto:{width:100,height:160},
  cardInfoZone:{flex:1,padding:14,justifyContent:'center'},
  cardNom:{fontSize:13,fontWeight:'700',color:WHITE,marginBottom:2},
  cardCuvee:{fontSize:12,color:GOLD,marginBottom:4},
  cardApp:{fontSize:11,color:MUTED,marginBottom:2},
  cardPrix:{fontSize:16,color:GOLD,fontWeight:'700',marginBottom:10},
  cardBtn:{backgroundColor:GOLD,borderRadius:8,paddingHorizontal:12,paddingVertical:7,alignSelf:'flex-start'},
  cardBtnTxt:{color:NAVY,fontSize:12,fontWeight:'700'},
  panel:{backgroundColor:CARD,borderTopLeftRadius:20,borderTopRightRadius:20,maxHeight:'60%',paddingBottom:40},
  panelHdr:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:20,borderBottomWidth:1,borderBottomColor:BORDER},
  panelTitre:{color:WHITE,fontSize:17,fontWeight:'700'},
  panelOpt:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:20,paddingVertical:14,borderBottomWidth:1,borderBottomColor:BORDER},
  panelOptActive:{backgroundColor:GOLD+'20'},
  panelOptTxt:{color:WHITE,fontSize:15,flex:1},
});

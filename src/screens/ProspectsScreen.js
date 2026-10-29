import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';

const BG='#1C1C1E',CARD='#2C2C2E',GOLD='#C8A45A',WHITE='#FFFFFF',MUTED='#8E8E93',BORDER='#3A3A3C',NAVY='#0F1E3C';
const STATUT_CLR={'À contacter':'#8E8E93','Contacté':'#C8A45A','En cours':'#4A90D9','Chaud':'#E67E22','Client':'#2D7A4F','Perdu':'#7A2138','Suspendu':'#555'};

export default function ProspectsScreen(){
  const [prospects,setProspects]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [filtreFavori,setFiltreFavori]=useState(false);
  const [filtrePays,setFiltrePays]=useState('Tous');
  const [filtreStatut,setFiltreStatut]=useState('Tous');
  const [filtreCategorie,setFiltreCategorie]=useState('Tous');
  const [selected,setSelected]=useState(null);
  const [toggling,setToggling]=useState(null);

  useEffect(()=>{charger();},[]);

  async function charger(){
    setLoading(true);
    const{data,error}=await supabase.from('Prospects').select('*').order('nom_contact');
    if(error)Alert.alert('Erreur',error.message);
    else setProspects(data||[]);
    setLoading(false);
  }

  async function toggleFavori(item){
    if(toggling===item.id)return;
    setToggling(item.id);
    // Optimistic update
    setProspects(prev=>prev.map(p=>p.id===item.id?{...p,favori:!p.favori}:p));
    const{error}=await supabase.from('Prospects').update({favori:!item.favori}).eq('id',item.id);
    if(error){
      // Rollback
      setProspects(prev=>prev.map(p=>p.id===item.id?{...p,favori:item.favori}:p));
      Alert.alert('Erreur',error.message);
    }
    setToggling(null);
  }

  // Catégories disponibles extraites dynamiquement
  const categories=useMemo(()=>{
    const cats=[...new Set(prospects.map(p=>p.categorie).filter(Boolean))].sort();
    return cats;
  },[prospects]);

  const liste=useMemo(()=>prospects.filter(p=>{
    if(filtreFavori&&!p.favori)return false;
    const q=search.toLowerCase();
    if(search&&![p.nom_contact||'',p.prenom_contact||'',p.nom_etablissement||'',p.ville||''].some(x=>x.toLowerCase().includes(q)))return false;
    if(filtrePays!=='Tous'&&p.pays!==filtrePays)return false;
    if(filtreStatut!=='Tous'&&p.statut!==filtreStatut)return false;
    if(filtreCategorie!=='Tous'&&p.categorie!==filtreCategorie)return false;
    return true;
  }),[prospects,search,filtreFavori,filtrePays,filtreStatut,filtreCategorie]);

  function StatutBadge({statut}){
    return(
      <View style={{backgroundColor:(STATUT_CLR[statut]||'#555')+'30',borderRadius:10,paddingHorizontal:8,paddingVertical:3,borderWidth:1,borderColor:STATUT_CLR[statut]||'#555'}}>
        <Text style={{color:STATUT_CLR[statut]||'#555',fontSize:11,fontWeight:'600'}}>{statut||'—'}</Text>
      </View>
    );
  }

  function ProspectRow({item}){
    const nom=`${item.prenom_contact||''} ${item.nom_contact||''}`.trim()||item.nom_etablissement||'—';
    const isFav=item.favori===true;
    return(
      <TouchableOpacity style={s.row} onPress={()=>setSelected(item)} activeOpacity={0.7}>
        {/* Étoile favori */}
        <TouchableOpacity
          onPress={()=>toggleFavori(item)}
          hitSlop={{top:10,bottom:10,left:10,right:10}}
          style={s.starBtn}
          disabled={toggling===item.id}>
          <Text style={{fontSize:20,color:isFav?GOLD:'#444',opacity:toggling===item.id?0.4:1}}>
            {isFav?'★':'☆'}
          </Text>
        </TouchableOpacity>
        {/* Avatar */}
        <View style={s.rowAvatar}>
          <Text style={{color:GOLD,fontSize:16,fontWeight:'700'}}>{(item.nom_contact||item.nom_etablissement||'?')[0].toUpperCase()}</Text>
        </View>
        {/* Infos */}
        <View style={s.rowInfo}>
          <Text style={s.rowNom} numberOfLines={1}>{nom}</Text>
          <Text style={s.rowSub} numberOfLines={1}>{item.nom_etablissement||''}{item.nom_etablissement&&item.categorie?' · ':''}{item.categorie||''}</Text>
          <Text style={{color:MUTED,fontSize:11,marginTop:2}}>{item.pays||''}{item.ville?` · ${item.ville}`:''}</Text>
        </View>
        <StatutBadge statut={item.statut}/>
      </TouchableOpacity>
    );
  }

  function DetailPanel(){
    if(!selected)return null;
    const nom=`${selected.prenom_contact||''} ${selected.nom_contact||''}`.trim()||selected.nom_etablissement||'—';
    return(
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setSelected(null)}>
        <View style={{flex:1,backgroundColor:BG}}>
          <View style={{paddingTop:20,paddingHorizontal:20,paddingBottom:16,borderBottomWidth:1,borderBottomColor:BORDER,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:10,flex:1}}>
              <TouchableOpacity onPress={()=>{toggleFavori(selected);setSelected(prev=>({...prev,favori:!prev.favori}));}}>
                <Text style={{fontSize:24,color:selected.favori?GOLD:'#555'}}>{selected.favori?'★':'☆'}</Text>
              </TouchableOpacity>
              <Text style={{color:GOLD,fontSize:18,fontWeight:'700',flex:1}} numberOfLines={1}>{nom}</Text>
            </View>
            <TouchableOpacity onPress={()=>setSelected(null)}>
              <Text style={{color:GOLD,fontSize:24}}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{padding:20}}>
            <StatutBadge statut={selected.statut}/>
            <View style={{marginTop:16,gap:10}}>
              {[
                ['SIRET / CNPJ',selected.siret_cnpj],
                ['Établissement',selected.nom_etablissement],
                ['Contact',`${selected.prenom_contact||''} ${selected.nom_contact||''}`.trim()||null],
                ['Catégorie',selected.categorie],
                ['Poste',selected.poste],
                ['Pays',selected.pays],
                ['Ville',selected.ville],
                ['Email',selected.email],
                ['Tél. fixe',selected.telephone_fixe],
                ['Portable',selected.telephone_portable],
                ['WhatsApp',selected.whatsapp],
                ['Site web',selected.site_web],
                ['Instagram',selected.instagram],
                ['LinkedIn',selected.linkedin],
                ['Source',selected.source],
                ['Commercial',selected.commercial],
                ['Langue',selected.langue],
              ].map(([l,v])=>v?(
                <View key={l} style={{flexDirection:'row',paddingVertical:8,borderBottomWidth:1,borderBottomColor:BORDER}}>
                  <Text style={{color:MUTED,fontSize:13,width:120}}>{l}</Text>
                  <Text style={{color:WHITE,fontSize:13,flex:1}}>{v}</Text>
                </View>
              ):null)}
              {selected.notes&&(
                <View style={{marginTop:12}}>
                  <Text style={{color:GOLD,fontSize:12,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Notes</Text>
                  <Text style={{color:WHITE,fontSize:14,lineHeight:22}}>{selected.notes}</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  return(
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.marque}>MAISON 1822</Text>
        <Text style={s.titre}>Prospects</Text>
      </View>

      <View style={{paddingHorizontal:16,paddingVertical:8}}>
        <TextInput style={s.searchInput} placeholder="Rechercher..." placeholderTextColor={MUTED} value={search} onChangeText={setSearch}/>
      </View>

      {/* Filtres */}
      <View style={{paddingHorizontal:16,paddingBottom:8,flexDirection:'row',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        {/* Favori */}
        <TouchableOpacity style={[s.chip,filtreFavori&&s.chipActive]} onPress={()=>setFiltreFavori(v=>!v)}>
          <Text style={[s.chipTxt,filtreFavori&&s.chipTxtActive]}>{filtreFavori?'★ Favoris':'☆ Favoris'}</Text>
        </TouchableOpacity>
        <View style={{width:1,backgroundColor:BORDER,marginHorizontal:2,height:20}}/>
        {/* Pays */}
        {['Tous','FR','BR'].map(p=>(
          <TouchableOpacity key={p} style={[s.chip,filtrePays===p&&s.chipActive]} onPress={()=>setFiltrePays(p)}>
            <Text style={[s.chipTxt,filtrePays===p&&s.chipTxtActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
        <View style={{width:1,backgroundColor:BORDER,marginHorizontal:2,height:20}}/>
        {/* Statut rapide */}
        {['Tous','Chaud','Client'].map(st=>(
          <TouchableOpacity key={st} style={[s.chip,filtreStatut===st&&s.chipActive]} onPress={()=>setFiltreStatut(st)}>
            <Text style={[s.chipTxt,filtreStatut===st&&s.chipTxtActive]}>{st}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtres catégorie — ligne 2 */}
      {categories.length>0&&(
        <View style={{paddingHorizontal:16,paddingBottom:8,flexDirection:'row',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <TouchableOpacity style={[s.chip,filtreCategorie==='Tous'&&s.chipActive]} onPress={()=>setFiltreCategorie('Tous')}>
            <Text style={[s.chipTxt,filtreCategorie==='Tous'&&s.chipTxtActive]}>Toutes catégories</Text>
          </TouchableOpacity>
          {categories.map(cat=>(
            <TouchableOpacity key={cat} style={[s.chip,filtreCategorie===cat&&s.chipActive]} onPress={()=>setFiltreCategorie(cat)}>
              <Text style={[s.chipTxt,filtreCategorie===cat&&s.chipTxtActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}


      <Text style={{paddingHorizontal:20,paddingBottom:4,fontSize:11,color:MUTED}}>{liste.length} prospect{liste.length>1?'s':''}</Text>

      {loading
        ?<ActivityIndicator color={GOLD} size="large" style={{marginTop:60}}/>
        :<FlatList
          data={liste}
          keyExtractor={item=>item.id}
          renderItem={({item})=><ProspectRow item={item}/>}
          ItemSeparatorComponent={()=><View style={{height:1,backgroundColor:BORDER}}/>}
          contentContainerStyle={{paddingBottom:100}}
        />
      }
      <DetailPanel/>
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
  row:{flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingVertical:12,backgroundColor:CARD,gap:10},
  starBtn:{width:32,alignItems:'center',justifyContent:'center'},
  rowAvatar:{width:40,height:40,borderRadius:20,backgroundColor:GOLD+'20',borderWidth:1,borderColor:GOLD+'60',alignItems:'center',justifyContent:'center'},
  rowInfo:{flex:1},
  rowNom:{fontSize:14,fontWeight:'600',color:WHITE},
  rowSub:{fontSize:12,color:MUTED,marginTop:2},
});

import React, { useEffect, useRef, useState } from 'react';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, AppState, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/lib/AppContext';
import CatalogueScreen from './src/screens/CatalogueScreen';
import ClientsScreen from './src/screens/ClientsScreen';
import DevisScreen from './src/screens/DevisScreen';
import CommandesScreen from './src/screens/CommandesScreen';
import ScanScreen from './src/screens/ScanScreen';
import ProspectsScreen from './src/screens/ProspectsScreen';
import FournisseursScreen from './src/screens/FournisseursScreen';
import SimulateurScreen from './src/screens/SimulateurScreen';
import LoginScreen from './src/screens/LoginScreen';
import { supabase } from './src/lib/supabase';
import { lireEstAdmin, sauverEstAdmin, surChangementReseau } from './src/lib/offline';
import { viderFile, surNombreEnAttente } from './src/lib/outbox';
import RelancesScreen from './src/screens/RelancesScreen';
import { surNombreRelances, rafraichirNombreRelances } from './src/lib/relances';

const NAVY = '#1C1C1E';
const GOLD = '#C8A45A';
const Tab = createBottomTabNavigator();

const ICONS = { Catalogue: 'wine', Simulateur: 'calculator', Clients: 'people', Devis: 'document-text', Commandes: 'cube', Scan: 'scan', Prospects: 'locate', Relances: 'notifications', Fournisseurs: 'business' };

function LangSelector() {
  const { lang, setLang } = useApp();
  return (
    <View style={{ flexDirection: 'row', marginRight: 16, gap: 4 }}>
      {['FR', 'PT', 'EN'].map(l => (
        <TouchableOpacity key={l}
          style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1,
            borderColor: lang === l ? GOLD : '#ffffff40', backgroundColor: lang === l ? GOLD : 'transparent' }}
          onPress={() => setLang(l)}>
          <Text style={{ color: lang === l ? NAVY : '#fff', fontSize: 11, fontWeight: '700' }}>{l}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Badge() {
  const { devisCourant } = useApp();
  const n = devisCourant.lignes.length;
  if (!n) return null;
  return (
    <View style={{ position: 'absolute', top: -6, right: -8, backgroundColor: '#7A2138',
      borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{n}</Text>
    </View>
  );
}

// Bandeau affiché tant que des éléments faits hors ligne attendent d'être envoyés
function BandeauEnvoi() {
  const [n, setN] = useState(0);
  useEffect(() => surNombreEnAttente(setN), []);
  if (!n) return null;
  return (
    <View style={{ backgroundColor: GOLD, paddingTop: 44, paddingBottom: 6, paddingHorizontal: 16 }}>
      <Text style={{ color: NAVY, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
        ⏳ {n} élément{n > 1 ? 's' : ''} en attente d'envoi (hors ligne)
      </Text>
    </View>
  );
}

function Nav({ isAdmin }) {
  const { t } = useApp();
  // Envoi différé : au démarrage, au retour du réseau, au retour au premier plan et toutes les minutes
  useEffect(() => {
    viderFile();
    const arreterReseau = surChangementReseau((enLigne) => { if (enLigne) viderFile(); });
    const minuteur = setInterval(viderFile, 60 * 1000);
    const abonnement = AppState.addEventListener('change', (etat) => { if (etat === 'active') viderFile(); });
    return () => { arreterReseau(); clearInterval(minuteur); abonnement.remove(); };
  }, []);
  // Compteur de relances affiché sur l'onglet : au démarrage, toutes les 5 minutes et au retour au premier plan
  const [nbRelances, setNbRelances] = useState(0);
  useEffect(() => {
    const arreter = surNombreRelances(setNbRelances);
    rafraichirNombreRelances();
    const minuteur = setInterval(rafraichirNombreRelances, 5 * 60 * 1000);
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') rafraichirNombreRelances();
    });
    return () => { arreter(); clearInterval(minuteur); abonnement.remove(); };
  }, []);
  return (
    <View style={{ flex: 1 }}>
    <BandeauEnvoi />
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: { backgroundColor: '#1C1C1E', borderTopColor: GOLD + '50', borderTopWidth: 1, height: 70, paddingBottom: 10, paddingTop: 6 },
      tabBarActiveTintColor: GOLD,
      tabBarInactiveTintColor: '#ffffff60',
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      tabBarIcon: ({ color }) => (
        <View style={{ alignItems: 'center' }}>
          <Ionicons name={ICONS[route.name]} size={24} color={color} />
          {route.name === 'Devis' && <Badge />}
        </View>
      ),
    })}>
      <Tab.Screen name="Catalogue" component={CatalogueScreen} options={{ title: t.catalogue }} />
      <Tab.Screen name="Simulateur" component={SimulateurScreen} options={{ title: 'Prix' }} />
      <Tab.Screen name="Clients" component={ClientsScreen} options={{ title: t.clients }} />
      <Tab.Screen name="Devis" component={DevisScreen} options={{ title: t.devis }} />
      <Tab.Screen name="Commandes" component={CommandesScreen} options={{ title: t.commandes }} />
      <Tab.Screen name="Scan" component={ScanScreen} options={{ title: t.scan }} />
      <Tab.Screen name="Prospects" component={ProspectsScreen} options={{ title: 'Prospects' }} />
      <Tab.Screen name="Relances" component={RelancesScreen} options={{ title: 'Relances', tabBarBadge: nbRelances > 0 ? nbRelances : undefined }} />
      {isAdmin ? <Tab.Screen name="Fournisseurs" component={FournisseursScreen} options={{ title: 'Fournisseurs' }} /> : null}
    </Tab.Navigator>
    </View>
  );
}

export default function App() {
  // Session Supabase : connexion requise avant d'afficher l'application
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [prepared, setPrepared] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // À chaque connexion : rafraîchit les caches de paliers (règles FR et BR) avant d'afficher l'app
  useEffect(() => {
    if (!session) {
      setPrepared(false);
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    const timeout = new Promise(resolve => setTimeout(resolve, 8000));
    const refresh = (async () => {
      try {
        await supabase.rpc('rafraichir_tous_paliers');
      } catch (e) {
        // silencieux : l'app s'ouvre avec les caches existants
      }
    })();
    // Rôle de l'utilisateur : détermine l'affichage de l'onglet Fournisseurs (admin uniquement)
    const role = (async () => {
      try {
        const { data, error } = await supabase
          .from('Utilisateurs')
          .select('Fonction')
          .eq('id', session.user.id)
          .maybeSingle();
        if (error) {
          // Hors réseau : on garde le dernier rôle connu pour que l'onglet Fournisseurs reste disponible
          const connu = await lireEstAdmin();
          if (!cancelled) setIsAdmin(connu);
        } else {
          const admin = data?.Fonction === 'admin';
          sauverEstAdmin(admin);
          if (!cancelled) setIsAdmin(admin);
        }
      } catch (e) {
        const connu = await lireEstAdmin();
        if (!cancelled) setIsAdmin(connu);
      }
    })();
    Promise.race([Promise.all([refresh, role]), timeout]).then(() => {
      if (!cancelled) setPrepared(true);
    });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // Auto-update : au démarrage ET à chaque remise au premier plan
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    async function checkUpdate() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        // silencieux
      }
    }

    // Vérifier au démarrage
    checkUpdate();

    // Vérifier à chaque fois que l'app revient au premier plan
    const subscription = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        checkUpdate();
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  if (checkingSession || (session && !prepared)) {
    return (
      <View style={{ flex: 1, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <NavigationContainer>
          <Nav isAdmin={isAdmin} />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}

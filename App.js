import React, { useEffect, useRef, useState } from 'react';
import * as Updates from 'expo-updates';
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
import SimulateurScreen from './src/screens/SimulateurScreen';
import LoginScreen from './src/screens/LoginScreen';
import { supabase } from './src/lib/supabase';

const NAVY = '#1C1C1E';
const GOLD = '#C8A45A';
const Tab = createBottomTabNavigator();

const ICONS = { Catalogue: '🍷', Simulateur: '🧮', Clients: '👥', Devis: '📋', Commandes: '📦', Scan: '🔍', Prospects: '🎯' };

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

function Nav() {
  const { t } = useApp();
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: { backgroundColor: '#1C1C1E', borderTopColor: GOLD + '50', borderTopWidth: 1, height: 70, paddingBottom: 10, paddingTop: 6 },
      tabBarActiveTintColor: GOLD,
      tabBarInactiveTintColor: '#ffffff60',
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      tabBarIcon: ({ color }) => (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 22 }}>{ICONS[route.name]}</Text>
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
    </Tab.Navigator>
  );
}

export default function App() {
  // Session Supabase : connexion requise avant d'afficher l'application
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

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

  if (checkingSession) {
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
          <Nav />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}

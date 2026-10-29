import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';

const BG = '#1C1C1E', CARD = '#2C2C2E', GOLD = '#C8A45A', WHITE = '#FFFFFF', MUTED = '#8E8E93', BORDER = '#3A3A3C', ERROR = '#E57373';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Saisissez votre e-mail et votre mot de passe.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) {
      setError('Connexion impossible : vérifiez votre e-mail, votre mot de passe et votre réseau.');
    }
    // En cas de succès, App.js détecte la session et affiche l'application.
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.brand}>MAISON 1822</Text>
      <Text style={styles.title}>Connexion</Text>

      <TextInput
        style={styles.input}
        placeholder="E-mail"
        placeholderTextColor={MUTED}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor={MUTED}
        secureTextEntry
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={handleLogin}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color={BG} /> : <Text style={styles.buttonText}>Se connecter</Text>}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, justifyContent: 'center', paddingHorizontal: 32 },
  brand: { color: GOLD, fontSize: 14, letterSpacing: 4, textAlign: 'center', marginBottom: 8 },
  title: { color: WHITE, fontSize: 28, fontWeight: '300', textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: CARD, color: WHITE, borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 12,
  },
  error: { color: ERROR, fontSize: 13, textAlign: 'center', marginVertical: 8 },
  button: { backgroundColor: GOLD, borderRadius: 8, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  buttonText: { color: BG, fontSize: 16, fontWeight: '600' },
});

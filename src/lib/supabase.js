import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://adgaujemdhchptygrixl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkZ2F1amVtZGhjaHB0eWdyaXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NzI3NjMsImV4cCI6MjA5NzI0ODc2M30.oMCUXFmsget9C1QcOBPeRcrHPN0zf1yuOmdRurLHg2g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

import { createClient } from '@supabase/supabase-js';

// Use dummy values if env variables are missing to prevent fatal crash on load
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aguardando-configuracao.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'aguardando-chave';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

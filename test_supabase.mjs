import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  if (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  } else {
    console.log('SUCCESS! Data:', data);
  }
}
test();

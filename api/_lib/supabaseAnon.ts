import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'SUPABASE_URL e SUPABASE_ANON_KEY precisam estar definidas no ambiente do servidor.'
  );
}

export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy-project-id.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key-for-build';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-anon-key-for-build';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn('Supabase environment variables are missing. Using dummy placeholders for build compilation.');
}

// supabaseAdmin uses the service_role key to bypass RLS (Row Level Security)
// This is used ONLY in API routes (server-side) to secure actions like inserting preorders and managing settings.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Standard client for client-side operations (if any)
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

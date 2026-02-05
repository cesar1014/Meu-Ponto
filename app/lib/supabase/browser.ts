import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

type GlobalSupabaseStore = {
  __pontoSupabaseClient?: SupabaseClient | null;
};

const globalStore = globalThis as unknown as GlobalSupabaseStore;
let supabaseClient: SupabaseClient | null | undefined = globalStore.__pontoSupabaseClient;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (supabaseClient !== undefined) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!url || !anonKey) {
    supabaseClient = null;
    return supabaseClient;
  }

  supabaseClient = createBrowserClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Avoid navigator.locks abort errors in dev/HMR by using a no-op lock
      // (still safe for single-tab usage)
      lock: async (_name, _acquireTimeout, fn) => await fn(),
    },
  });

  globalStore.__pontoSupabaseClient = supabaseClient;
  return supabaseClient;
}

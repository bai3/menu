import { handleShoppingRequest } from './core.mjs';
Deno.serve((request: Request) => handleShoppingRequest(request, {
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  publicKey: Deno.env.get('SUPABASE_ANON_KEY'),
  aiKey: Deno.env.get('SILICONFLOW_API_KEY'),
}));

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jjkyltquurcuznukxakv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

export function requireSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing Supabase configuration');
  }
}

export function getSupabaseUrl(path) {
  return `${SUPABASE_URL}${path}`;
}

export function getServiceHeaders(extraHeaders = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    ...extraHeaders
  };

  // New Supabase secret/publishable keys are not JWTs and should not be sent as Bearer tokens.
  if (!SUPABASE_KEY?.startsWith('sb_')) {
    headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  }

  return headers;
}

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

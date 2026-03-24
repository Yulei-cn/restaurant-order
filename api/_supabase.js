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
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extraHeaders
  };
}

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

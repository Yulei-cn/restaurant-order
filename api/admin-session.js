import { getAdminSession, requireAdminConfig, verifyAdminSessionValue } from './_adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    requireAdminConfig();
  } catch {
    return res.status(500).json({ error: 'Missing admin configuration' });
  }

  const isAuthenticated = verifyAdminSessionValue(getAdminSession(req));
  return res.status(200).json({ authenticated: isAuthenticated });
}

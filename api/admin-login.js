import { requireAdminConfig, setAdminSessionCookie, validateAdminPassword } from './_adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    requireAdminConfig();
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Missing admin configuration' });
  }

  const { password } = req.body || {};
  if (!validateAdminPassword(password)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  setAdminSessionCookie(res);
  return res.status(200).json({ status: 'ok' });
}

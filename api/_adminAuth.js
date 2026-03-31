import crypto from 'crypto';

const COOKIE_NAME = 'cube_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export function requireAdminConfig() {
  getRequiredEnv('ADMIN_PASSWORD');
  getRequiredEnv('ADMIN_SESSION_SECRET');
}

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function createAdminSessionValue() {
  const secret = getRequiredEnv('ADMIN_SESSION_SECRET');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = JSON.stringify({ scope: 'admin', expiresAt });
  const encodedPayload = Buffer.from(payload, 'utf8').toString('base64url');
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionValue(sessionValue) {
  if (!sessionValue || !sessionValue.includes('.')) {
    return false;
  }

  const secret = getRequiredEnv('ADMIN_SESSION_SECRET');
  const [encodedPayload, signature] = sessionValue.split('.');
  const expected = signPayload(encodedPayload, secret);
  const isValidHexSignature = /^[0-9a-f]+$/i.test(signature);

  if (!isValidHexSignature || signature.length !== expected.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'))) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    return payload.scope === 'admin' && Number(payload.expiresAt) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function parseCookies(req) {
  const rawCookie = req.headers.cookie || '';
  return Object.fromEntries(
    rawCookie
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export function getAdminSession(req) {
  const cookies = parseCookies(req);
  return cookies[COOKIE_NAME] || '';
}

export function isAdminAuthenticated(req) {
  try {
    return verifyAdminSessionValue(getAdminSession(req));
  } catch {
    return false;
  }
}

export function requireAdminSession(req, res) {
  if (!isAdminAuthenticated(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}

export function validateAdminPassword(password) {
  const expected = getRequiredEnv('ADMIN_PASSWORD');
  return typeof password === 'string' && password === expected;
}

export function setAdminSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${createAdminSessionValue()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS};${secure}`
  );
}

export function clearAdminSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0;${secure}`
  );
}

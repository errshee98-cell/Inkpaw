import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'inkpaw_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function issueSession(res, userId) {
  const token = jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
    path: '/api',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { path: '/api' });
}

// Zero trust: every request is authenticated, nothing is trusted by network location.
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    clearSession(res);
    return res.status(401).json({ error: 'Session expired' });
  }
}

// CSRF defence for cookie auth: state-changing requests must carry a custom header,
// which browsers will not send cross-site without a CORS preflight we reject.
export function requireCsrfHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'inkpaw') {
    return res.status(403).json({ error: 'Missing CSRF header' });
  }
  next();
}

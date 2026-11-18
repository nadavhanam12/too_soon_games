// Verifies the ID tokens that "Sign in with Google" and "Sign in with Apple" hand the page (RS256 JWTs), with the
// providers' public keys. No library: WebCrypto does the RSA check, the rest is a few claims.
import { HttpError } from './util';

interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string }

export interface IdProvider {
  name: 'google' | 'apple';
  jwksUrl: string;
  issuers: string[];
}

export const GOOGLE: IdProvider = {
  name: 'google',
  jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
  issuers: ['accounts.google.com', 'https://accounts.google.com'],
};
export const APPLE: IdProvider = {
  name: 'apple',
  jwksUrl: 'https://appleid.apple.com/auth/keys',
  issuers: ['https://appleid.apple.com'],
};

export interface IdClaims { sub: string; email: string | null; emailVerified: boolean }

// The keys change a few times a year. Kept in this isolate's memory for an hour; a token signed with a kid that is not
// in the cached set refetches once (the provider rotated its keys since the last fetch).
const keyCache = new Map<string, { keys: Jwk[]; at: number }>();
const KEYS_TTL_MS = 60 * 60_000;

async function fetchKeys(p: IdProvider): Promise<Jwk[]> {
  const res = await fetch(p.jwksUrl);
  if (!res.ok) throw new HttpError(502, `${p.name} keys: HTTP ${res.status}`, 'provider_down');
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = body.keys ?? [];
  keyCache.set(p.name, { keys, at: Date.now() });
  return keys;
}

async function keyFor(p: IdProvider, kid: string): Promise<Jwk> {
  const c = keyCache.get(p.name);
  let keys = c && Date.now() - c.at < KEYS_TTL_MS ? c.keys : await fetchKeys(p);
  let k = keys.find((x) => x.kid === kid);
  if (!k && c) { keys = await fetchKeys(p); k = keys.find((x) => x.kid === kid); }
  if (!k) throw new HttpError(401, 'unknown signing key', 'bad_token');
  return k;
}

function b64urlBytes(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
function b64urlJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlBytes(s))) as Record<string, unknown>;
  } catch {
    throw new HttpError(401, 'malformed token', 'bad_token');
  }
}

/** Checks signature, issuer, audience (our client id) and expiry; returns the account id and email. */
export async function verifyIdToken(p: IdProvider, token: unknown, audience: string): Promise<IdClaims> {
  if (typeof token !== 'string' || token.length > 8192) throw new HttpError(400, 'missing token', 'bad_token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'malformed token', 'bad_token');
  const [h, pl, sig] = parts as [string, string, string];
  const header = b64urlJson(h);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new HttpError(401, 'unsupported token', 'bad_token');

  const jwk = await keyFor(p, header.kid);
  const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(sig), new TextEncoder().encode(`${h}.${pl}`));
  if (!ok) throw new HttpError(401, 'bad signature', 'bad_token');

  const c = b64urlJson(pl);
  const now = Math.floor(Date.now() / 1000);
  if (!p.issuers.includes(String(c.iss))) throw new HttpError(401, 'wrong issuer', 'bad_token');
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(audience)) throw new HttpError(401, 'token is for another app', 'bad_token');
  if (typeof c.exp !== 'number' || c.exp < now - 60) throw new HttpError(401, 'token expired', 'bad_token');
  if (typeof c.sub !== 'string' || !c.sub) throw new HttpError(401, 'no account id', 'bad_token');
  const email = typeof c.email === 'string' ? c.email.toLowerCase() : null;
  // Apple sends email_verified as the string "true"
  const emailVerified = c.email_verified === true || c.email_verified === 'true';
  return { sub: c.sub, email, emailVerified };
}

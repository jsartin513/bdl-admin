/** Validate and normalize `NEXT_PUBLIC_APP_URL` (no trailing slash). */
export function getAppBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return raw.replace(/\/$/, '');
  } catch {
    return null;
  }
}

/** Vercel: `production` = live. `preview` = test. Local dev: show unless opted out. */
export function showTestModeBanner(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === 'production') return false;
  if (vercelEnv === 'preview') return true;
  if (process.env.NODE_ENV === 'development') {
    return process.env.NEXT_PUBLIC_HIDE_DEMO_BANNER !== 'true';
  }
  return process.env.NEXT_PUBLIC_SHOW_DEMO_BANNER === 'true';
}

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

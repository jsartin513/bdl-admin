import { createHmac } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';

const ADMIN_SESSION_COOKIE = 'admin_session';

export function createAdminSessionToken(email: string, secret: string): string {
  const payload = {
    email: email.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export async function applyAdminSession(
  context: BrowserContext,
  baseUrl: string,
  email: string,
  secret: string
): Promise<boolean> {
  const token = createAdminSessionToken(email, secret);
  const { hostname, protocol } = new URL(baseUrl);

  await context.addCookies([
    {
      name: ADMIN_SESSION_COOKIE,
      value: token,
      domain: hostname,
      path: '/',
      httpOnly: true,
      secure: protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);

  return true;
}

export function getDemoAdminCredentials(): { email: string; secret: string } | null {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim() ?? process.env.DEMO_ADMIN_SESSION_SECRET?.trim();
  const email =
    process.env.E2E_ADMIN_EMAIL?.trim() ??
    process.env.DEMO_ADMIN_EMAIL?.trim() ??
    process.env.ADMIN_DEMO_EMAIL?.trim();
  if (!secret || !email) return null;
  return { email, secret };
}

export function requirePreviewAdminCredentials(): { email: string; secret: string } {
  const creds = getDemoAdminCredentials();
  if (!creds) {
    throw new Error(
      'Set ADMIN_SESSION_SECRET and E2E_ADMIN_EMAIL (must match Vercel Preview) for preview e2e.'
    );
  }
  return creds;
}

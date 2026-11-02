import { afterEach, describe, expect, it } from 'vitest';

import { showTestModeBanner } from '@/app/lib/env-banner';

describe('showTestModeBanner', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('returns false when VERCEL_ENV is production', () => {
    process.env.VERCEL_ENV = 'production';
    expect(showTestModeBanner()).toBe(false);
  });

  it('returns true when VERCEL_ENV is preview', () => {
    process.env.VERCEL_ENV = 'preview';
    expect(showTestModeBanner()).toBe(true);
  });

  it('returns true in development unless NEXT_PUBLIC_HIDE_DEMO_BANNER is true', () => {
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = 'development';
    delete process.env.NEXT_PUBLIC_HIDE_DEMO_BANNER;
    expect(showTestModeBanner()).toBe(true);

    process.env.NEXT_PUBLIC_HIDE_DEMO_BANNER = 'true';
    expect(showTestModeBanner()).toBe(false);
  });

  it('returns true in other environments only when NEXT_PUBLIC_SHOW_DEMO_BANNER is true', () => {
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = 'test';
    delete process.env.NEXT_PUBLIC_SHOW_DEMO_BANNER;
    expect(showTestModeBanner()).toBe(false);

    process.env.NEXT_PUBLIC_SHOW_DEMO_BANNER = 'true';
    expect(showTestModeBanner()).toBe(true);
  });
});

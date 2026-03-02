import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

function readDotEnvValue(name) {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return '';

  const content = readFileSync(envPath, 'utf-8').replace(/^\uFEFF/, '');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([^=\s]+)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (key === name) return value;
  }

  return '';
}

const dotEnvSupabaseUrl =
  readDotEnvValue('NEXT_PUBLIC_SUPABASE_URL') || readDotEnvValue('SUPABASE_URL');
const dotEnvSupabaseAnonKey =
  readDotEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
  readDotEnvValue('NEXT_PUBLIC_SUPABASE_KEY') ||
  readDotEnvValue('SUPABASE_ANON_KEY') ||
  readDotEnvValue('SUPABASE_KEY');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      // Stripe webhook: api.lumyf.com/stripe/webhook → mesmo handler
      { source: "/stripe/webhook", destination: "/api/webhooks/stripe" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      dotEnvSupabaseUrl ||
      '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY ||
      dotEnvSupabaseAnonKey ||
      '',
    NEXT_PUBLIC_E2E_MOCK:
      process.env.NEXT_PUBLIC_E2E_MOCK || '',
  },
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfigWithIntl = withNextIntl(nextConfig);

const sentryOptions = {
  org: 'lumyf',
  project: 'javascript-nextjs',
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
};

export default withSentryConfig(nextConfigWithIntl, sentryOptions);

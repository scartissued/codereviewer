import dotenv from 'dotenv';

dotenv.config({ quiet: true });

type NodeEnv = 'development' | 'production' | 'test';

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseNodeEnv = (value: string | undefined): NodeEnv => {
  if (value === 'production' || value === 'test') {
    return value;
  }

  return 'development';
};

const parseOptionalString = (value: string | undefined): string => {
  if (!value || !value.trim()) {
    return '';
  }

  return value.trim();
};

const parseCorsOrigins = (value: string | undefined): true | string[] => {
  if (!value || value.trim() === '*') {
    return true;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const env = {
  nodeEnv: parseNodeEnv(process.env.NODE_ENV),
  port: parseNumber(process.env.PORT, 3000),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 100),
  trustProxy: process.env.TRUST_PROXY === 'true',
  githubAppId: parseNumber(process.env.GITHUB_APP_ID, 0),
  githubClientId: parseOptionalString(process.env.GITHUB_CLIENT_ID),
  githubClientSecret: parseOptionalString(process.env.GITHUB_CLIENT_SECRET),
  githubWebhookSecret: parseOptionalString(process.env.GITHUB_WEBHOOK_SECRET),
  githubPrivateKey: parseOptionalString(process.env.GITHUB_PRIVATE_KEY).replace(/\\n/g, '\n'),
  githubRedirectUrl: parseOptionalString(process.env.GITHUB_REDIRECT_URL),
  githubEnabled:
    parseNumber(process.env.GITHUB_APP_ID, 0) > 0 &&
    parseOptionalString(process.env.GITHUB_WEBHOOK_SECRET) !== '' &&
    parseOptionalString(process.env.GITHUB_PRIVATE_KEY) !== '',
} as const;

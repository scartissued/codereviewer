import compression from 'compression';
import cors from 'cors';
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import { randomUUID } from 'node:crypto';
import { v1Router } from './api/v1/index.js';
import { env } from './config/env.js';

export const app = express();

if (env.trustProxy) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  }),
);
app.use(compression());
app.use(hpp());

if (env.nodeEnv !== 'test') {
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.rateLimitMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    service: 'codereviewer',
    error: 'Too many requests, please try again later.',
  },
});

app.use('/api', apiLimiter);

app.use((req: Request, res: Response, next) => {
  const requestId = req.headers['x-request-id']?.toString() || randomUUID();
  res.setHeader('x-request-id', requestId);
  next();
});

const jsonParser = express.json({ limit: '1mb' });
const urlEncodedParser = express.urlencoded({ extended: true, limit: '1mb' });

app.use((req: Request, res: Response, next) => {
  if (req.path === '/api/v1/github/webhooks') {
    return next();
  }
  return jsonParser(req, res, next);
});

app.use((req: Request, res: Response, next) => {
  if (req.path === '/api/v1/github/webhooks') {
    return next();
  }
  return urlEncodedParser(req, res, next);
});

app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    service: 'codereviewer',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1', v1Router);

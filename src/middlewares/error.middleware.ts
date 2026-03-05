import { ErrorRequestHandler, Request, Response } from 'express';
import { env } from '../config/env.js';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    service: 'codereviewer',
    error: 'Route not found',
    path: req.originalUrl,
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  const message = statusCode >= 500 ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    service: 'codereviewer',
    error: message,
    ...(env.nodeEnv !== 'production' && err?.stack ? { stack: err.stack } : {}),
  });
};

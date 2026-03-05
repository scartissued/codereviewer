import { Router } from 'express';
import { healthRoutes } from '../../routes/health.routes.js';
import { reviewRoutes } from '../../routes/review.routes.js';

export const v1Router = Router();

v1Router.use('/health', healthRoutes);
v1Router.use('/reviews', reviewRoutes);

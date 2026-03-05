import { Router } from 'express';
import { getReviews } from '../controllers/review.controller.js';

export const reviewRoutes = Router();

reviewRoutes.get('/', getReviews);

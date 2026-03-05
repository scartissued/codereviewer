import { Request, Response } from 'express';
import { listReviews } from '../services/review.service.js';

export const getReviews = (_req: Request, res: Response): void => {
  res.status(200).json({ data: listReviews() });
};

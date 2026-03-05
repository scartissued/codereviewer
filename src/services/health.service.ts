import { HealthStatus } from '../models/health.model.js';

export const getHealthStatus = (): HealthStatus => ({
  service: 'codereviewer',
  status: 'ok',
  version: 'v1',
  timestamp: new Date().toISOString(),
});

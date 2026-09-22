const GCP_BACKEND = 'https://rupiksha-backend-java-53431955516.asia-south1.run.app/api/v1';

// Guard against relative URLs being baked into the build (e.g., VITE_BACKEND_URL=/api/v1)
// which would cause API calls to hit the wrong host in production.
const envUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
const isAbsoluteUrl = envUrl.startsWith('http://') || envUrl.startsWith('https://');
const rawUrl = (isAbsoluteUrl ? envUrl : GCP_BACKEND).replace(/\/$/, '');
export const BACKEND_URL = rawUrl.endsWith('/api/v1') ? rawUrl : `${rawUrl}/api/v1`;
export const SERVICE_FLAGS = {
  aeps: String(import.meta.env.VITE_SERVICE_AEPS_ENABLED ?? 'true') === 'true',
  bbps: String(import.meta.env.VITE_SERVICE_BBPS_ENABLED ?? 'true') === 'true',
  tickets: String(import.meta.env.VITE_SERVICE_TICKETS_ENABLED ?? 'true') === 'true',
  recharge: String(import.meta.env.VITE_SERVICE_RECHARGE_ENABLED ?? 'true') === 'true',
  payout: String(import.meta.env.VITE_SERVICE_PAYOUT_ENABLED ?? 'true') === 'true',
};

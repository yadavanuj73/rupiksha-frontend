const GCP_BACKEND = 'https://rupiksha-backend-java-53431955516.asia-south1.run.app/api/v1';
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || GCP_BACKEND).replace(/\/$/, '');
export const SERVICE_FLAGS = {
  aeps: String(import.meta.env.VITE_SERVICE_AEPS_ENABLED ?? 'true') === 'true',
  bbps: String(import.meta.env.VITE_SERVICE_BBPS_ENABLED ?? 'true') === 'true',
  tickets: String(import.meta.env.VITE_SERVICE_TICKETS_ENABLED ?? 'true') === 'true',
  recharge: String(import.meta.env.VITE_SERVICE_RECHARGE_ENABLED ?? 'true') === 'true',
  payout: String(import.meta.env.VITE_SERVICE_PAYOUT_ENABLED ?? 'true') === 'true',
};

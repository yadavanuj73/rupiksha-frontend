export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '/api/v1').replace(/\/$/, '');
export const SERVICE_FLAGS = {
  aeps: String(import.meta.env.VITE_SERVICE_AEPS_ENABLED ?? 'true') === 'true',
  bbps: String(import.meta.env.VITE_SERVICE_BBPS_ENABLED ?? 'true') === 'true',
  tickets: String(import.meta.env.VITE_SERVICE_TICKETS_ENABLED ?? 'true') === 'true',
  recharge: String(import.meta.env.VITE_SERVICE_RECHARGE_ENABLED ?? 'true') === 'true',
  payout: String(import.meta.env.VITE_SERVICE_PAYOUT_ENABLED ?? 'true') === 'true',
};

const _isLocal = typeof window !== 'undefined'
  && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const _RENDER = 'https://rupiksha-backend-java.onrender.com/api/v1';
export const BACKEND_URL = _isLocal
  ? ((import.meta.env.VITE_BACKEND_URL || '/api/v1').replace(/\/$/, ''))
  : _RENDER;
export const SERVICE_FLAGS = {
  aeps: String(import.meta.env.VITE_SERVICE_AEPS_ENABLED ?? 'true') === 'true',
  bbps: String(import.meta.env.VITE_SERVICE_BBPS_ENABLED ?? 'true') === 'true',
  tickets: String(import.meta.env.VITE_SERVICE_TICKETS_ENABLED ?? 'true') === 'true',
  recharge: String(import.meta.env.VITE_SERVICE_RECHARGE_ENABLED ?? 'true') === 'true',
  payout: String(import.meta.env.VITE_SERVICE_PAYOUT_ENABLED ?? 'true') === 'true',
};

const _isLocal = typeof window !== 'undefined'
  && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const _RENDER = 'https://rupiksha-backend-java.onrender.com/api/v1';
// Always use Render backend in production (never relative URLs which break CORS)
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

export const getStorageKey = (baseKey) => {
  if (typeof window === 'undefined') return baseKey;
  const path = window.location.pathname;
  if (path.startsWith('/admin')) {
    return `${baseKey}_admin`;
  }
  if (path.startsWith('/distributor') || path === '/portal/distributor') {
    return `${baseKey}_distributor`;
  }
  if (path.startsWith('/super-distributor') || path === '/portal/super-distributor') {
    return `${baseKey}_super_distributor`;
  }
  return `${baseKey}_retailer`;
};

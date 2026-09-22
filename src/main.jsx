import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global localStorage Patch for multi-tab portal/role isolation
const SESSION_KEYS = [
  'rupiksha_token',
  'rupiksha_user',
  'rupiksha_refresh_token',
  'rupiksha_imp_token',
  'rupiksha_imp_user',
  'last_activity'
];

const getPortalStorageKey = (key) => {
  if (!SESSION_KEYS.includes(key)) return key;
  const path = window.location.pathname;
  if (path.startsWith('/admin')) {
    return `${key}_admin`;
  }
  if (path.startsWith('/distributor') || path === '/portal/distributor') {
    return `${key}_distributor`;
  }
  if (path.startsWith('/super-distributor') || path === '/portal/super-distributor') {
    return `${key}_super_distributor`;
  }
  return `${key}_retailer`;
};

if (typeof window !== 'undefined' && window.localStorage) {
  const originalGetItem = localStorage.getItem;
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;

  localStorage.getItem = function (key) {
    return originalGetItem.call(localStorage, getPortalStorageKey(key));
  };
  localStorage.setItem = function (key, value) {
    originalSetItem.call(localStorage, getPortalStorageKey(key), value);
  };
  localStorage.removeItem = function (key) {
    originalRemoveItem.call(localStorage, getPortalStorageKey(key));
  };
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error) {
    console.error("React Error:", error);
    const msg = error?.message || '';
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('Loading chunk') ||
      msg.includes('error loading dynamically imported module')
    ) {
      const reloadKey = 'chunk_reload_retry_' + window.location.pathname;
      const retries = parseInt(sessionStorage.getItem(reloadKey) || '0', 10);
      if (retries < 2) {
        sessionStorage.setItem(reloadKey, String(retries + 1));
        window.location.reload();
        return;
      }
    }
  }
  render() {
    if (this.state.hasError) {
      const isChunkError = 
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('Importing a module script failed') ||
        this.state.error?.message?.includes('Loading chunk');

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 font-['Inter',sans-serif]">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
            <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-2">
              {isChunkError ? 'New Version Available' : 'Something Went Wrong'}
            </h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {isChunkError
                ? 'A newer version of the application has been deployed. Please refresh to load the latest updates.'
                : (this.state.error?.message || 'An unexpected error occurred.')}
            </p>
            <button
              onClick={() => {
                sessionStorage.clear();
                window.location.reload();
              }}
              className="w-full bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md text-xs uppercase tracking-wider"
            >
              Refresh & Update
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Global detection for dynamic import failures
window.addEventListener('unhandledrejection', (event) => {
  const msg = event?.reason?.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  ) {
    const reloadKey = 'chunk_reload_retry_' + window.location.pathname;
    const retries = parseInt(sessionStorage.getItem(reloadKey) || '0', 10);
    if (retries < 2) {
      sessionStorage.setItem(reloadKey, String(retries + 1));
      window.location.reload();
    }
  }
});

// Global wheel event handler to prevent mouse scroll from modifying number input values
if (typeof window !== 'undefined') {
  window.addEventListener('wheel', () => {
    if (document.activeElement && document.activeElement.type === 'number') {
      document.activeElement.blur();
    }
  }, { passive: true });
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)


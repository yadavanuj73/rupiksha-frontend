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
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#fff', color: '#000', border: '5px solid red' }}>
          <h2>UI Crash Detected</h2>
          <pre>{this.state.error?.stack || this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Global detection for dynamic import failures
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && 
      (event.reason.message.includes('Failed to fetch dynamically imported module') ||
       event.reason.message.includes('Importing a module script failed'))) {
    location.reload();
  }
});

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)

import { createContext, useContext, useState, useEffect } from "react";
import { dataService } from "../services/dataService";
import { BACKEND_URL } from "../services/config";

const AuthContext = createContext({
  user: null,
  setUser: () => {},
  permissions: [],
  loading: true,
  login: async () => ({ success: false }),
  logout: () => {},
  verifyPin: () => false,
  isLocked: false,
  setIsLocked: () => {},
  hasPermission: () => false,
  getToken: () => null,
  lockTimeLeft: 0,
  logoutTimeLeft: 0,
});

// Constants for timeout
const LOCK_TIMEOUT = 15 * 60 * 1000; // 15 mins
const LOGOUT_TIMEOUT = 120 * 60 * 1000; // 2 hours

const ROLE_PRIORITY = [
  "ADMIN",
  "NATIONAL_HEADER",
  "STATE_HEADER",
  "REGIONAL_HEADER",
  "EMPLOYEE",
  "SUPER_DISTRIBUTOR",
  "DISTRIBUTOR",
  "RETAILER",
];

const normalizeRoleValue = (raw) =>
  String(typeof raw === "string" ? raw : raw?.name || "")
    .trim()
    .replace(/^ROLE_/i, "")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

const normalizeUserSession = (rawUser) => {
  if (!rawUser || typeof rawUser !== "object") return null;
  const roles = Array.isArray(rawUser.roles)
    ? rawUser.roles.map(normalizeRoleValue).filter(Boolean)
    : [];
  const role = normalizeRoleValue(rawUser.role);
  const allRoles = Array.from(new Set([...(roles || []), ...(role ? [role] : [])]));
  const preferred = ROLE_PRIORITY.find((r) => allRoles.includes(r)) || allRoles[0] || "RETAILER";
  return {
    ...rawUser,
    roles: allRoles.length ? allRoles : [preferred],
    role: preferred,
  };
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimeLeft, setLockTimeLeft] = useState(LOCK_TIMEOUT);
  const [logoutTimeLeft, setLogoutTimeLeft] = useState(LOGOUT_TIMEOUT);
  // Load user on start — also handle ?_imp= impersonation handoff from admin tab
  useEffect(() => {
    const initAuth = async () => {
    // Check for impersonation token passed via URL query param from admin panel
    const params = new URLSearchParams(window.location.search);
    const impKey = params.get('_imp');
    let impersonationSuccess = false;
    const attemptImpersonation = async () => {
      if (!impKey) return false;
      console.log('[AuthContext] Found impKey:', impKey);
      // Retry mechanism: localStorage may not be immediately available in new tab
      for (let attempts = 1; attempts <= 10; attempts++) {
        try {
          const raw = localStorage.getItem(impKey);
          console.log('[AuthContext] Attempt', attempts, 'Raw localStorage data:', raw ? 'found' : 'null');
          if (raw) {
            const parsed = JSON.parse(raw);
            console.log('[AuthContext] Parsed data:', parsed);
            const impToken = parsed.token;
            const impUserObj = parsed.user;
            console.log('[AuthContext] impToken exists:', !!impToken, 'impUserObj exists:', !!impUserObj);
            if (impToken && impUserObj) {
              localStorage.removeItem(impKey); // clean up handoff key immediately
              // Use a separate key so we do NOT overwrite the admin's rupiksha_token
              localStorage.setItem('rupiksha_imp_token', impToken);
              localStorage.setItem('rupiksha_imp_user', JSON.stringify(impUserObj));
              // Immediately set user state so UI reflects impersonated user
              const normalizedUser = normalizeUserSession(impUserObj);
              console.log('[AuthContext] Normalized user:', normalizedUser);
              if (normalizedUser) {
                setUser(normalizedUser);
                setPermissions(normalizedUser.permissions || []);
                console.log('[AuthContext] Impersonation success, user set');
              }
              // Clean ?_imp= from URL without reload
              params.delete('_imp');
              const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
              window.history.replaceState({}, '', newUrl);
              return true; // success
            }
          }
        } catch (e) {
          console.error('[AuthContext] Impersonation handoff error:', e);
        }
        // Wait 100ms before retry
        if (attempts < 10) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
      console.error('[AuthContext] Max impersonation retries exceeded');
      return false;
    };
    
    // Run impersonation attempt
    impersonationSuccess = await attemptImpersonation();
    
    // Skip loading from localStorage if impersonation already set the user
    if (impersonationSuccess) {
      setLoading(false);
      return;
    }

    // If this tab has an imp session (e.g. page refresh in impersonation tab), restore it.
    // BUT: only if the URL path looks like a member portal (not /admin*).
    // A stale rupiksha_imp_token can get left behind in the same browser when an admin
    // opens "Login as Member" and then hard-refreshes their own /admin tab.
    const impToken = localStorage.getItem("rupiksha_imp_token");
    const impUser = localStorage.getItem("rupiksha_imp_user");
    const isAdminPath = window.location.pathname.startsWith('/admin');
    if (impToken && impUser && !isAdminPath) {
      try {
        const parsedImp = normalizeUserSession(JSON.parse(impUser));
        if (parsedImp) {
          setUser(parsedImp);
          setPermissions(parsedImp.permissions || []);
          setLoading(false);
          return;
        }
      } catch { /* fall through to normal session */ }
    } else if (impToken && isAdminPath) {
      // Stale imp keys on admin tab — clear them so admin session loads cleanly
      localStorage.removeItem("rupiksha_imp_token");
      localStorage.removeItem("rupiksha_imp_user");
    }

    const token = localStorage.getItem("rupiksha_token");
    const savedUser = localStorage.getItem("rupiksha_user");
    const lastActivity = localStorage.getItem("last_activity");

    if (token && savedUser) {
      try {
        const parsedUser = normalizeUserSession(JSON.parse(savedUser));
        if (!parsedUser) {
          logout();
          return;
        }
        setUser(parsedUser);
        setPermissions(parsedUser.permissions || []);

        // Check if we should be locked or logged out based on time
        if (lastActivity) {
          const now = Date.now();
          const elapsed = now - parseInt(lastActivity);
          if (elapsed >= LOGOUT_TIMEOUT) {
            logout();
          } else if (elapsed >= LOCK_TIMEOUT) {
            // No lock for admin/employee roles and Retailers
            const isExempt = ['ADMIN', 'DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE', 'RETAILER'].includes(parsedUser.role);
            if (!isExempt) {
              setIsLocked(true);
            }
          }
        }
      } catch (e) {
        logout();
      }
    }
    setLoading(false);
    }; // end initAuth
    initAuth();
  }, []);

  // Keep-alive ping: hits backend every 25s to prevent Render free tier cold starts
  useEffect(() => {
    const PING_URL = 'https://rupiksha-backend-java.onrender.com/actuator/health';
    const ping = () => fetch(PING_URL, { method: 'GET', mode: 'no-cors' }).catch(() => {});
    ping();
    const interval = setInterval(ping, 25000);
    return () => clearInterval(interval);
  }, []);

  // NOTE: socket.io live-updates stub removed. The Java backend does not expose
  // a socket.io server, so the previous io() connection always failed and printed
  // repeated connection errors in the browser console. If real-time updates are
  // needed later, add a /ws endpoint in the Java backend and reintroduce this
  // client connection.

  // Update last activity on interaction
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      localStorage.setItem("last_activity", Date.now().toString());
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);

    // Initial set
    handleActivity();

    const interval = setInterval(() => {
      const last = parseInt(localStorage.getItem("last_activity") || "0");
      const now = Date.now();
      const diff = now - last;

      const remainingLock = Math.max(0, LOCK_TIMEOUT - diff);
      const remainingLogout = Math.max(0, LOGOUT_TIMEOUT - diff);

      setLockTimeLeft(remainingLock);
      setLogoutTimeLeft(remainingLogout);

      if (diff >= LOGOUT_TIMEOUT) {
        logout();
      } else if (diff >= LOCK_TIMEOUT && !isLocked) {
        // No auto-lock for admin/employee roles and Retailers
        const isExempt = ['ADMIN', 'DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE', 'RETAILER'].includes(user.role);
        if (!isExempt) {
          setIsLocked(true);
        }
      }
    }, 1000); // Check every second for countdown

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      clearInterval(interval);
    };
  }, [user, isLocked]);

  const login = async (username, password, expectedPortalRole = null) => {
    try {
      const res = await dataService.loginUser(username, password, null, expectedPortalRole);
      if (res.success) {
        const normalized = normalizeUserSession(res.user);
        if (!normalized) {
          return { success: false, message: "Session normalization failed." };
        }
        localStorage.setItem("rupiksha_user", JSON.stringify(normalized));
        setUser(normalized);
        setPermissions(normalized.permissions || []);

        // No lock screen for admin/employee roles and Retailers
        const isExempt = ['ADMIN', 'DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE', 'RETAILER'].includes(normalized.role);
        setIsLocked(!isExempt);

        localStorage.setItem("last_activity", Date.now().toString());
        return { success: true };
      } else {
        return { success: false, message: res.message };
      }
    } catch (err) {
      return { success: false, message: err.message || "Login failed" };
    }
  };

  const verifyPin = (pin) => {
    if (user && user.pin === pin) {
      setIsLocked(false);
      localStorage.setItem("last_activity", Date.now().toString());
      return true;
    }
    return false;
  };

  const logout = () => {
    const isImpSession = !!localStorage.getItem("rupiksha_imp_token");
    if (isImpSession) {
      // In an impersonation tab — only clear imp keys, not admin's real token
      localStorage.removeItem("rupiksha_imp_token");
      localStorage.removeItem("rupiksha_imp_user");
    } else {
      localStorage.removeItem("rupiksha_token");
      localStorage.removeItem("rupiksha_user");
      localStorage.removeItem("rupiksha_imp_token");
      localStorage.removeItem("rupiksha_imp_user");
      localStorage.removeItem("last_activity");
    }
    setUser(null);
    setPermissions([]);
    setIsLocked(false);
  };

  const hasPermission = (module, action) => {
    if (user?.role === "ADMIN") return true;
    return permissions.some(
      (p) => p.module === module && p.action === action && p.allowed
    );
  };

  // Prefer imp token only in impersonation tabs (non-admin paths).
  // Admin tab should NEVER use rupiksha_imp_token — it would send member token to admin endpoints.
  const getToken = () => {
    const isAdminTab = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
    if (isAdminTab) return localStorage.getItem("rupiksha_token");
    return localStorage.getItem("rupiksha_imp_token") || localStorage.getItem("rupiksha_token");
  };

  return (
    <AuthContext.Provider value={{ user, setUser, permissions, loading, login, logout, verifyPin, isLocked, setIsLocked, hasPermission, getToken, lockTimeLeft, logoutTimeLeft }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import { BACKEND_URL } from './config';
import { apiFetch } from './apiService';

const EMP_TOKEN_KEY = 'rupiksha_employee_token';
const EMP_REFRESH_KEY = 'rupiksha_employee_refresh_token';
const EMP_USER_KEY = 'rupiksha_employee_user';

const buildQuery = (params = {}) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      sp.append(k, String(v).trim());
    }
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
};

const parseResponse = async (res) => {
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return body || {};
};

const extractError = (res, body) => {
  let msg = body?.message || body?.error || `Request failed (${res.status})`;
  if (body?.errors && typeof body.errors === 'object') {
    const details = Object.entries(body.errors)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    if (details) msg = `${msg} — ${details}`;
  }
  const err = new Error(msg);
  err.status = res.status;
  return err;
};

let refreshPromise = null;

async function tryRefreshEmployeeSession() {
  const refreshToken = localStorage.getItem(EMP_REFRESH_KEY);
  if (!refreshToken) return null;
  if (!refreshPromise) {
    refreshPromise = fetch(`${BACKEND_URL}/employee/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        const body = await parseResponse(res);
        if (!res.ok || !body?.accessToken) {
          throw new Error('Session refresh failed');
        }
        localStorage.setItem(EMP_TOKEN_KEY, body.accessToken);
        if (body.refreshToken) localStorage.setItem(EMP_REFRESH_KEY, body.refreshToken);
        if (body.employee) localStorage.setItem(EMP_USER_KEY, JSON.stringify(body.employee));
        return body.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function employeeFetch(endpoint, options = {}, allowRetry = true) {
  const token = localStorage.getItem(EMP_TOKEN_KEY);
  const res = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && !endpoint.startsWith('/employee/auth/login') && !endpoint.startsWith('/employee/auth/refresh')) {
    if (allowRetry && localStorage.getItem(EMP_REFRESH_KEY)) {
      try {
        await tryRefreshEmployeeSession();
        return employeeFetch(endpoint, options, false);
      } catch {
        employeeAuthService.clearSession();
        if (typeof window !== 'undefined') window.location.href = '/employee-login';
        throw new Error('Your session expired. Please sign in again.');
      }
    }
    employeeAuthService.clearSession();
    if (typeof window !== 'undefined') window.location.href = '/employee-login';
    throw new Error('Authentication required');
  }

  const body = await parseResponse(res);
  if (!res.ok) {
    throw extractError(res, body);
  }
  return body;
}

export const employeeAuthService = {
  getToken: () => localStorage.getItem(EMP_TOKEN_KEY),
  getSessionUser: () => {
    try {
      const raw = localStorage.getItem(EMP_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  clearSession: () => {
    localStorage.removeItem(EMP_TOKEN_KEY);
    localStorage.removeItem(EMP_REFRESH_KEY);
    localStorage.removeItem(EMP_USER_KEY);
  },
  login: async (identifier, password) => {
    const res = await fetch(`${BACKEND_URL}/employee/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const body = await parseResponse(res);
    if (!res.ok) {
      throw extractError(res, body);
    }
    localStorage.setItem(EMP_TOKEN_KEY, body.accessToken);
    if (body.refreshToken) localStorage.setItem(EMP_REFRESH_KEY, body.refreshToken);
    if (body.employee) localStorage.setItem(EMP_USER_KEY, JSON.stringify(body.employee));
    return body;
  },
  me: async () => {
    const profile = await employeeFetch('/employee/auth/me');
    if (profile && profile.id) {
      localStorage.setItem(EMP_USER_KEY, JSON.stringify(profile));
    }
    return profile;
  },
  logout: async () => {
    const refreshToken = localStorage.getItem(EMP_REFRESH_KEY);
    const accessToken = localStorage.getItem(EMP_TOKEN_KEY);
    try {
      await fetch(`${BACKEND_URL}/employee/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ refreshToken: refreshToken || '' }),
      });
    } catch {
      // Ignore network errors during logout
    } finally {
      employeeAuthService.clearSession();
    }
  },
};

export const employeePortalService = {
  getZones: () => employeeFetch('/employee/zones'),
  getPermissionCatalog: () => employeeFetch('/employee/permissions/catalog'),
  getDashboard: (params = {}) => employeeFetch(`/employee/dashboard${buildQuery(params)}`),
  listMembers: (params = {}) => employeeFetch(`/employee/members${buildQuery(params)}`),
  getMemberDetail: (memberId) => employeeFetch(`/employee/members/${encodeURIComponent(memberId)}`),
  getCandidateParents: (role) => employeeFetch(`/employee/members/candidate-parents${buildQuery({ role })}`),
  onboardMember: (payload) =>
    employeeFetch('/employee/members/onboard', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listTransactions: (params = {}) => employeeFetch(`/employee/transactions${buildQuery(params)}`),
  getTransactionDetail: (txnId) => employeeFetch(`/employee/transactions/${encodeURIComponent(txnId)}`),
  exportTransactions: (params = {}) => employeeFetch(`/employee/transactions/export${buildQuery(params)}`),
  getReports: (params = {}) => employeeFetch(`/employee/reports${buildQuery(params)}`),
  listHierarchyEmployees: (params = {}) => employeeFetch(`/employee/hierarchy/employees${buildQuery(params)}`),
};

export const adminEmployeeService = {
  getPermissionCatalog: () => apiFetch('/admin/employees/permissions/catalog'),
  getZoneCatalog: () => apiFetch('/admin/employees/zones/catalog'),
  listEligibleManagers: (role) => apiFetch(`/admin/employees/managers${buildQuery({ role })}`),
  listEmployees: (params = {}) => apiFetch(`/admin/employees${buildQuery(params)}`),
  createEmployee: (payload) =>
    apiFetch('/admin/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getEmployee: (employeeId) => apiFetch(`/admin/employees/${encodeURIComponent(employeeId)}`),
  updateEmployee: (employeeId, payload) =>
    apiFetch(`/admin/employees/${encodeURIComponent(employeeId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateStatus: (employeeId, status, reason = '') =>
    apiFetch(`/admin/employees/${encodeURIComponent(employeeId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }),
  resetPassword: (employeeId, newPassword) =>
    apiFetch(`/admin/employees/${encodeURIComponent(employeeId)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
  updatePermissions: (employeeId, permissions) =>
    apiFetch(`/admin/employees/${encodeURIComponent(employeeId)}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }),
  listPerformance: (params = {}) => apiFetch(`/admin/employees/performance${buildQuery(params)}`),
  getEmployeePerformance: (employeeId, params = {}) =>
    apiFetch(`/admin/employees/${encodeURIComponent(employeeId)}/performance${buildQuery(params)}`),
  getPermissionPreview: (employeeId) =>
    apiFetch(`/admin/employees/${encodeURIComponent(employeeId)}/permission-preview`),
  getAuditLogs: (employeeId = null) =>
    apiFetch(`/admin/employees/audit-logs${buildQuery(employeeId ? { employeeId } : {})}`),
};

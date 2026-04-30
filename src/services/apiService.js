// Base API URL - apna backend URL yahan set karo
// Base API URL - Use Vite proxy to talk to backend
const BASE_URL = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");

// Token helper
const getToken = () => localStorage.getItem("rupiksha_token");
const makeIdempotencyKey = () =>
  (globalThis.crypto?.randomUUID?.() || `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`);

// Common fetch with JWT
export const apiFetch = async (endpoint, options = {}) => {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("rupiksha_token");
    localStorage.removeItem("rupiksha_user");
    window.location.href = "/login";
    return;
  }
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!res.ok) {
    let msg = body?.message || body?.error || `API Error: ${res.status}`;
    if (body?.errors && typeof body.errors === "object") {
      const fieldErrors = Object.entries(body.errors)
        .map(([f, m]) => `${f}: ${m}`)
        .join(", ");
      if (fieldErrors) msg = `${msg} — ${fieldErrors}`;
    }
    throw new Error(msg);
  }
  return body || {};
};

// ─── AUTH ────────────────────────────────────────────────────────────────────
export const authService = {
  login: (username, password) =>
    apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (userData) =>
    apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    }),
  logout: () => {
    localStorage.removeItem("rupiksha_token");
    localStorage.removeItem("rupiksha_user");
    return Promise.resolve({ success: true });
  },
};

// ─── DASHBOARD STATS (Live data) ──────────────────────────────────────────────
export const dashboardService = {
  // territory = "india" | "UP" | "Lucknow" etc.
  getStats: (territory = "india") =>
    apiFetch(`/dashboard/stats?territory=${territory}`),

  // Top bar data - charges, commission, wallet
  getTopBarData: () => apiFetch("/dashboard/topbar"),
};

// ─── EMPLOYEE / HEADER USER MANAGEMENT ────────────────────────────────────────
export const employeeService = {
  // Sab header users ki list
  getAll: () => apiFetch("/employees"),

  // Ek user ka detail
  getById: (id) => apiFetch(`/employees/${id}`),

  // Naya header user banao
  create: (userData) =>
    apiFetch("/employees/create", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  // User update karo
  update: (id, userData) =>
    apiFetch(`/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    }),

  // Activate / Deactivate
  toggleStatus: (id) =>
    apiFetch(`/employees/${id}/toggle-status`, { method: "PUT" }),

  // Delete
  delete: (id) =>
    apiFetch(`/employees/${id}`, { method: "DELETE" }),

  // Permissions
  getPermissions: (userId) => apiFetch(`/employees/${userId}/permissions`),
  updatePermissions: (userId, permissions) =>
    apiFetch(`/employees/${userId}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    }),
};

// ─── PERMISSIONS ──────────────────────────────────────────────────────────────
export const permissionService = {
  // Kisi user ki permissions lo
  getByUserId: (userId) => employeeService.getPermissions(userId),

  // Kisi user ki permissions update karo
  update: (userId, permissions) => employeeService.updatePermissions(userId, permissions),
};

// ─── LIVE LOCATION ────────────────────────────────────────────────────────────
export const locationService = {
  // Apni location bhejo
  updateMyLocation: (lat, lng) =>
    apiFetch("/location/update", {
      method: "PUT",
      body: JSON.stringify({ latitude: lat, longitude: lng, timestamp: new Date().toISOString() }),
    }),

  // Sab users ki location lo (admin ke liye map)
  getAllLocations: () => apiFetch("/location/all"),

  // Ek user ki location
  getUserLocation: (userId) => apiFetch(`/location/${userId}`),
};

// ─── MEMBERS ──────────────────────────────────────────────────────────────────
export const memberService = {
  getAll: (territory) => apiFetch(`/members?territory=${territory}`),
  getRequests: () => apiFetch("/members/requests"),
  getComplaints: () => apiFetch("/members/complaints"),
};

// ─── WALLET ───────────────────────────────────────────────────────────────────
export const walletService = {
  getAll: () => apiFetch("/wallet"),
  getBalance: (userId) => apiFetch(`/wallet/${userId}/balance`),
  creditFund: (userId, amount) =>
    apiFetch("/wallet/credit", {
      method: "POST",
      body: JSON.stringify({ userId, amount }),
    }),
  debitFund: (userId, amount) =>
    apiFetch("/wallet/debit", {
      method: "POST",
      body: JSON.stringify({ userId, amount }),
    }),
  getPendingRequests: () => apiFetch("/wallet/pending"),
  lockAmount: (userId, amount) =>
    apiFetch("/wallet/lock", {
      method: "POST",
      body: JSON.stringify({ userId, amount }),
    }),
};

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
export const transactionService = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiFetch(`/transactions?${params}`);
  },
  getBalance: () => apiFetch("/transactions/balance"),
  logTransaction: (data) =>
    apiFetch("/transactions/log", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getAeps: (territory) => apiFetch(`/transactions/aeps?territory=${territory}`),
  getPayout: (territory) => apiFetch(`/transactions/payout?territory=${territory}`),
  getDmt: (territory) => apiFetch(`/transactions/dmt?territory=${territory}`),
  getBbps: (territory) => apiFetch(`/transactions/bbps?territory=${territory}`),
  getMine: (userId) => apiFetch(`/transactions/mine?userId=${encodeURIComponent(userId)}`),
  getStatus: (txnId) => apiFetch(`/transactions/${encodeURIComponent(txnId)}`),
};

// ─── USER PROFILE ─────────────────────────────────────────────────────────────
export const userService = {
  getProfile: () => apiFetch("/user/profile"),
  updateProfile: (data) =>
    apiFetch("/user/update-profile", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  submitAepsKyc: (data) =>
    apiFetch("/user/submit-aeps-kyc", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  submitKyc: (data) =>
    apiFetch("/user/submit-kyc", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getKycStatus: (userId) => apiFetch(`/user/kyc-status${userId ? `?userId=${userId}` : ""}`),
  refreshUser: (userId) =>
    apiFetch("/user/refresh", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
};

// ─── OTP SERVICE ──────────────────────────────────────────────────────────────
export const otpService = {
  sendMobileOtp: (mobile) =>
    apiFetch("/otp/send", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    }),
  verifyOtp: (mobile, otp) =>
    apiFetch("/otp/verify", {
      method: "POST",
      body: JSON.stringify({ mobile, otp }),
    }),
};

// ─── PAYMENT GATEWAY (Java backend compatibility) ─────────────────────────────
export const paymentGatewayService = {
  createOrder: ({ amount, customer_id, purpose = "WALLET_TOPUP" }) =>
    apiFetch("/create-order", {
      method: "POST",
      body: JSON.stringify({ amount, customer_id, purpose }),
    }),

  verifyPayment: (payload) =>
    apiFetch("/verify-payment", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ─── LIVE RECHARGE / TRANSFER ADAPTER ─────────────────────────────────────────
export const providerTxnService = {
  recharge: ({ userId, mobile, operator, amount }) =>
    apiFetch("/recharge", {
      method: "POST",
      body: JSON.stringify({ userId, mobile, operator, amount, idempotencyKey: makeIdempotencyKey() }),
    }),

  transfer: ({ userId, beneficiaryName, accountNumber, ifsc, amount }) =>
    apiFetch("/transfer", {
      method: "POST",
      body: JSON.stringify({ userId, beneficiaryName, accountNumber, ifsc, amount, idempotencyKey: makeIdempotencyKey() }),
    }),
};

// ─── AEPS ──────────────────────────────────────────────────────────────────────
export const aepsService = {
  // Onboarding for new retailers
  onboard: (payload) =>
    apiFetch("/api/aeps/onboard", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // KYC verification with biometric
  kyc: (payload) =>
    apiFetch("/api/aeps/aeps-kyc", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // KYC OTP verification
  verifyKycOtp: (payload) =>
    apiFetch("/api/aeps/aeps-kyc-otp-verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // 2FA verification (required every 24 hours)
  twoFa: (payload) =>
    apiFetch("/api/aeps/aeps-twofa", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Main transaction (withdrawal, balance inquiry, etc.)
  transact: (payload) =>
    apiFetch("/api/aeps/transaction", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Transaction status check
  statusCheck: (clientId) =>
    apiFetch("/api/aeps/transaction-status", {
      method: "POST",
      body: JSON.stringify({ clientId }),
    }),
  getHistory: (userId) => apiFetch(`/aeps/history?userId=${encodeURIComponent(userId)}`),
  reconcile: (date) =>
    apiFetch("/aeps/recon", {
      method: "POST",
      body: JSON.stringify({ date }),
    }),
  whitelistRequest: (payload) =>
    apiFetch("/aeps/whitelist-request", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ─── BBPS / Bharat Connect ─────────────────────────────────────────────────────
export const bbpsService = {
  fetchBill: (payload) =>
    apiFetch("/bbps/fetch", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  payBill: (payload) =>
    apiFetch("/bbps/pay", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  status: (txnId) => apiFetch(`/bbps/status/${encodeURIComponent(txnId)}`),
};

// ─── Tickets / Support ─────────────────────────────────────────────────────────
export const supportService = {
  raiseTicket: (payload) =>
    apiFetch("/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  myTickets: (userId) => apiFetch(`/tickets/mine?userId=${encodeURIComponent(userId)}`),
};

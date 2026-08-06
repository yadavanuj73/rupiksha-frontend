// Base API URL
const rawApiUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || GCP_BACKEND).replace(/\/$/, '');
const BASE_URL = rawApiUrl.endsWith('/api/v1') ? rawApiUrl : `${rawApiUrl}/api/v1`;

// Token helper — admin path always uses admin token, member imp-tab uses imp token
const getToken = () => {
  const isAdminTab = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  if (isAdminTab) return localStorage.getItem('rupiksha_token');
  return localStorage.getItem('rupiksha_imp_token') || localStorage.getItem('rupiksha_token');
};
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
    const isAdminTab = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
    const isImp = !!localStorage.getItem("rupiksha_imp_token");
    if (!isAdminTab) {
      // Member tab: clear only relevant session keys and redirect
      if (isImp) {
        localStorage.removeItem("rupiksha_imp_token");
        localStorage.removeItem("rupiksha_imp_user");
      } else {
        localStorage.removeItem("rupiksha_token");
        localStorage.removeItem("rupiksha_user");
      }
      window.location.href = "/login";
      return;
    }
    // Admin tab: do NOT redirect or clear admin token — throw so caller can handle
    throw new Error("Session expired");
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
  login: (username, password, pin) =>
    apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, pin }),
    }),
  register: (userData) =>
    apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    }),
  forgotPasswordSendOtp: (mobile) =>
    apiFetch("/auth/forgot-password/send-otp", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    }),
  resetPassword: (mobile, otp, newPassword) =>
    apiFetch("/auth/forgot-password/reset", {
      method: "POST",
      body: JSON.stringify({ mobile, otp, newPassword }),
    }),
  forgotPinSendOtp: (mobile) =>
    apiFetch("/auth/forgot-pin/send-otp", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    }),
  resetPin: (mobile, otp, newPin) =>
    apiFetch("/auth/forgot-pin/reset", {
      method: "POST",
      body: JSON.stringify({ mobile, otp, newPin }),
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
  getDmt: (territory) => apiFetch(`/transactions/aeps?territory=${territory}`), // note: keeping existing mapping
  getMine: (userId) => apiFetch(`/transactions/mine?userId=${encodeURIComponent(userId)}`),
  getStatus: (txnId) => apiFetch(`/transactions/${encodeURIComponent(txnId)}`),
  getHistory: (filters = {}) => {
    const cleanFilters = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        cleanFilters[k] = v;
      }
    });
    const params = new URLSearchParams(cleanFilters).toString();
    return apiFetch(`/transactions/history?${params}`);
  },
  getHistoryDetail: (txnId) => apiFetch(`/transactions/history/${encodeURIComponent(txnId)}`),
  getHistoryExport: (filters = {}) => {
    const cleanFilters = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        cleanFilters[k] = v;
      }
    });
    const params = new URLSearchParams(cleanFilters).toString();
    return apiFetch(`/transactions/history/export?${params}`);
  },
};

// ─── USER PROFILE ─────────────────────────────────────────────────────────────
export const userService = {
  getProfile: () => apiFetch("/user/profile"),
  getUserServices: async () => {
    try {
      const rawUser = localStorage.getItem('rupiksha_imp_user') || localStorage.getItem('rupiksha_user');
      const userObj = rawUser ? JSON.parse(rawUser) : null;
      const uid = userObj?.id || userObj?._id || userObj?.username || userObj?.mobile;

      let localParsed = {};
      if (uid) {
        const localSvcs = localStorage.getItem(`rupiksha_services_${uid}`) || localStorage.getItem(`rupiksha_services_${userObj?.mobile}`) || localStorage.getItem(`rupiksha_services_${userObj?.username}`);
        if (localSvcs) {
          try { localParsed = JSON.parse(localSvcs); } catch (_) {}
        }
      }

      let res = null;
      try {
        res = await apiFetch("/user/services");
      } catch (_) {}

      const baseSvcs = {
        AEPS: true,
        AEPS_BANKING: true,
        BBPS: true,
        RECHARGE: true,
        PAYOUT: true,
        WALLET_TRANSFER: true,
        TICKET_SUPPORT: true
      };

      if (res && typeof res === 'object') {
        return { ...baseSvcs, ...res, ...localParsed };
      }
      return { ...baseSvcs, ...localParsed };
    } catch (_) {
      return { AEPS: true, AEPS_BANKING: true, BBPS: true, RECHARGE: true, PAYOUT: true, WALLET_TRANSFER: true, TICKET_SUPPORT: true };
    }
  },
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
  sendOtp: (mobile) =>
    apiFetch("/otp/send", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    }),
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
  resendOtp: (mobile) =>
    apiFetch("/otp/resend", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    }),
};

// ─── KYC ONBOARDING SERVICE ───────────────────────────────────────────────────
export const kycService = {
  submitKyc: (payload) =>
    apiFetch("/user/submit-kyc", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getKycStatus: () => apiFetch("/user/kyc-status"),
};

// ─── ADMIN MANAGEMENT SERVICE ─────────────────────────────────────────────────
export const adminService = {
  getUsers: () => apiFetch("/admin/users"),
  getApprovals: () => apiFetch("/admin/approvals"),
  getPendingKyc: () => apiFetch("/admin/kyc/pending"),
  getAllKyc: () => apiFetch("/admin/kyc/all"),
  getKycDetail: (id) => apiFetch(`/admin/kyc/${id}`),
  decideKyc: (id, action, remarks) =>
    apiFetch(`/admin/kyc/${id}`, {
      method: "POST",
      body: JSON.stringify({ action, remarks }),
    }),
  updateUserStatus: (id, status) =>
    apiFetch(`/admin/users/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  resetUserPassword: (id, newPassword) =>
    apiFetch(`/admin/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    }),
  resetUserPin: (id, newPin) =>
    apiFetch(`/admin/users/${id}/reset-pin`, {
      method: "POST",
      body: JSON.stringify({ newPin }),
    }),
  changeParent: (id, parentIdentifier) =>
    apiFetch(`/admin/users/${id}/change-parent`, {
      method: "POST",
      body: JSON.stringify({ parentIdentifier }),
    }),
  getCandidateParents: (role) => apiFetch(`/admin/parents${role ? `?role=${role}` : ''}`),
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

// ─── PAYOUT SERVICE ────────────────────────────────────────────────────────────
export const payoutService = {
  // Initiate a payout transaction
  initiatePayout: (payoutData) =>
    apiFetch("/payout/initiate", {
      method: "POST",
      body: JSON.stringify(payoutData),
    }),

  // Get transaction by orderId
  getTransaction: (orderId) =>
    apiFetch(`/payout/transaction/${encodeURIComponent(orderId)}`),

  // Get all transactions for logged-in user
  getTransactions: () =>
    apiFetch("/payout/transactions"),

  // Get transactions by status
  getTransactionsByStatus: (status) =>
    apiFetch(`/payout/transactions/status/${encodeURIComponent(status)}`),

  // Get transactions within date range
  getTransactionsByDateRange: (startDate, endDate) =>
    apiFetch(`/payout/transactions/date-range?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`),

  // Generate unique order ID
  generateOrderId: () =>
    apiFetch("/payout/generate-order-id"),

  // Health check
  health: () =>
    apiFetch("/payout/health"),
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

// ─── AEPS / Aadhaar Enabled Payment System ───────────────────────────────────
export const aepsService = {
  getStatus: (mobile, provider) => apiFetch(`/aeps/status?mobile=${encodeURIComponent(mobile)}${provider ? `&provider=${encodeURIComponent(provider)}` : ''}`),
  onboard: (payload) =>
    apiFetch("/aeps/onboard", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  validateRdTest: (pidXml) =>
    apiFetch("/aeps/rd/test", {
      method: "POST",
      body: JSON.stringify({ pidXml }),
    }),
  submitKyc: (payload) =>
    apiFetch("/aeps/aeps-kyc", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  verifyOtp: (otp) =>
    apiFetch("/aeps/otp-verify", {
      method: "POST",
      body: JSON.stringify({ otp }),
    }),
  dailyAuthenticate: (payload) =>
    apiFetch("/aeps/daily-authenticate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};


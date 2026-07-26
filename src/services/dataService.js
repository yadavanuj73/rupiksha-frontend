import { sendOTPEmail, sendCredentialsEmail } from './emailService';
import { BACKEND_URL } from './config';
import { generateUniquePartyCode } from '../database/partyCode';
import { mockApiService } from '../database/mockApiService';
import { walletService, transactionService, supportService } from './apiService';
// Using logo from public folder - referenced directly in code
const mainLogo = '/rupiksha logo.jpeg';
export { BACKEND_URL };

// ── Safe JSON parser: prevents "Unexpected end of JSON input" crashes ──────
// Always read as text first, then parse. Returns fallback on empty/invalid body.
async function safeJson(res, fallback = {}) {
    try {
        const text = await res.text();
        if (!text || text.trim() === '') return fallback;
        return JSON.parse(text);
    } catch {
        return fallback;
    }
}

// ── Auth-aware fetch: clears stale token and redirects to login on 401 ──────
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('rupiksha_token');
    const headers = {
        ...(options.headers || {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        const isAdminTab = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
        if (!isAdminTab) {
            console.warn('[authFetch] 401 on', url, '— token expired, clearing session');
            localStorage.removeItem('rupiksha_token');
            localStorage.removeItem('rupiksha_user');
            window.location.href = '/login';
        }
    }
    return res;
}

// Live-only mode. The "local only" fallback has been removed to prevent
// mock data or impersonation tokens from reaching the real backend. The variable
// is kept here as a constant so the many legacy `if (useLocalOnly)` branches
// compile without changes, but they will all short-circuit to false and force
// the code through the real API path.
const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname.startsWith('192.168.'));
const useLocalOnly = false;

const normalizeRoleForBackend = (role) => {
    const raw = String(role || '').trim().toLowerCase();
    if (raw === 'retailer' || raw === 'retailers') return 'retailer';
    if (raw === 'distributor' || raw === 'distributors') return 'distributor';
    if (raw === 'super distributor' || raw === 'super_distributor' || raw === 'super-distributor' || raw === 'SUPER_DISTRIBUTOR' || raw === 'Super Distributor') return 'super_distributor';
    // Existing app roles often come in uppercase enum-like values
    if (raw === 'retailer'.toUpperCase().toLowerCase()) return 'retailer';
    if (raw === 'distributor'.toUpperCase().toLowerCase()) return 'distributor';
    if (raw === 'super_distributor'.toUpperCase().toLowerCase()) return 'super_distributor';
    return raw || 'retailer';
};

const normalizeRoleForClient = (role) => {
    // Handle role objects like {name: "ADMIN"} from Java backend
    const roleStr = (typeof role === 'object' && role !== null) ? (role.name || '') : role;
    const raw = normalizeRoleForBackend(roleStr);
    if (raw === 'retailer') return 'RETAILER';
    if (raw === 'distributor') return 'DISTRIBUTOR';
    if (raw === 'super_distributor') return 'SUPER_DISTRIBUTOR';
    return String(roleStr || 'RETAILER').trim().replace(/^ROLE_/i, '').toUpperCase();
};

const ROLE_PRIORITY = [
    'ADMIN',
    'NATIONAL_HEADER',
    'STATE_HEADER',
    'REGIONAL_HEADER',
    'EMPLOYEE',
    'SUPER_DISTRIBUTOR',
    'DISTRIBUTOR',
    'RETAILER'
];

const pickDeterministicRole = (roles = [], preferred = null) => {
    const unique = Array.from(new Set((roles || []).map((r) => normalizeRoleForClient(r)).filter(Boolean)));
    const preferredNorm = normalizeRoleForClient(preferred);
    if (preferredNorm && unique.includes(preferredNorm)) return preferredNorm;
    return ROLE_PRIORITY.find((r) => unique.includes(r)) || unique[0] || 'RETAILER';
};


export const dataService = {
    // --- AUTH & LOGIN ---
    requestRegistration: async function (data) {
        const username = data.username || data.mobile || data.email;
        const normalizedRole = normalizeRoleForBackend(data.role);

        if (useLocalOnly) {
            const localData = this.getData();
            const newUser = {
                ...data,
                username,
                role: normalizedRole,
                status: 'pending',
                balance: '0.00',
                id: 'REQ-' + Math.floor(1000 + Math.random() * 9000)
            };
            if (!localData.users.find(u => u.username === username)) {
                localData.users.push(newUser);
                this.saveData(localData);
            }
            return { success: true, message: "Registration request submitted successfully.", registrationId: newUser.id };
        }

        // Java backend RegisterRequest accepts the core auth fields plus optional
        // profile attributes (state/city/pincode/address/businessName). Sending
        // state is important so the admin's approval modal can auto-generate a
        // state-coded party code (e.g. RPRBR######).
        const payload = {
            username,
            mobile: String(data.mobile || username || '').trim(),
            email: String(data.email || '').trim(),
            fullName: String(data.name || data.fullName || data.firstName || username || '').trim(),
            password: String(data.password || '').trim(),
            role: normalizedRole.toUpperCase(),
            state: String(data.state || data.stateName || '').trim() || null,
            // Backward-compatible alias for older backends that expected stateName.
            stateName: String(data.stateName || data.state || '').trim() || null,
            city: String(data.city || '').trim() || null,
            pincode: String(data.pincode || data.pin || '').trim() || null,
            address: String(data.address || data.addressLine1 || '').trim() || null,
            businessName: String(data.businessName || data.shopName || '').trim() || null,
            addedByUserRef: String(data.addedByUserRef || data.uplineId || '').trim() || null,
            addedByName: String(data.addedByName || '').trim() || null,
            addedByRole: String(data.addedByRole || data.uplineRole || '').trim() || null,
            addedByPartyCode: String(data.addedByPartyCode || '').trim() || null
        };

        const url = `${BACKEND_URL}/auth/register`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const body = await safeJson(res, null);
            if (!res.ok) {
                const fieldErrors = body && body.errors && typeof body.errors === 'object'
                    ? Object.entries(body.errors).map(([f, m]) => `${f}: ${m}`).join(', ')
                    : '';
                const baseMsg = body?.message || body?.error || `Server error (${res.status})`;
                const msg = fieldErrors ? `${baseMsg} — ${fieldErrors}` : baseMsg;
                return { success: false, message: msg };
            }
            // Backend returns UserView directly
            return {
                success: true,
                message: "Registration request submitted successfully. Please wait for admin approval.",
                registrationId: body?.id,
                user: body
            };
        } catch (e) {
            return { success: false, message: "Server connection failed: " + e.message };
        }
    },
    registerUser: async function (data, parentId = null) {
        const username = data.mobile || data.email;
        const normalizedRole = normalizeRoleForBackend(data.role);
        const newUser = {
            ...data,
            username: username,
            role: normalizedRole,
            parent_id: parentId,
            status: 'pending'
        };

        if (useLocalOnly) {
            const localData = this.getData();
            if (!localData.users.find(u => u.username === username)) {
                localData.users.push(newUser);
                this.saveData(localData);
            }
            return { success: true, message: "User registered successfully." };
        }

        const url = `${BACKEND_URL}/register`;
        console.log("Attempting Direct Register at:", url);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            if (!res.ok) {
                return { success: false, message: `Server error (${res.status})` };
            }
            return await safeJson(res, { success: false, message: "Server connection failed: Invalid response" });
        } catch (e) {
            console.error("Direct Register Failed:", e);
            return { success: false, message: "Server connection failed: " + e.message };
        }
    },

    adminAddUser: async function (userData) {
        if (useLocalOnly) {
            const data = this.getData();
            const newUser = {
                id: Date.now(),
                username: userData.mobile,
                name: userData.name,
                role: userData.role,
                status: 'Approved',
                balance: '0.00'
            };
            data.users.push(newUser);
            this.saveData(data);
            return { success: true, message: "User added successfully." };
        }
        try {
            const token = localStorage.getItem('rupiksha_token');
            const res = await fetch(`${BACKEND_URL}/admin/add-user`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    username: userData.mobile,
                    password: userData.password,
                    fullName: userData.name,
                    phone: userData.mobile,
                    email: userData.email,
                    role: userData.role,
                    shopName: userData.businessName,
                    territory: userData.state,
                    pin: userData.pin,
                    partyCode: userData.partyCode
                })
            });
            return await res.json();
        } catch (e) {
            return { success: false, message: "Server connection failed" };
        }
    },

    loginUser: async function (username, password, location = null, expectedPortalRole = null) {
        const expected = normalizeRoleForClient(expectedPortalRole);
        const isRoleAllowedForPortal = (role) => {
            if (!expectedPortalRole) return true;
            const normalized = normalizeRoleForClient(role);
            if (expected === 'DISTRIBUTOR') {
                return normalized === 'DISTRIBUTOR';
            }
            if (expected === 'RETAILER') {
                return normalized === 'RETAILER';
            }
            if (expected === 'SUPER_DISTRIBUTOR' || expected === 'SUPER_DISTRIBUTOR') {
                return normalized === 'SUPER_DISTRIBUTOR';
            }
            return normalized === expected;
        };

        try {
            const res = await fetch(`${BACKEND_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await safeJson(res, null);

            if (!res.ok || !data) {
                const serverMessage = data?.message || data?.error;
                if (res.status === 401 || res.status === 400) {
                    return { success: false, message: serverMessage || 'Invalid credentials.' };
                }
                return { success: false, message: serverMessage || `Login failed (${res.status}). Please try again.` };
            }

            // Java backend AuthResponse shape: { accessToken, refreshToken, user: { id, username, fullName, status, kycStatus, roles[], createdAt } }
            const backendUser = data.user || {};
            const rolesArrRaw = Array.isArray(backendUser.roles) ? backendUser.roles.map((r) => normalizeRoleForClient(r)) : [];
            const fallbackRole = normalizeRoleForClient(backendUser.role);
            const rolesArr = Array.from(new Set([...(rolesArrRaw || []), ...(fallbackRole ? [fallbackRole] : [])]));
            const primaryRole = pickDeterministicRole(rolesArr, expectedPortalRole);

            const normalizedUser = {
                id: backendUser.id,
                username: backendUser.username,
                mobile: backendUser.mobile,
                email: backendUser.email,
                name: backendUser.fullName,
                fullName: backendUser.fullName,
                status: backendUser.status,
                kycStatus: backendUser.kycStatus,
                roles: rolesArr,
                role: primaryRole,
                createdAt: backendUser.createdAt,
            };

            if (!isRoleAllowedForPortal(normalizedUser.role)) {
                return { success: false, message: 'Invalid credentials.' };
            }

            localStorage.removeItem('rupiksha_imp_token');
            localStorage.removeItem('rupiksha_imp_user');
            localStorage.setItem('rupiksha_user', JSON.stringify(normalizedUser));
            localStorage.setItem('rupiksha_token', data.accessToken);
            if (data.refreshToken) localStorage.setItem('rupiksha_refresh_token', data.refreshToken);
            return { success: true, user: normalizedUser, token: data.accessToken };
        } catch (e) {
            return { success: false, message: "Server connection failed. Please check your internet connection or try again in a moment. (" + (e?.message || 'network error') + ")" };
        }
    },

    getCurrentUser: function () {
        const impToken = localStorage.getItem('rupiksha_imp_token');
        const impUser = localStorage.getItem('rupiksha_imp_user');
        const isAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
        if (impToken && impUser && !isAdminPath) {
            try {
                return JSON.parse(impUser);
            } catch (e) {}
        }
        const saved = localStorage.getItem('rupiksha_user');
        return saved ? JSON.parse(saved) : null;
    },

    logoutUser: function () {
        localStorage.removeItem('rupiksha_user');
        localStorage.removeItem('rupiksha_token');
        window.location.href = '/';
    },

    refreshData: async function () {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return;
        if (useLocalOnly) {
            const user = this.getUserByUsername(currentUser.username);
            if (user) {
                localStorage.setItem('rupiksha_user', JSON.stringify(user));
                window.dispatchEvent(new Event('dataUpdated'));
                return user;
            }
            return currentUser;
        }
        try {
            const res = await fetch(`${BACKEND_URL}/refresh-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('rupiksha_user', JSON.stringify(data.user));
                window.dispatchEvent(new Event('dataUpdated'));
                return data.user;
            }
        } catch (e) {
            console.error("Failed to refresh data", e);
        }
    },

    updateUserProfile: async function (profileData) {
        if (useLocalOnly) {
            const currentUser = this.getCurrentUser();
            const data = this.getData();
            const idx = data.users.findIndex(u => u.username === currentUser.username);
            const updated = { ...currentUser, ...profileData };
            if (idx !== -1) data.users[idx] = updated;
            localStorage.setItem('rupiksha_user', JSON.stringify(updated));
            this.saveData(data);
            return true;
        }
        try {
            const currentUser = this.getCurrentUser();
            const res = await fetch(`${BACKEND_URL}/update-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, ...profileData })
            });
            const data = await res.json();
            if (data.success) {
                const updatedUser = { ...currentUser, ...data.user };
                localStorage.setItem('rupiksha_user', JSON.stringify(updatedUser));
                window.dispatchEvent(new Event('dataUpdated'));
                return true;
            }
            return false;
        } catch (e) {
            console.error("Update profile failed:", e);
            return false;
        }
    },

    adminUpdateUser: async function (userId, profileData) {
        if (useLocalOnly) {
            const data = this.getData();
            const idx = data.users.findIndex(u => u.id === userId || u.username === userId);
            if (idx !== -1) {
                data.users[idx] = { ...data.users[idx], ...profileData };
                this.saveData(data);
                return { success: true };
            }
            return { success: false, message: "User not found" };
        }
        try {
            const res = await fetch(`${BACKEND_URL}/update-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, ...profileData })
            });
            return await res.json();
        } catch (e) { return { success: false, message: e.message }; }
    },

    fetchSales: async function (userId, date) {
        if (useLocalOnly) return { success: true, sales: [] };
        try {
            const res = await fetch(`${BACKEND_URL}/fetch-sales`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, date })
            });
            return await res.json();
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    getTopMerchants: async function (period, state) {
        if (useLocalOnly) return { success: true, merchants: [] };
        try {
            const res = await fetch(`${BACKEND_URL}/top-merchants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ period, state })
            });
            return await res.json();
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    // --- WALLET & TRANSACTIONS ---
    getWalletBalance: async function (userId) {
        if (useLocalOnly) {
           const user = this.getCurrentUser();
           return user ? (user.balance || "0.00") : "0.00";
        }
        try {
            const data = await walletService.getBalance(userId);
            const nextBal = String(data?.balance ?? "0.00");
            const current = this.getCurrentUser();
            if (current) {
                localStorage.setItem('rupiksha_user', JSON.stringify({ ...current, balance: nextBal }));
            }
            return nextBal;
        } catch (e) {
            // Fallback: return cached user balance on any error
            const user = this.getCurrentUser();
            return user ? (user.balance || "0.00") : "0.00";
        }
    },

    logTransaction: async function (userId, service, amount, operator, number, status) {
        if (useLocalOnly) {
            const user = this.getCurrentUser();
            const curBal = parseFloat(user.balance || 0);
            let newBal = curBal;
            if (service.includes('AEPS_WITHDRAWAL') || service.includes('AEPS_AADHAAR_PAY') || service === 'ADD_FUNDS') {
                newBal = (curBal + parseFloat(amount)).toFixed(2);
            } else {
                newBal = (curBal - parseFloat(amount)).toFixed(2);
            }
            const updatedUser = { ...user, balance: newBal };
            localStorage.setItem('rupiksha_user', JSON.stringify(updatedUser));
            
            const data = this.getData();
            data.transactions.push({
                id: Date.now(),
                userId, service, amount, operator, number, status,
                created_at: new Date().toISOString()
            });
            this.saveData(data);
            return true;
        }
        try {
            const data = await transactionService.logTransaction({ userId, service, amount, operator, number, status });

            if (data.success && status === 'SUCCESS') {
                const user = this.getCurrentUser();
                const curBal = parseFloat(user.balance || 0);
                let newBal = curBal;
                if (service.includes('AEPS_WITHDRAWAL') || service.includes('AEPS_AADHAAR_PAY') || service === 'ADD_FUNDS') {
                    newBal = (curBal + parseFloat(amount)).toFixed(2);
                }
                else if (service.includes('AEPS_CASH_DEPOSIT') || service.includes('RECHARGE') || service.includes('BILL_PAY')) {
                    newBal = (curBal - parseFloat(amount)).toFixed(2);
                } else {
                    newBal = (curBal - parseFloat(amount)).toFixed(2);
                }
                localStorage.setItem('rupiksha_user', JSON.stringify({ ...user, balance: newBal }));
            }
            return data.success;
        } catch (e) { return false; }
    },

    getUserTransactions: async function (userId) {
        if (useLocalOnly) {
            return (this.getData().transactions || []).filter(t => t.userId === userId);
        }
        try {
            const data = await transactionService.getMine(userId);
            return data?.transactions || [];
        } catch (e) { return []; }
    },

    // --- KYC ---
    uploadKyc: async function (kycData) {
        if (useLocalOnly) return { success: true, message: "KYC documents uploaded successfully." };
        try {
            const res = await fetch(`${BACKEND_URL}/upload-kyc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(kycData)
            });
            return await res.json();
        } catch (e) { return { success: false, message: "KYC Upload Failed" }; }
    },

    getKycStatus: async function (userId) {
        if (useLocalOnly) return [];
        try {
            const res = await fetch(`${BACKEND_URL}/kyc-status?userId=${userId}`);
            const data = await res.json();
            return data.success ? data.documents : [];
        } catch (e) { return []; }
    },

    submitKyc: async function (username, type, kycData = {}) {
        if (useLocalOnly) {
            const data = this.getData();
            const userIdx = data.users.findIndex(u => u.username === username || u.mobile === username);
            if (userIdx !== -1) {
                if (type === 'MAIN') data.users[userIdx].profile_kyc_status = 'PENDING';

                this.saveData(data);
            }
            return { success: true, message: "KYC application submitted for review." };
        }
        try {
            const endpoint = '/submit-profile-kyc';
            const payload = { ...kycData };
            if (type === 'MAIN') {
                payload.fullName = kycData.fullName;
                payload.shopSelfie = kycData.shopPhoto || kycData.shopSelfie;
                payload.userId = username;
            } else {
                payload.userId = username;
            }

            const res = await fetch(`${BACKEND_URL}${endpoint}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('rupiksha_token')}`
                },
                body: JSON.stringify(payload)
            });
            const resData = await res.json();
            
            if (resData.success) {
                const data = this.getData();
                const userIdx = data.users.findIndex(u => u.username === username || u.mobile === username);
                if (userIdx !== -1) {
                    if (type === 'MAIN') {
                        data.users[userIdx].profile_kyc_status = 'PENDING';
                    }
                    this.saveData(data);
                }
                return { success: true, ...resData };
            }
            return resData;
        } catch (e) {
            console.error("KYC Submission error:", e);
            return { success: false, message: e.message };
        }
    },

    submitAepsKyc: async function (userId, kycData) {
        if (useLocalOnly) {
            const data = this.getData();
            const userIdx = data.users.findIndex(u => u.id === userId || u.username === userId);
            if (userIdx !== -1) {
                data.users[userIdx].aeps_kyc_status = 'PENDING';
                data.users[userIdx].aeps_kyc_details = kycData;
                this.saveData(data);
            }
            return { status: true, message: "AEPS KYC submitted successfully." };
        }
        try {
            // Frontend -> Main Backend logic with JAR details
            const panImageBase64 = kycData.panImage ? kycData.panImage.split(',')[1] : null;
            const shopImageBase64 = kycData.shopImage ? kycData.shopImage.split(',')[1] : null;
            const businessProofBase64 = kycData.businessProof ? kycData.businessProof.split(',')[1] : null;
            const chequeImageBase64 = kycData.chequeImage ? kycData.chequeImage.split(',')[1] : null;
            const physicalVerificationBase64 = kycData.physicalVerification ? kycData.physicalVerification.split(',')[1] : null;
            const videoKycBase64 = kycData.videoKyc ? kycData.videoKyc.split(',')[1] : null;

            const payload = {
                userId: userId,
                jarConfig: {
                    username: "rupikshad",
                    password: "796c3ee556ac31f3754a38cfd15b8044",
                    ipAddress: "223.235.103.251",
                    superMerchantId: 1407,
                    fingpayUrl: `http://13.232.173.241:9090/aeps/onboard?userId=${userId}`
                },
                latitude: parseFloat(kycData.latitude || 28.6139),
                longitude: parseFloat(kycData.longitude || 77.2090),
                VedioKycWithLatLongData: videoKycBase64, // Root level alternative
                merchant: {
                    merchantLoginPin: kycData.merchantLoginPin,
                    firstName: kycData.firstName,
                    middleName: kycData.middleName || "",
                    lastName: kycData.lastName,
                    merchantPhoneNumber: kycData.merchantPhoneNumber,
                    merchantAddress: {
                        merchantAddress1: kycData.merchantAddress1,
                        merchantAddress2: kycData.merchantAddress2 || "",
                        merchantState: parseInt(kycData.merchantState),
                        merchantCityName: kycData.merchantCityName,
                        merchantDistrictName: kycData.merchantDistrictName,
                        merchantPinCode: kycData.merchantPinCode
                    },
                    companyLegalName: kycData.companyLegalName,
                    companyType: parseInt(kycData.companyType),
                    emailId: kycData.emailId,
                    kyc: {
                        userPan: kycData.userPan,
                        aadhaarNumber: kycData.aadhaarNumber,
                        gstinNumber: kycData.gstinNumber || "",
                        companyOrShopPan: kycData.companyOrShopPan,
                        // Secondary location for images
                        panImage: panImageBase64,
                        shopImage: shopImageBase64,
                        tradeBusinessProof: businessProofBase64,
                        cancelledChequeImages: chequeImageBase64,
                        physicalVerification: physicalVerificationBase64,
                        VedioKycWithLatLongData: videoKycBase64
                    },
                    settlementV1: {
                        companyBankAccountNumber: kycData.companyBankAccountNumber,
                        bankIfscCode: kycData.bankIfscCode,
                        companyBankName: (kycData.companyBankName || "").toUpperCase(),
                        bankName: (kycData.companyBankName || "").toUpperCase(),
                        bankAccountName: kycData.bankAccountName
                    },
                    merchantKycAddressData: {
                        shopAddress: kycData.shopAddress,
                        shopCity: kycData.shopCity,
                        shopDistrict: kycData.shopDistrict,
                        shopState: parseInt(kycData.shopState),
                        shopPincode: kycData.shopPincode,
                        shopLatitude: parseFloat(kycData.latitude || 28.6139),
                        shopLongitude: parseFloat(kycData.longitude || 77.2090)
                    },
                    // Original location for images
                    panImage: panImageBase64,
                    shopImage: shopImageBase64,
                    tradeBusinessProof: businessProofBase64,
                    cancelledChequeImages: chequeImageBase64,
                    physicalVerification: physicalVerificationBase64,
                    VedioKycWithLatLongData: videoKycBase64,
                    
                    termsConditionCheck: true,
                    merchantStatus: true
                }
            };

            const res = await fetch(`${BACKEND_URL}/submit-aeps-kyc`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('rupiksha_token')}`
                },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
                 return { success: false, message: `Server error: ${res.status}` };
            }
            return await res.json();
        } catch (e) {
            return { success: false, message: "Backend connection failed. Ensure port 8080 is running." };
        }
    },

    async getPendingKycs(type) {
        try {
            const token = localStorage.getItem('rupiksha_token');
            const res = await fetch(`${BACKEND_URL}/admin/kyc/pending`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const raw = await safeJson(res, null);
            if (!res.ok || !Array.isArray(raw)) {
                return { success: false, kycs: [], message: raw?.message || `HTTP ${res.status}` };
            }
            const extractRole = (u) => {
                // /admin/kyc/pending returns raw User entities, whose roles Set is
                // serialized as [{ id, name: "RETAILER" | ... }]. Earlier admin flows
                // flatten to a string, so accept either shape.
                if (Array.isArray(u?.roles) && u.roles.length) {
                    const first = u.roles[0];
                    if (typeof first === 'string') return first.toUpperCase();
                    if (first && first.name) return String(first.name).toUpperCase();
                }
                if (typeof u?.role === 'string' && u.role) return u.role.toUpperCase();
                return 'RETAILER';
            };
            const kycs = raw.map((u) => {
                const role = extractRole(u);
                return {
                    id: u.id,
                    _id: u.id,
                    loginId: u.username,
                    username: u.username,
                    fullName: u.fullName || u.name,
                    name: u.fullName || u.name,
                    userMobile: u.mobile,
                    userEmail: u.email,
                    mobile: u.mobile,
                    email: u.email,
                    role,
                    roles: Array.isArray(u?.roles)
                        ? u.roles.map((r) => (typeof r === 'string' ? r : r?.name)).filter(Boolean)
                        : [role],
                    businessName: u.businessName || null,
                    created_at: u.kycSubmittedAt || u.createdAt,
                    kycSubmittedAt: u.kycSubmittedAt,
                    kycStatus: u.kycStatus,
                    status: u.status,
                    aadhaarNumber: u.aadhaarNumber,
                    panNumber: u.panNumber,
                    photoUrl: u.photoUrl,
                    aadhaarPhotoUrl: u.aadhaarPhotoUrl,
                    panPhotoUrl: u.panPhotoUrl,
                    addressLine1: u.addressLine1,
                    city: u.city,
                    stateName: u.stateName,
                    pincode: u.pincode,
                    merchant_id: u.merchantId || null
                };
            });
            return { success: true, kycs };
        } catch (e) {
            return { success: false, kycs: [], message: e.message };
        }
    },

    _resolveUserIdForKyc: async function (identifier) {
        if (!identifier) return null;
        const str = String(identifier);
        // Already a UUID?
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
            return str;
        }
        try {
            const token = localStorage.getItem('rupiksha_token');
            const res = await fetch(`${BACKEND_URL}/admin/users`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await safeJson(res, null);
            const users = Array.isArray(data?.users) ? data.users : [];
            const match = users.find((u) =>
                u?.username === str || u?.mobile === str || u?.email === str
                || u?.id === str || u?._id === str
            );
            return match?.id || match?._id || null;
        } catch { return null; }
    },

    approveKyc: async function (identifier /*, type, merchantId*/) {
        try {
            const token = localStorage.getItem('rupiksha_token');
            const userId = await this._resolveUserIdForKyc(identifier);
            if (!userId) return { success: false, message: 'User not found' };
            const res = await fetch(`${BACKEND_URL}/admin/kyc/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ action: 'approve' })
            });
            const resData = await safeJson(res, null);
            if (res.ok) return { success: true, ...resData };
            return { success: false, message: resData?.message || resData?.error || `HTTP ${res.status}` };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    rejectKyc: async function (identifier, _type, reason = '') {
        try {
            const token = localStorage.getItem('rupiksha_token');
            const userId = await this._resolveUserIdForKyc(identifier);
            if (!userId) return { success: false, message: 'User not found' };
            const res = await fetch(`${BACKEND_URL}/admin/kyc/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ action: 'reject', remarks: reason || 'Rejected by admin' })
            });
            const resData = await safeJson(res, null);
            if (res.ok) return { success: true, ...resData };
            return { success: false, message: resData?.message || resData?.error || `HTTP ${res.status}` };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    sendAadhaarOTP: async function (username) {
        // Simulation: In production this would hit an UIDAI AUA/KSA provider
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const user = this.getUserByUsername(username);

        // Use existing email service to simulated phone OTP for dev
        if (user && user.email) {
            await sendOTPEmail(user.email, otp, user.name || "Retailer");
            return { success: true, otp: otp }; // Returning actual OTP for mock testing
        }
        return { success: false, message: "User contact not found" };
    },

    verifyPAN: async function (pan) {
        if (useLocalOnly) return { success: true, name: "DEMO USER", status: "VALID" };
        try {
            const response = await fetch(`${BACKEND_URL}/verify-pan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pan })
            });
            return await response.json();
        } catch (error) {
            console.error("PAN Verification Error:", error);
            return { success: false, message: "Server connection failed" };
        }
    },

    verifyAadhaarName: async function (aadhaar) {
        if (useLocalOnly) return { success: true, name: "DEMO USER" };
        try {
            const response = await fetch(`${BACKEND_URL}/verify-aadhaar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aadhaar })
            });
            return await response.json();
        } catch (error) {
            console.error("Aadhaar Verification Error:", error);
            return { success: false, message: "Server connection failed" };
        }
    },

    verifyAadhaar: async function (aadhaar) {
        return this.verifyAadhaarName(aadhaar);
    },

    verifyAadhaarBiometric: async function (aadhaar, pidData, mobile) {
        if (useLocalOnly) return { success: true, message: "Fingerprint matched successfully." };
        try {
            const response = await fetch(`${BACKEND_URL}/verify-aadhaar-biometric`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aadhaar, pidData, mobile })
            });
            return await response.json();
        } catch (error) {
            console.error("Biometric Verification Error:", error);
            return { success: false, message: "Server connection failed" };
        }
    },

    createDigiLockerSession: async function (aadhaar) {
        if (useLocalOnly) return { success: true, session_id: "RUP-SESS-9921" };
        try {
            const response = await fetch(`${BACKEND_URL}/verify-aadhaar-digilocker`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aadhaar })
            });
            return await response.json();
        } catch (error) {
            console.error("DigiLocker Session Error:", error);
            return { success: false, message: "Server connection failed" };
        }
    },

    verifyAadhaarBiometricOtp: async function (aadhaar, otp) {
        if (useLocalOnly) return { success: true, message: "OTP verified updated successfully." };
        try {
            const response = await fetch(`${BACKEND_URL}/verify-aadhaar-biometric-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aadhaar, otp })
            });
            return await response.json();
        } catch (error) {
            console.error("Biometric OTP Error:", error);
            return { success: false, message: "Server connection failed" };
        }
    },


    // --- SUPPORT ---
    raiseTicket: async function (ticketData) {
        try {
            return await supportService.raiseTicket(ticketData);
        } catch (e) { return { success: false, message: "Failed to raise ticket" }; }
    },

    getMyTickets: async function (userId) {
        try {
            const data = await supportService.myTickets(userId);
            return data?.tickets || [];
        } catch (e) { return []; }
    },

    // --- PORTAL CONFIG ---
    getPortalConfig: async function () {
        try {
            const res = await fetch(`${BACKEND_URL}/portal-config`);
            const data = await res.json();
            return data.success ? data.config : null;
        } catch (e) { return null; }
    },

    getCommissions: async function () {
        try {
            const res = await fetch(`${BACKEND_URL}/commissions`);
            const data = await res.json();
            return data.success ? data.commissions : [];
        } catch (e) { return []; }
    },

    // --- HELPERS ---
    verifyLocation: function () {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject('Geolocation not supported');
            } else {
                navigator.geolocation.getCurrentPosition(
                    (p) => resolve({ lat: p.coords.latitude.toFixed(6), long: p.coords.longitude.toFixed(6) }),
                    (e) => reject('Location access denied')
                );
            }
        });
    },

    generateOTP: function () {
        return Math.floor(100000 + Math.random() * 900000).toString();
    },

    sendEmployeeVerificationOTP: async function (email, name) {
        const otp = this.generateOTP();
        const res = await sendOTPEmail(email, otp, name);
        if (res.success) {
            return { success: true, otp };
        }
        return res;
    },

    sendEmployeeLoginOTP: async function (email, name) {
        const otp = this.generateOTP();
        const res = await sendOTPEmail(email, otp, name);
        if (res.success) {
            return { success: true, otp };
        }
        return res;
    },

    sendEmployeeCredentials: async function (email, name, loginId, password, addedBy, role) {
        return await sendCredentialsEmail({
            to: email,
            name: name,
            loginId: loginId,
            password: password,
            addedBy: addedBy,
            portalType: role
        });
    },

    // --- ADMIN OVERSIGHT ---
    getAllUsers: async function () {
        try {
            const res = await authFetch(`${BACKEND_URL}/admin/users`);
            const data = await safeJson(res, null);
            if (res.ok && data?.success && Array.isArray(data.users)) return data.users;
            console.warn('[getAllUsers] /admin/users failed:', res.status, data);
        } catch (e) { console.error('[getAllUsers] fetch error:', e); }

        // Backend may not implement /admin/users in lightweight setups.
        // Fallback to role-wise pending approvals from live APIs so Admin approvals still work.
        try {
            const [retailRes, distRes, superDistRes] = await Promise.all([
                this.getPendingApprovalsByRole('retailer'),
                this.getPendingApprovalsByRole('distributor'),
                this.getPendingApprovalsByRole('super_distributor')
            ]);

            const pendingOnly = [
                ...(retailRes?.users || []),
                ...(distRes?.users || []),
                ...(superDistRes?.users || [])
            ];

            const uniqueByKey = new Map();
            // Backend pending rows always win — never let stale local data hide real pending users.
            for (const user of pendingOnly) {
                const key = user?._id || user?.id || user?.username || user?.mobile;
                if (!key) continue;
                uniqueByKey.set(String(key), user);
            }
            if (uniqueByKey.size > 0) return Array.from(uniqueByKey.values());
        } catch (e) { }

        return this.getData().users || [];
    },


    getAllTransactions: async function () {
        if (useLocalOnly) return this.getData().transactions || [];
        try {
            const res = await fetch(`${BACKEND_URL}/all-transactions`);
            const data = await res.json();
            return data.success ? data.transactions : [];
        } catch (e) { return []; }
    },

    getTrashUsers: async function () {
        try {
            const token = localStorage.getItem('rupiksha_token');
            const res = await fetch(`${BACKEND_URL}/admin/trash-users`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await safeJson(res, null);
            if (res.ok && data?.success && Array.isArray(data.users)) return data.users;
            return [];
        } catch (e) { return []; }
    },

    getLoans: async function () {
        if (useLocalOnly) {
            return this.getData().loans || [];
        }
        try {
            const token = localStorage.getItem('rupiksha_token');
            const res = await fetch(`${BACKEND_URL}/loan/all`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            return Array.isArray(data) ? data : (data.success ? data.loans : []);
        } catch (e) { 
            console.error("Fetch Loans failed, using local", e);
            return this.getData().loans || []; 
        }
    },

    updateLoanStatus: async function (trackingId, status) {
        if (useLocalOnly) {
            const data = this.getData();
            const idx = data.loans.findIndex(l => l.tracking_id === trackingId);
            if (idx !== -1) {
                data.loans[idx].status = status;
                if (status === 'approved') {
                    data.loans[idx].offer_amount = 250000;
                    data.loans[idx].lender_name = 'HDFC BANK';
                }
                this.saveData(data);
                return { success: true, message: `Status updated to ${status} successfully.` };
            }
            return { success: false, message: 'Application not found in local db' };
        }
        try {
            const token = localStorage.getItem('rupiksha_token');
            const res = await fetch(`${BACKEND_URL}/loan/simulate-status`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tracking_id: trackingId, status: status })
            });
            return await res.json();
        } catch (e) { return { success: false, message: 'Network error ' + e.message }; }
    },

    simulateLoanStatus: async function (trackingId, status) {
        return this.updateLoanStatus(trackingId, status);
    },

    registerLoanLead: async function (leadData) {
        if (useLocalOnly) {
            const data = this.getData();
            const trackingId = 'TRK_' + Math.floor(1000 + Math.random() * 9000);
            const newLead = {
                app_id: 'L' + Math.floor(100 + Math.random() * 900),
                name: leadData.name,
                phone: leadData.phone,
                tracking_id: trackingId,
                status: 'initiated',
                loan_type: leadData.loanType === 'PL' ? 'Personal Loan' : (leadData.loanType === 'GL' ? 'Gold Loan' : 'Loan Lead'),
                requested_amount: leadData.amount,
                dob: leadData.dob,
                pincode: leadData.pincode,
                pan: leadData.pan,
                income: leadData.income,
                employment_type: leadData.employment_type,
                updated_at: new Date().toISOString()
            };
            data.loans.push(newLead);
            this.saveData(data);
            return {
                success: true,
                message: "Loan lead registered successfully.",
                tracking_id: trackingId,
                redirectionUrl: "/loan-simulation",
                is_demo: true,
                phone: leadData.phone,
                name: leadData.name,
                amount: leadData.amount
            };
        }
        try {
            const res = await fetch(`${BACKEND_URL}/loan/register-lead`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(leadData)
            });
            return await res.json();
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    checkLoanStatus: async function (phone) {
        if (useLocalOnly) {
            const data = this.getData();
            const loan = data.loans.find(l => l.phone === phone);
            if (loan) {
                return {
                    success: true,
                    name: loan.name,
                    phone: loan.phone,
                    status: (loan.status || 'unknown').toUpperCase(),
                    reference_id: loan.tracking_id,
                    offer_amount: loan.offer_amount,
                    lender_name: loan.lender_name,
                    interest_rate: loan.interest_rate || '10.5%',
                    updated_at_date: new Date(loan.updated_at).toLocaleDateString(),
                    updated_at_time: new Date(loan.updated_at).toLocaleTimeString()
                };
            }
            return { success: false, message: "Application not found locally" };
        }
        try {
            const res = await fetch(`${BACKEND_URL}/loan/check-status?phone=${phone}`);
            return await res.json();
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    getLoanStats: async function () {
        if (useLocalOnly) {
            const data = this.getData();
            const loans = data.loans || [];
            return {
                success: true,
                total: loans.length,
                approved: loans.filter(l => l.status === 'approved').length,
                pending: loans.filter(l => l.status === 'initiated' || l.status === 'pending').length,
                rejected: loans.filter(l => l.status === 'rejected').length
            };
        }
        try {
            const res = await fetch(`${BACKEND_URL}/loan/stats`);
            return await res.json();
        } catch (e) {
            return { success: false };
        }
    },

    simulateLoanWebhook: async function (trackingId, status) {
        if (useLocalOnly) {
            return this.updateLoanStatus(trackingId, status);
        }
        try {
            const res = await fetch(`${BACKEND_URL}/loan/simulate-webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tracking_id: trackingId, status: status })
            });
            return await res.json();
        } catch (e) {
            return { success: false };
        }
    },



    restoreUser: async function (username) {
        if (useLocalOnly) return { success: true };
        try {
            const res = await fetch(`${BACKEND_URL}/restore-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            return await res.json();
        } catch (e) { return { success: false }; }
    },

    resendCredentials: async function (user) {
        if (useLocalOnly) return { success: true, message: "Credentials rest successfully." };
        try {
            const res = await fetch(`${BACKEND_URL}/send-credentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: user.email,
                    name: user.name,
                    login_id: user.username || user.mobile,
                    password: user.password,
                    pin: user.pin || '1122', 
                    added_by: 'Administrator',
                    portal_type: user.role
                })
            });
            return await res.json();
        } catch (e) { return { success: false }; }
    },

    getData: function () {
        const d = localStorage.getItem('rupiksha_data');
        let data = d ? JSON.parse(d) : null;

        if (!data) {
            // Initial mock data if none exists
            data = {
                users: [
                   { id: 1, name: 'System Admin', username: 'admin', mobile: '8920150242', role: 'ADMIN', status: 'Approved', balance: '125000', email: 'admin@rupiksha.in', password: 'Admin@123' },
                   { id: 2, name: 'Distributor Primary', username: '8210350444', mobile: '8210350444', role: 'DISTRIBUTOR', status: 'Approved', balance: '75000', email: 'distributor@rupiksha.in', password: 'Dist@123', partyCode: 'DIST001' },
                   { id: 3, name: 'Super Distributor', username: 'sdistributor', mobile: '8877665544', role: 'SUPER_DISTRIBUTOR', status: 'Approved', balance: '100000', email: 'sdist@example.com', password: 'pass', partyCode: 'SDIST001' }
                ],
                loans: [],
                transactions: [],
                news: "Welcome to Rupiksha Digital Banking Portal!",
                chartTitle: "Weekly Volume Activity",
                chartData: [
                    { name: 'Mon', value: 400 }, { name: 'Tue', value: 300 },
                    { name: 'Wed', value: 600 }, { name: 'Thu', value: 800 },
                    { name: 'Fri', value: 500 }, { name: 'Sat', value: 900 },
                    { name: 'Sun', value: 700 }
                ],
                quickActions: [
                    { title: "Wallet Topup", subTitle: "Add funds to wallet", icon: "Wallet" },
                    { title: "Manage Store", subTitle: "Edit store profile", icon: "Building2" }
                ],
                stats: {
                    todayActive: "12",
                    weeklyActive: "45",
                    monthlyActive: "189",
                    debitSale: "₹ 1,24,500",
                    labels: {
                        today: { title: "TODAY ACTIVE" },
                        weekly: { title: "WEEKLY ACTIVE" },
                        monthly: { title: "MONTHLY ACTIVE" },
                        debit: { title: "TOTAL DEBIT" }
                    }
                },
                wallet: { balance: "1,24,500.00", retailerName: "Super Distributor" },
                promotions: {
                    banners: [
                        { id: 1, image: mainLogo, title: "Modern Banking Suite", subtitle: "Secure | Fast | Reliable" },
                        { id: 2, image: mainLogo, title: "Financial Inclusion", subtitle: "Digital India | Last Mile Reach" }
                    ]
                },
                services: [
                    {
                        category: 'Banking & Finance',
                        items: [
                            { label: 'AEPS Withdrawal', icon: 'zap', active: true },
                            { label: 'Money Transfer', icon: 'send', active: true }
                        ]
                    }
                ]
            };
            this.saveData(data); // Force save initial
        } else if (!data.users.find(u => u.username === '8210350444')) {
            // Proactively add the new distributor if it's missing from existing mock store
            data.users.push({ id: 2, name: 'Distributor Primary', username: '8210350444', mobile: '8210350444', role: 'DISTRIBUTOR', status: 'Approved', balance: '75000', email: 'distributor@rupiksha.in', password: 'Dist@123', partyCode: 'DIST001' });
            this.saveData(data);
        }

        // Ensure sub-properties exist to prevent crashes
        if (!data.stats) data.stats = { todayActive: "0", weeklyActive: "0", monthlyActive: "0", debitSale: "₹ 0", labels: { today: { title: "TODAY ACTIVE" }, weekly: { title: "WEEKLY ACTIVE" }, monthly: { title: "MONTHLY ACTIVE" }, debit: { title: "TOTAL DEBIT" } } };
        if (!data.users) data.users = [];
        if (!data.loans) data.loans = [];
        if (!data.wallet) data.wallet = { balance: "0.00", retailerName: "Retailer" };

        const user = localStorage.getItem('rupiksha_user');
        if (user) data.currentUser = JSON.parse(user);
        return data;
    },

    saveData: function (data) {
        if (data && data.currentUser) {
            localStorage.setItem('rupiksha_user', JSON.stringify(data.currentUser));
        }
        localStorage.setItem('rupiksha_data', JSON.stringify(data));
        window.dispatchEvent(new Event('dataUpdated'));
    },

    getUserByUsername: function (username) {
        const data = this.getData();
        return data.users.find(u => u.username === username || u.mobile === username);
    },

    getPendingApprovalsByRole: async function (role) {
        const normalizedRole = normalizeRoleForBackend(role);
        try {
            const res = await authFetch(`${BACKEND_URL}/admin/approvals`);
            if (!res.ok) return { success: false, users: [], message: `Approvals fetch failed (${res.status})` };
            const payload = await safeJson(res, []);
            const list = Array.isArray(payload) ? payload : (payload.users || payload.data || []);

            // Normalize the raw User entities so downstream admin UI can use the
            // flat shape it expects (role, state, address, etc.) — the backend
            // entity uses stateName / addressLine1 / roles[{name}] which the admin
            // panel doesn't understand natively.
            const normalized = list.map((u) => {
                const rolesArr = (u.roles || []).map((r) => {
                    const name = typeof r === 'string' ? r : (r?.name || '');
                    return String(name || '').toUpperCase();
                }).filter(Boolean);
                const primary = rolesArr[0] || 'RETAILER';
                return {
                    ...u,
                    _id: u.id,
                    role: primary,
                    roles: rolesArr,
                    state: u.stateName || u.state || '',
                    stateName: u.stateName || u.state || '',
                    address: u.address || u.addressLine1 || '',
                    addressLine1: u.addressLine1 || u.address || '',
                    businessName: u.businessName || '',
                    name: u.fullName || u.name || u.username,
                    fullName: u.fullName || u.name || u.username,
                    status: typeof u.status === 'string' ? u.status : (u.status?.name?.() || '')
                };
            });

            const users = normalized.filter((u) => {
                const rolesArr = (u.roles || []).map((r) => normalizeRoleForBackend(r));
                return rolesArr.includes(normalizedRole);
            });
            return { success: true, users };
        } catch (e) {
            return { success: false, users: [], message: e.message };
        }
    },

    approveUser: async function (identifier, _password, partyCode, _parentId, _pin, _state, _role, ownerMeta = {}) {
        try {
            const body = {
                action: 'approve',
                ...(partyCode ? { partyCode: String(partyCode).toUpperCase() } : {}),
                ...(ownerMeta.addedByName ? { addedByName: ownerMeta.addedByName } : {}),
                ...(ownerMeta.addedByRole ? { addedByRole: ownerMeta.addedByRole } : {}),
                ...(ownerMeta.addedByPartyCode ? { addedByPartyCode: ownerMeta.addedByPartyCode } : {}),
                ...(ownerMeta.addedByUserRef ? { addedByUserRef: ownerMeta.addedByUserRef } : {}),
            };
            const res = await authFetch(`${BACKEND_URL}/admin/approvals/${encodeURIComponent(identifier)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await safeJson(res, {});
            if (!res.ok) return { success: false, message: data?.message || data?.error || `Approve failed (${res.status})` };
            return { success: true, user: data };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    issueCredentialsForApproval: async function (identifier) {
        try {
            const token = localStorage.getItem('rupiksha_token');
            const res = await fetch(`${BACKEND_URL}/admin/approvals/${encodeURIComponent(identifier)}/issue-credentials`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await safeJson(res, {});
            if (!res.ok) return { success: false, message: data?.message || data?.error || `Issue credentials failed (${res.status})` };
            return { success: true, ...data };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    updateUserRole: async function (username, newRole) {
        if (useLocalOnly) {
           const data = this.getData();
           const idx = data.users.findIndex(u => u.username === username);
           if (idx !== -1) {
               data.users[idx].role = newRole;
               this.saveData(data);
           }
           return { success: true };
        }
        try {
            const res = await fetch(`${BACKEND_URL}/update-user-role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, newRole })
            });
            const resData = await res.json();
            if (resData.success) {
                const data = this.getData();
                const userIdx = data.users.findIndex(u => u.username === username);
                if (userIdx !== -1) {
                    data.users[userIdx].role = newRole;
                    this.saveData(data);
                }
                return { success: true };
            }
            return resData;
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    rejectUser: async function (identifier) {
        try {
            const token = localStorage.getItem('rupiksha_token');
            const res = await fetch(`${BACKEND_URL}/admin/approvals/${encodeURIComponent(identifier)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ action: 'reject' })
            });
            const data = await safeJson(res, {});
            if (!res.ok) return { success: false, message: data?.message || data?.error || `Reject failed (${res.status})` };
            return { success: true, user: data };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    resetData: function () {
        localStorage.removeItem('rupiksha_data');
        window.dispatchEvent(new Event('dataUpdated'));
    },

    updateUserCertificates: async function (userId, data) {
        try {
            const res = await fetch(`${BACKEND_URL}/admin/update-user-certificates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, ...data })
            });
            return await res.json();
        } catch (e) { return { success: false, message: e.message }; }
    },

    updateUserGeofencing: async function (userId, data) {
        try {
            const res = await fetch(`${BACKEND_URL}/admin/update-user-geofencing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, ...data })
            });
            return await res.json();
        } catch (e) { return { success: false, message: e.message }; }
    },

    verifyDocument: async function (username, docName, status) {
        try {
            const res = await fetch(`${BACKEND_URL}/admin/verify-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, docName, status })
            });
            return await res.json();
        } catch (e) { return { success: false, message: e.message }; }
    },

    deleteUser: async function (identifier) {
        try {
            const token = localStorage.getItem('rupiksha_token');
            const res = await fetch(`${BACKEND_URL}/admin/users/${encodeURIComponent(identifier)}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            return await safeJson(res, { success: false });
        } catch (e) {
            return { success: false, message: e.message };
        }
    }
};

export default dataService;

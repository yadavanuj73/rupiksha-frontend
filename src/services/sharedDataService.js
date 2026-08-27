import { BACKEND_URL } from './config';
import { generateUniquePartyCode } from '../database/partyCode';

// Environment-based toggle: Use real backend on localhost, localstorage in production
const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' || 
     window.location.hostname.startsWith('192.168.'));
const useLocalOnly = false; // Always use live API

export const sharedDataService = {

    // --- LEGACY STORAGE KEYS ---
    KEYS: {
        DISTRIBUTORS: 'rupiksha_distributors',
        SUPER_DISTRIBUTORS: 'rupiksha_super_distributors',
        ASSIGNMENTS: 'rupiksha_assignments'
    },

    // --- LIVE API METHODS ---
    getAuthHeader: () => {
        const isAdminTab = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
        const token = isAdminTab 
            ? (localStorage.getItem('rupiksha_admin_token') || localStorage.getItem('rupiksha_token'))
            : (localStorage.getItem('rupiksha_imp_token') || localStorage.getItem('rupiksha_token'));
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    getRetailersForDistributor: async (parentId) => {
        if (useLocalOnly) return [];
        try {
            const res = await fetch(`${BACKEND_URL}/my-retailers?parentId=${parentId}`, {
                headers: { ...sharedDataService.getAuthHeader() }
            });
            const data = await res.json();
            return data.success ? data.retailers : [];
        } catch (e) { return []; }
    },

    // --- LEGACY / LOCAL METHODS (REQUIRED BY ADMIN PANEL) ---
    getAllDistributors: function () {
        const d = localStorage.getItem(this.KEYS.DISTRIBUTORS);
        let dists = d ? JSON.parse(d) : [];
        if (useLocalOnly && dists.length === 0) {
            dists = [
                { id: 'DT-3921', name: 'Alok Distributor', mobile: '9922881122', email: 'alok@rupiksha.in', businessName: 'Alok Fintech', city: 'Delhi', state: 'Delhi', status: 'Approved', balance: '25000', createdAt: new Date().toISOString() }
            ];
            this.saveDistributors(dists, true);
        }
        return dists;
    },

    getAllSuperDistributors: function () {
        const s = localStorage.getItem(this.KEYS.SUPER_DISTRIBUTORS);
        let sas = s ? JSON.parse(s) : [];
        if (useLocalOnly && sas.length === 0) {
            sas = [
                { id: 'SD-1192', name: 'Master SUPER_DISTRIBUTOR', mobile: '8811002233', email: 'master@rupiksha.in', businessName: 'Rupiksha Prime', city: 'Mumbai', state: 'Maharashtra', status: 'Approved', balance: '500000', createdAt: new Date().toISOString() }
            ];
            this.saveSuperDistributors(sas, true);
        }
        return sas;
    },

    saveDistributors: function (dists, silent = false) {
        localStorage.setItem(this.KEYS.DISTRIBUTORS, JSON.stringify(dists));
        if (!silent) window.dispatchEvent(new Event('distributorDataUpdated'));
    },

    saveSuperDistributors: function (sas, silent = false) {
        localStorage.setItem(this.KEYS.SUPER_DISTRIBUTORS, JSON.stringify(sas));
        if (!silent) window.dispatchEvent(new Event('SuperDistributorDataUpdated'));
    },

    getDistributorById: function (id) {
        return this.getAllDistributors().find(d => d.id === id);
    },

    getSuperDistributorById: function (id) {
        return this.getAllSuperDistributors().find(s => s.id === id);
    },

    registerSuperDistributor: async function (data) {
        const password = data.password || '123456';
        const username = data.mobile || data.email;

        if (useLocalOnly) {
            const sas = this.getAllSuperDistributors();
            const newSA = {
                ...data,
                id: 'SD-' + Math.floor(1000 + Math.random() * 9000),
                username: username,
                role: 'SUPER_DISTRIBUTOR',
                balance: '0.00',
                wallet: { balance: '0.00' },
                assignedDistributors: [],
                status: 'Pending',
                createdAt: new Date().toISOString()
            };
            sas.push(newSA);
            this.saveSuperDistributors(sas);
            return { success: true, message: "SUPER_DISTRIBUTOR registration successful." };
        }

        try {
            const res = await fetch(`${BACKEND_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeader()
                },
                body: JSON.stringify({
                    ...data,
                    username: username,
                    password: password,
                    role: 'SUPER_DISTRIBUTOR',
                    status: 'Pending',
                    latitude: data.latitude || null,
                    longitude: data.longitude || null
                })
            });
            const resData = await res.json();
            if (!resData.success) throw new Error(resData.message);

            const sas = this.getAllSuperDistributors();
            const newSA = {
                ...data,
                id: 'SD-' + Math.floor(1000 + Math.random() * 9000),
                role: 'SUPER_DISTRIBUTOR',
                balance: '0.00',
                wallet: { balance: '0.00' },
                assignedDistributors: [],
                status: 'Pending'
            };
            sas.push(newSA);
            this.saveSuperDistributors(sas);
            return resData;
        } catch (e) {
            console.error("DB Register Error:", e);
            throw e;
        }
    },

    registerDistributor: async function (data, ownerId = null) {
        const password = data.password || '123456';
        const username = data.mobile || data.email;

        if (useLocalOnly) {
            const dists = this.getAllDistributors();
            const newDist = {
                ...data,
                id: 'DT-' + Math.floor(1000 + Math.random() * 9000),
                username: username,
                role: 'DISTRIBUTOR',
                balance: '0.00',
                wallet: { balance: '0.00' },
                assignedRetailers: [],
                ownerId: ownerId,
                status: 'Pending',
                createdAt: new Date().toISOString()
            };
            dists.push(newDist);
            this.saveDistributors(dists);
            return { success: true, message: "Distributor registration successful." };
        }

        try {
            const res = await fetch(`${BACKEND_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeader()
                },
                body: JSON.stringify({
                    ...data,
                    username: username,
                    password: password,
                    role: 'DISTRIBUTOR',
                    parent_id: ownerId,
                    status: 'Pending',
                    latitude: data.latitude || null,
                    longitude: data.longitude || null
                })
            });
            const resData = await res.json();
            if (!resData.success) throw new Error(resData.message);

            const dists = this.getAllDistributors();
            const newDist = {
                ...data,
                id: 'DT-' + Math.floor(1000 + Math.random() * 9000),
                role: 'DISTRIBUTOR',
                balance: '0.00',
                wallet: { balance: '0.00' },
                assignedRetailers: [],
                ownerId: ownerId,
                status: 'Pending'
            };
            dists.push(newDist);
            this.saveDistributors(dists);
            return resData;
        } catch (e) {
            console.error("DB Register Error:", e);
            throw e;
        }
    },

    approveDistributor: async function (id, password, distribId) {
        const dists = this.getAllDistributors();
        const idx = dists.findIndex(d => d.id === id || d._id === id || d.username === id || d.mobile === id);
        if (idx !== -1) {
            const dist = dists[idx];
            if (!useLocalOnly) {
                try {
                    const existingCodes = [...dists.map(d => d.partyCode), ...this.getAllSuperDistributors().map(s => s.partyCode)];
                    const payload = {
                        id: dist._id || dist.id,
                        username: dist.username || dist.mobile,
                        password: password,
                        pin: dist.pin || '1122',
                        partyCode: (distribId || generateUniquePartyCode(dist.state, dist.role || 'DISTRIBUTOR', existingCodes)).toUpperCase(),
                        status: 'Approved'
                    };
                    let res = await fetch(`${BACKEND_URL}/approve-user`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...this.getAuthHeader()
                        },
                        body: JSON.stringify(payload)
                    });
                    if (!res.ok) {
                        await fetch(`${BACKEND_URL}/admin/approve-user`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...this.getAuthHeader()
                            },
                            body: JSON.stringify(payload)
                        });
                    }
                } catch (e) { 
                    console.error("Distributor approval failed", e);
                }
            }

            dists[idx].status = 'Approved';
            dists[idx].password = password;
            if (distribId) dists[idx].id = distribId;
            this.saveDistributors(dists);
        }
    },

    rejectDistributor: async function (id) {
        const dists = this.getAllDistributors();
        const dist = dists.find(d => d.id === id);
        if (dist && !useLocalOnly) {
            try {
                await fetch(`${BACKEND_URL}/admin/approve-user`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...this.getAuthHeader()
                    },
                    body: JSON.stringify({ username: dist.username || dist.mobile, status: 'Rejected' })
                });
            } catch (e) { }
        }
        this.saveDistributors(this.getAllDistributors().filter(d => d.id !== id));
    },

    approveSuperDistributor: async function (id, password) {
        const sas = this.getAllSuperDistributors();
        const idx = sas.findIndex(s => s.id === id || s._id === id || s.username === id || s.mobile === id);
        if (idx !== -1) {
            const sa = sas[idx];
            if (!useLocalOnly) {
                try {
                    const existingCodes = [...sas.map(s => s.partyCode), ...this.getAllDistributors().map(d => d.partyCode)];
                    const payload = {
                        id: sa._id || sa.id,
                        username: sa.username || sa.mobile,
                        password: password,
                        pin: sa.pin || '1122',
                        partyCode: generateUniquePartyCode(sa.state, 'SUPER_DISTRIBUTOR', existingCodes).toUpperCase(),
                        status: 'Approved'
                    };
                    let res = await fetch(`${BACKEND_URL}/approve-user`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...this.getAuthHeader()
                        },
                        body: JSON.stringify(payload)
                    });
                    if (!res.ok) {
                        await fetch(`${BACKEND_URL}/admin/approve-user`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...this.getAuthHeader()
                            },
                            body: JSON.stringify(payload)
                        });
                    }
                } catch (e) { }
            }

            sas[idx].status = 'Approved';
            sas[idx].password = password;
            this.saveSuperDistributors(sas);
        }
    },

    rejectSuperDistributor: async function (id) {
        const sas = this.getAllSuperDistributors();
        const sa = sas.find(s => s.id === id);
        if (sa && !useLocalOnly) {
            try {
                await fetch(`${BACKEND_URL}/admin/approve-user`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...this.getAuthHeader()
                    },
                    body: JSON.stringify({ username: sa.username || sa.mobile, status: 'Rejected' })
                });
            } catch (e) { }
        }
        this.saveSuperDistributors(this.getAllSuperDistributors().filter(s => s.id !== id));
    },

    assignRetailerToDistributor: function (distId, retailerUsername) {
        const dists = this.getAllDistributors();
        const idx = dists.findIndex(d => d.id === distId);
        if (idx !== -1) {
            if (!dists[idx].assignedRetailers) dists[idx].assignedRetailers = [];
            if (!dists[idx].assignedRetailers.includes(retailerUsername)) {
                dists[idx].assignedRetailers.push(retailerUsername);
                this.saveDistributors(dists);
            }
        }
    },

    unassignRetailerFromDistributor: function (distId, retailerUsername) {
        const dists = this.getAllDistributors();
        const idx = dists.findIndex(d => d.id === distId);
        if (idx !== -1 && dists[idx].assignedRetailers) {
            dists[idx].assignedRetailers = dists[idx].assignedRetailers.filter(u => u !== retailerUsername);
            this.saveDistributors(dists);
        }
    },

    getDistributorForRetailer: function (retailerUsername) {
        const dists = this.getAllDistributors();
        return dists.find(d => d.assignedRetailers && d.assignedRetailers.includes(retailerUsername));
    },

    resetToDefaults: function () {
        localStorage.removeItem(this.KEYS.DISTRIBUTORS);
        localStorage.removeItem(this.KEYS.SUPER_DISTRIBUTORS);
        window.dispatchEvent(new Event('distributorDataUpdated'));
        window.dispatchEvent(new Event('SuperDistributorDataUpdated'));
        return [];
    },

    // --- SESSION HELPERS ---
    getCurrentDistributor: () => {
        const saved = localStorage.getItem('rupiksha_user');
        if (!saved) return null;
        const user = JSON.parse(saved);
        const allowed = ['DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'ADMIN', 'SUPER_DISTRIBUTOR', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'];
        return allowed.includes(user.role) ? user : null;
    },

    setCurrentDistributor: (dist) => {
        localStorage.setItem('rupiksha_user', JSON.stringify(dist));
    },

    getCurrentSuperDistributor: () => {
        const saved = localStorage.getItem('rupiksha_user');
        if (!saved) return null;
        const user = JSON.parse(saved);
        const allowed = ['SUPER_DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'ADMIN', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'];
        return allowed.includes(user.role) ? user : null;
    },

    setCurrentSuperDistributor: (sa) => {
        localStorage.setItem('rupiksha_user', JSON.stringify(sa));
    },

    logout: () => {
        localStorage.removeItem('rupiksha_user');
        localStorage.removeItem('rupiksha_token');
        window.location.href = '/';
    }
};

export default sharedDataService;

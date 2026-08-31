import { apiFetch } from './apiService';

export const commissionService = {
    // ─── ADMIN METHODS ────────────────────────────────────────────────────────
    /**
     * Get all plans for a service (e.g. AEPS_1) with slabs
     */
    async getPlans(serviceType = 'AEPS_1') {
        return apiFetch(`/admin/commissions/plans?serviceType=${encodeURIComponent(serviceType)}`);
    },

    /**
     * Get single plan by ID
     */
    async getPlanById(planId) {
        return apiFetch(`/admin/commissions/plans/${planId}`);
    },

    /**
     * Update slabs for a plan
     */
    async updatePlanSlabs(planId, slabs) {
        return apiFetch(`/admin/commissions/plans/${planId}/slabs`, {
            method: 'PUT',
            body: JSON.stringify({ slabs }),
        });
    },

    /**
     * Create new commission plan
     */
    async createPlan(planData) {
        return apiFetch('/admin/commissions/plans', {
            method: 'POST',
            body: JSON.stringify(planData),
        });
    },

    /**
     * Get paginated commission audit transactions for admin
     */
    async getAdminTransactions(params = {}) {
        const query = new URLSearchParams();
        if (params.serviceType && params.serviceType !== 'ALL') query.append('serviceType', params.serviceType);
        if (params.status && params.status !== 'ALL') query.append('status', params.status);
        if (params.planCode && params.planCode !== 'ALL') query.append('planCode', params.planCode);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.search) query.append('search', params.search);
        query.append('page', params.page ?? 0);
        query.append('size', params.size ?? 15);
        query.append('sortBy', params.sortBy || 'createdAt');
        query.append('sortDir', params.sortDir || 'desc');

        return apiFetch(`/admin/commissions/transactions?${query.toString()}`);
    },

    /**
     * Assign a plan to a user
     */
    async assignPlan(userId, planId) {
        return apiFetch('/admin/commissions/assign-plan', {
            method: 'POST',
            body: JSON.stringify({ userId, planId }),
        });
    },

    // ─── RETAILER METHODS ─────────────────────────────────────────────────────
    /**
     * Get retailer's own commission summary
     */
    async getRetailerSummary() {
        return apiFetch('/retailer/commissions/summary');
    },

    /**
     * Get retailer's own assigned plan details
     */
    async getRetailerPlan() {
        return apiFetch('/retailer/commissions/my-plan');
    },

    /**
     * Get all available commission plans with slabs for retailer
     */
    async getRetailerAvailablePlans(serviceType = 'AEPS_1') {
        return apiFetch(`/retailer/commissions/plans?serviceType=${encodeURIComponent(serviceType)}`);
    },

    /**
     * Upgrade/purchase a commission plan using wallet balance
     */
    async upgradeRetailerPlan(planId) {
        return apiFetch('/retailer/commissions/upgrade', {
            method: 'POST',
            body: JSON.stringify({ planId }),
        });
    },

    /**
     * Get retailer's own earned commission history
     */
    async getRetailerHistory(params = {}) {
        const query = new URLSearchParams();
        if (params.serviceType && params.serviceType !== 'ALL') query.append('serviceType', params.serviceType);
        if (params.status && params.status !== 'ALL') query.append('status', params.status);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.search) query.append('search', params.search);
        query.append('page', params.page ?? 0);
        query.append('size', params.size ?? 15);
        query.append('sortBy', params.sortBy || 'createdAt');
        query.append('sortDir', params.sortDir || 'desc');

        return apiFetch(`/retailer/commissions/history?${query.toString()}`);
    },
};

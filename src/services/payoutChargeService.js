import { apiFetch } from './apiService';

const DEFAULT_SLABS = [
    {
        id: 1,
        minAmount: 500,
        maxAmount: 24999,
        baseCharge: 5.50,
        gstRate: 18.00,
        gstAmount: 0.99,
        totalCharge: 6.49,
        isActive: true,
    },
    {
        id: 2,
        minAmount: 25000,
        maxAmount: 100000,
        baseCharge: 10.50,
        gstRate: 18.00,
        gstAmount: 1.89,
        totalCharge: 12.39,
        isActive: true,
    },
];

export const payoutChargeService = {
    async getCharges() {
        try {
            const res = await apiFetch('/payout/charges');
            if (res && Array.isArray(res) && res.length > 0) {
                return res;
            }
        } catch (err) {
            console.warn('Failed to load payout charges from API, using fallback:', err);
        }
        return DEFAULT_SLABS;
    },

    async updateCharges(slabs) {
        return apiFetch('/payout/admin/charges', {
            method: 'PUT',
            body: JSON.stringify(slabs),
        });
    },

    calculateChargeForAmount(amount, slabs = DEFAULT_SLABS) {
        const numAmt = parseFloat(amount) || 0;
        const slabList = Array.isArray(slabs) && slabs.length > 0 ? slabs : DEFAULT_SLABS;
        const matchingSlab = slabList.find(s => numAmt >= Number(s.minAmount) && numAmt <= Number(s.maxAmount));
        if (matchingSlab) {
            const base = parseFloat(matchingSlab.baseCharge) || 0;
            const gstRate = parseFloat(matchingSlab.gstRate) || 18;
            const gst = parseFloat(matchingSlab.gstAmount) || parseFloat((base * (gstRate / 100)).toFixed(2));
            const total = parseFloat(matchingSlab.totalCharge) || parseFloat((base + gst).toFixed(2));
            return {
                baseCharge: base,
                gstRate,
                gstAmount: gst,
                totalCharge: total,
                totalDeduction: parseFloat((numAmt + total).toFixed(2))
            };
        }

        // Fallback calculation
        const isHigh = numAmt >= 25000;
        const base = isHigh ? 10.50 : 5.50;
        const gst = parseFloat((base * 0.18).toFixed(2));
        const total = parseFloat((base + gst).toFixed(2));
        return {
            baseCharge: base,
            gstRate: 18,
            gstAmount: gst,
            totalCharge: total,
            totalDeduction: parseFloat((numAmt + total).toFixed(2))
        };
    }
};

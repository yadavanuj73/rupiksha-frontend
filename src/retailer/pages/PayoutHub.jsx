import React, { useMemo, useState } from 'react';
import { providerTxnService } from '../../services/apiService';
import { dataService } from '../../services/dataService';

const PayoutHub = () => {
    const user = useMemo(() => dataService.getCurrentUser(), []);
    const [form, setForm] = useState({ beneficiaryName: '', accountNumber: '', ifsc: '', amount: '' });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const canSubmit = form.beneficiaryName.trim() && /^\d{9,18}$/.test(form.accountNumber) && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.toUpperCase()) && Number(form.amount) > 0;

    const onSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setResult(null);
        if (!user?.id) {
            setError('User session missing. Please login again.');
            return;
        }
        if (!canSubmit) {
            setError('Please enter valid beneficiary details.');
            return;
        }
        try {
            setLoading(true);
            const res = await providerTxnService.transfer({
                userId: user.id,
                beneficiaryName: form.beneficiaryName.trim(),
                accountNumber: form.accountNumber.trim(),
                ifsc: form.ifsc.trim().toUpperCase(),
                amount: Number(form.amount)
            });
            setResult(res);
        } catch (err) {
            setError(err?.message || 'Payout request failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto bg-slate-50 p-6">
            <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-lg font-black text-slate-900">Payout Hub</h1>
                <p className="mt-1 text-xs font-semibold text-slate-500">Transfer funds securely to beneficiary bank account.</p>
                <form className="mt-5 space-y-3" onSubmit={onSubmit}>
                    <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-500" placeholder="Beneficiary Name" value={form.beneficiaryName} onChange={(e) => setForm((p) => ({ ...p, beneficiaryName: e.target.value }))} />
                    <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-500" placeholder="Account Number" value={form.accountNumber} onChange={(e) => setForm((p) => ({ ...p, accountNumber: e.target.value.replace(/\D/g, '') }))} />
                    <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold uppercase outline-none focus:border-blue-500" placeholder="IFSC Code" value={form.ifsc} onChange={(e) => setForm((p) => ({ ...p, ifsc: e.target.value.toUpperCase() }))} />
                    <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-500" placeholder="Amount" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value.replace(/[^\d.]/g, '') }))} />
                    {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
                    {result ? <p className={`text-sm font-semibold ${result.success ? 'text-emerald-600' : 'text-rose-600'}`}>{result.message || 'Request processed'} {result.txnId ? `(Txn: ${result.txnId})` : ''}</p> : null}
                    <button type="submit" disabled={loading || !canSubmit} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-white disabled:opacity-60">
                        {loading ? 'Processing...' : 'Submit Payout'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PayoutHub;

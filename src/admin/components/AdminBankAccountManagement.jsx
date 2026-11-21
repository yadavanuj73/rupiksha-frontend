import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2, Landmark, Plus, Edit2, CheckCircle2, XCircle,
    Copy, Check, ShieldCheck, RefreshCw, AlertCircle, Save, X,
    Lock, Calendar, FileText, Loader2, Power
} from 'lucide-react';
import { bankAccountService } from '../../services/apiService';

const fmtDateTime = (iso) => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
};

const AdminBankAccountManagement = () => {
    // List state
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [copiedId, setCopiedId] = useState(null);

    // Form state for creating new account (Area A)
    const [formData, setFormData] = useState({
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
        branch: '',
    });
    const [formErrors, setFormErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);

    // Edit Modal state
    const [editItem, setEditItem] = useState(null);
    const [editForm, setEditForm] = useState({
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
        branch: '',
    });
    const [editErrors, setEditErrors] = useState({});
    const [updating, setUpdating] = useState(false);

    // Load accounts
    const loadAccounts = useCallback(async () => {
        setRefreshing(true);
        try {
            const res = await bankAccountService.getAllAccounts();
            if (res && res.success && Array.isArray(res.accounts)) {
                setAccounts(res.accounts);
            } else {
                setAccounts([]);
            }
        } catch (err) {
            console.error('Failed to load bank accounts:', err);
            setAccounts([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    const copyText = (text, key) => {
        if (!text) return;
        navigator.clipboard?.writeText(text);
        setCopiedId(key);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Validation
    const validateFormFields = (data, isEdit = false) => {
        const errors = {};
        if (!data.accountHolderName || data.accountHolderName.trim().length < 2) {
            errors.accountHolderName = 'Account holder name is required (min 2 characters)';
        }
        if (!isEdit || (data.accountNumber && data.accountNumber.trim())) {
            const cleanAcc = (data.accountNumber || '').trim();
            if (!/^[0-9]{8,24}$/.test(cleanAcc)) {
                errors.accountNumber = 'Account number must be 8-24 digits';
            }
        }
        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        if (!data.ifscCode || !ifscRegex.test(data.ifscCode.trim().toUpperCase())) {
            errors.ifscCode = 'Valid 11-character IFSC code is required (e.g. HDFC0001234)';
        }
        if (!data.bankName || data.bankName.trim().length < 2) {
            errors.bankName = 'Bank name is required';
        }
        if (!data.branch || data.branch.trim().length < 2) {
            errors.branch = 'Branch location is required';
        }
        return errors;
    };

    // Create New Bank Account
    const handleSaveNewAccount = async (e) => {
        e.preventDefault();
        const errs = validateFormFields(formData, false);
        if (Object.keys(errs).length > 0) {
            setFormErrors(errs);
            return;
        }

        setSaving(true);
        setFormErrors({});
        setFeedback(null);

        try {
            const res = await bankAccountService.createAccount({
                accountHolderName: formData.accountHolderName.trim(),
                accountNumber: formData.accountNumber.trim(),
                ifscCode: formData.ifscCode.trim().toUpperCase(),
                bankName: formData.bankName.trim(),
                branch: formData.branch.trim(),
            });

            if (res && res.success) {
                setFeedback({ type: 'success', message: 'Bank account added successfully and encrypted at rest.' });
                setFormData({
                    accountHolderName: '',
                    accountNumber: '',
                    ifscCode: '',
                    bankName: '',
                    branch: '',
                });
                loadAccounts();
            } else {
                setFeedback({ type: 'error', message: res?.message || 'Failed to save bank account' });
            }
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Error saving bank account' });
        } finally {
            setSaving(false);
        }
    };

    // Open Edit Modal
    const handleOpenEdit = (acc) => {
        setEditItem(acc);
        setEditForm({
            accountHolderName: acc.accountHolderName || '',
            accountNumber: '', // Left blank unless admin wishes to replace it
            ifscCode: acc.ifscCode || '',
            bankName: acc.bankName || '',
            branch: acc.branch || '',
        });
        setEditErrors({});
    };

    // Update Account
    const handleUpdateAccount = async (e) => {
        e.preventDefault();
        const errs = validateFormFields(editForm, true);
        if (Object.keys(errs).length > 0) {
            setEditErrors(errs);
            return;
        }

        setUpdating(true);
        setEditErrors({});

        try {
            const payload = {
                accountHolderName: editForm.accountHolderName.trim(),
                ifscCode: editForm.ifscCode.trim().toUpperCase(),
                bankName: editForm.bankName.trim(),
                branch: editForm.branch.trim(),
            };
            if (editForm.accountNumber && editForm.accountNumber.trim()) {
                payload.accountNumber = editForm.accountNumber.trim();
            }

            const res = await bankAccountService.updateAccount(editItem.id, payload);

            if (res && res.success) {
                setEditItem(null);
                setFeedback({ type: 'success', message: 'Bank account updated successfully.' });
                loadAccounts();
            } else {
                setEditErrors({ general: res?.message || 'Failed to update account' });
            }
        } catch (err) {
            setEditErrors({ general: err.message || 'Error updating bank account' });
        } finally {
            setUpdating(false);
        }
    };

    // Toggle Status (Activate / Deactivate)
    const handleToggleStatus = async (acc) => {
        const nextStatus = !acc.isActive;
        const confirmMsg = nextStatus
            ? `Activate receiving account for ${acc.bankName}? It will immediately appear as an option for user fund requests.`
            : `Deactivate receiving account for ${acc.bankName}? It will immediately be hidden from user fund requests. Existing historical requests will remain preserved.`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await bankAccountService.toggleStatus(acc.id, nextStatus);
            if (res && res.success) {
                setFeedback({
                    type: 'success',
                    message: `Account status updated to ${nextStatus ? 'ACTIVE' : 'INACTIVE'}.`
                });
                loadAccounts();
            } else {
                alert(res?.message || 'Failed to update account status');
            }
        } catch (err) {
            alert(err.message || 'Error updating status');
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-8 pb-16">
            {/* Header Banner */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black shadow-inner">
                        <Landmark size={24} />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 inline-block mb-1">
                            Operations · Financial Administration
                        </span>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Add Bank Account</h1>
                        <p className="text-xs text-slate-500 font-medium">
                            Manage Rupiksha receiving bank accounts for manual wallet recharge requests across Retailer, Distributor, and Super Distributor panels.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-slate-700">
                        <Lock size={15} className="text-emerald-600" />
                        <span>AES-256 Protected at Rest</span>
                    </div>
                    <button
                        onClick={loadAccounts}
                        className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-all cursor-pointer"
                        title="Refresh Accounts"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Feedback alert */}
            {feedback && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold shadow-sm ${
                        feedback.type === 'success'
                            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                            : 'bg-rose-50 text-rose-900 border border-rose-200'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        {feedback.type === 'success' ? (
                            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                        ) : (
                            <AlertCircle size={18} className="text-rose-600 shrink-0" />
                        )}
                        <span>{feedback.message}</span>
                    </div>
                    <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
                        <X size={15} />
                    </button>
                </motion.div>
            )}

            {/* ── AREA A: ADD NEW BANK ACCOUNT FORM ── */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm shadow-blue-500/20">
                            A
                        </div>
                        <h2 className="text-sm font-black text-slate-900 tracking-wide uppercase">
                            Add New Bank Account
                        </h2>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">All fields mandatory</span>
                </div>

                <form onSubmit={handleSaveNewAccount} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Account Holder Name */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                Account Holder Name *
                            </label>
                            <input
                                type="text"
                                value={formData.accountHolderName}
                                onChange={e => setFormData(p => ({ ...p, accountHolderName: e.target.value }))}
                                placeholder="e.g. Rupiksha Services Private Limited"
                                className={`w-full px-4 py-3 bg-slate-50 border rounded-2xl text-xs font-bold text-slate-900 outline-none transition-all ${
                                    formErrors.accountHolderName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 focus:border-blue-600 focus:bg-white'
                                }`}
                            />
                            {formErrors.accountHolderName && (
                                <p className="text-[11px] font-bold text-rose-600">{formErrors.accountHolderName}</p>
                            )}
                        </div>

                        {/* Account Number */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
                                <span>Account Number *</span>
                                <span className="text-[10px] text-slate-400 font-medium">Numbers only</span>
                            </label>
                            <input
                                type="text"
                                value={formData.accountNumber}
                                onChange={e => setFormData(p => ({ ...p, accountNumber: e.target.value.replace(/[^0-9]/g, '') }))}
                                placeholder="e.g. 002105112233"
                                className={`w-full px-4 py-3 bg-slate-50 border rounded-2xl text-xs font-mono font-bold text-slate-900 outline-none transition-all ${
                                    formErrors.accountNumber ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 focus:border-blue-600 focus:bg-white'
                                }`}
                            />
                            {formErrors.accountNumber && (
                                <p className="text-[11px] font-bold text-rose-600">{formErrors.accountNumber}</p>
                            )}
                        </div>

                        {/* IFSC Code */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
                                <span>IFSC Code *</span>
                                <span className="text-[10px] text-slate-400 font-medium">11 Characters</span>
                            </label>
                            <input
                                type="text"
                                maxLength={11}
                                value={formData.ifscCode}
                                onChange={e => setFormData(p => ({ ...p, ifscCode: e.target.value.toUpperCase() }))}
                                placeholder="e.g. ICIC0000021"
                                className={`w-full px-4 py-3 bg-slate-50 border rounded-2xl text-xs font-mono font-bold text-slate-900 outline-none transition-all ${
                                    formErrors.ifscCode ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 focus:border-blue-600 focus:bg-white'
                                }`}
                            />
                            {formErrors.ifscCode && (
                                <p className="text-[11px] font-bold text-rose-600">{formErrors.ifscCode}</p>
                            )}
                        </div>

                        {/* Bank Name */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                Bank Name *
                            </label>
                            <input
                                type="text"
                                value={formData.bankName}
                                onChange={e => setFormData(p => ({ ...p, bankName: e.target.value }))}
                                placeholder="e.g. ICICI Bank, HDFC Bank, SBI"
                                className={`w-full px-4 py-3 bg-slate-50 border rounded-2xl text-xs font-bold text-slate-900 outline-none transition-all ${
                                    formErrors.bankName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 focus:border-blue-600 focus:bg-white'
                                }`}
                            />
                            {formErrors.bankName && (
                                <p className="text-[11px] font-bold text-rose-600">{formErrors.bankName}</p>
                            )}
                        </div>

                        {/* Branch */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                Branch Location *
                            </label>
                            <input
                                type="text"
                                value={formData.branch}
                                onChange={e => setFormData(p => ({ ...p, branch: e.target.value }))}
                                placeholder="e.g. Civil Lines, Lucknow"
                                className={`w-full px-4 py-3 bg-slate-50 border rounded-2xl text-xs font-bold text-slate-900 outline-none transition-all ${
                                    formErrors.branch ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 focus:border-blue-600 focus:bg-white'
                                }`}
                            />
                            {formErrors.branch && (
                                <p className="text-[11px] font-bold text-rose-600">{formErrors.branch}</p>
                            )}
                        </div>

                        {/* Submit Button Container */}
                        <div className="flex items-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Saving Account...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Save Bank Account
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* ── AREA B: SAVED BANK ACCOUNTS LIST ── */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden space-y-4 p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm shadow-blue-500/20">
                            B
                        </div>
                        <h2 className="text-sm font-black text-slate-900 tracking-wide uppercase">
                            Saved Bank Accounts
                        </h2>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">
                        Total {accounts.length} {accounts.length === 1 ? 'Record' : 'Records'}
                    </span>
                </div>

                <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-2xl border border-slate-100">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                <th className="px-5 py-4">Account Holder Name</th>
                                <th className="px-5 py-4">Masked Account Number</th>
                                <th className="px-5 py-4">Bank Name & Branch</th>
                                <th className="px-5 py-4">IFSC Code</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4">Created Date</th>
                                <th className="px-5 py-4 text-right">Available Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {accounts.map(acc => (
                                <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                                    {/* Account Holder */}
                                    <td className="px-5 py-4">
                                        <p className="font-black text-slate-900">{acc.accountHolderName}</p>
                                    </td>

                                    {/* Masked Account Number */}
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                {acc.accountNumberMasked}
                                            </span>
                                            <button
                                                onClick={() => copyText(acc.accountNumberMasked, acc.id)}
                                                className="p-1 hover:bg-slate-200/60 rounded text-slate-400 hover:text-slate-700 transition-colors"
                                                title="Copy Masked Account"
                                            >
                                                {copiedId === acc.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </td>

                                    {/* Bank & Branch */}
                                    <td className="px-5 py-4">
                                        <p className="font-bold text-slate-900">{acc.bankName}</p>
                                        <p className="text-[10px] text-slate-500 font-medium">{acc.branch}</p>
                                    </td>

                                    {/* IFSC */}
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                            {acc.ifscCode}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        {acc.isActive ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                <CheckCircle2 size={12} /> Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                                                <Power size={12} /> Inactive
                                            </span>
                                        )}
                                    </td>

                                    {/* Created Date */}
                                    <td className="px-5 py-4 whitespace-nowrap text-slate-500">
                                        {fmtDateTime(acc.createdAt)}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-5 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenEdit(acc)}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                            >
                                                <Edit2 size={13} /> Edit
                                            </button>
                                            <button
                                                onClick={() => handleToggleStatus(acc)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                                    acc.isActive
                                                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                                }`}
                                            >
                                                <Power size={13} />
                                                {acc.isActive ? 'Deactivate' : 'Activate'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {accounts.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-slate-400 font-medium">
                                        <div className="max-w-xs mx-auto space-y-2">
                                            <Landmark size={32} className="mx-auto text-slate-300" />
                                            <p className="text-sm font-bold text-slate-700">No bank accounts saved yet</p>
                                            <p className="text-xs text-slate-400">Add your first receiving company bank account using the form above.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── EDIT BANK ACCOUNT MODAL ── */}
            {editItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 w-full max-w-xl space-y-5"
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                    <Edit2 size={16} />
                                </div>
                                <h3 className="text-sm font-black text-slate-900 tracking-wide uppercase">
                                    Edit Bank Account Details
                                </h3>
                            </div>
                            <button
                                onClick={() => setEditItem(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {editErrors.general && (
                            <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs font-bold">
                                {editErrors.general}
                            </div>
                        )}

                        <form onSubmit={handleUpdateAccount} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                    Account Holder Name *
                                </label>
                                <input
                                    type="text"
                                    value={editForm.accountHolderName}
                                    onChange={e => setEditForm(p => ({ ...p, accountHolderName: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                                />
                                {editErrors.accountHolderName && <p className="text-[11px] font-bold text-rose-600">{editErrors.accountHolderName}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
                                    <span>New Account Number (Optional)</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Leave blank to retain current</span>
                                </label>
                                <input
                                    type="text"
                                    value={editForm.accountNumber}
                                    onChange={e => setEditForm(p => ({ ...p, accountNumber: e.target.value.replace(/[^0-9]/g, '') }))}
                                    placeholder="Enter only if updating account number"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:border-blue-600"
                                />
                                {editErrors.accountNumber && <p className="text-[11px] font-bold text-rose-600">{editErrors.accountNumber}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                        Bank Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.bankName}
                                        onChange={e => setEditForm(p => ({ ...p, bankName: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                                    />
                                    {editErrors.bankName && <p className="text-[11px] font-bold text-rose-600">{editErrors.bankName}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                        IFSC Code *
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={11}
                                        value={editForm.ifscCode}
                                        onChange={e => setEditForm(p => ({ ...p, ifscCode: e.target.value.toUpperCase() }))}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:border-blue-600"
                                    />
                                    {editErrors.ifscCode && <p className="text-[11px] font-bold text-rose-600">{editErrors.ifscCode}</p>}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                    Branch Location *
                                </label>
                                <input
                                    type="text"
                                    value={editForm.branch}
                                    onChange={e => setEditForm(p => ({ ...p, branch: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                                />
                                {editErrors.branch && <p className="text-[11px] font-bold text-rose-600">{editErrors.branch}</p>}
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditItem(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={updating}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    {updating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default AdminBankAccountManagement;

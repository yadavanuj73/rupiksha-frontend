import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    KeyRound, 
    ShieldCheck, 
    CheckCircle2, 
    AlertCircle, 
    X, 
    ArrowRight, 
    UserCheck, 
    Building2, 
    Smartphone, 
    CreditCard,
    RefreshCw,
    Wallet
} from 'lucide-react';

export default function CdoOtpModal({
    isOpen,
    onClose,
    formData,
    cdoData,
    cdoStep,
    setCdoStep,
    onValidateOtp,
    onTransact,
    loading,
    error,
    walletBalance
}) {
    const [otp, setOtp] = useState('');

    if (!isOpen) return null;

    const amountNum = parseFloat(formData.amount) || 0;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl w-full max-w-lg overflow-hidden text-black"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-5 text-white flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-black shadow-inner">
                                <KeyRound size={18} />
                            </div>
                            <div>
                                <h3 className="text-base font-black uppercase tracking-tight">
                                    Cash Deposit Verification (OTP)
                                </h3>
                                <p className="text-[11px] text-emerald-100 font-bold">
                                    Fingpay NPCI Beneficiary & Deposit Gateway
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="p-5 space-y-4">
                        {/* Transaction Summary Card */}
                        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3.5 space-y-2">
                            <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-200">
                                <span className="font-black text-slate-700">Bank & Account</span>
                                <span className="font-extrabold text-black flex items-center gap-1">
                                    <Building2 size={13} className="text-emerald-700" />
                                    {formData.bankName}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-200">
                                <span className="font-black text-slate-700">Account Number</span>
                                <span className="font-black text-black tracking-wider">
                                    {formData.accountNumber}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-200">
                                <span className="font-black text-slate-700">Customer Mobile</span>
                                <span className="font-black text-black">
                                    +91 {formData.mobile}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs pt-0.5">
                                <span className="font-black text-slate-700">Deposit Amount</span>
                                <span className="font-black text-base text-emerald-700">
                                    ₹{amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        {/* Retailer Wallet Balance Info */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 font-bold text-blue-900">
                                <Wallet size={14} className="text-blue-700" />
                                Retailer Wallet Balance:
                            </span>
                            <span className="font-black text-blue-950">
                                ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                        </div>

                        {/* Step 2: Enter OTP & Validate Beneficiary */}
                        {cdoStep === 2 && (
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-black text-black flex items-center justify-between">
                                        <span>Customer Mobile OTP</span>
                                        <span className="text-[10px] text-slate-600 font-bold">Sent to +91 {formData.mobile}</span>
                                    </label>
                                    <input
                                        type="text"
                                        maxLength="6"
                                        placeholder="Enter 4 or 6-digit OTP"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="w-full text-center tracking-[0.4em] py-3 text-xl font-black rounded-2xl border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-600 bg-slate-50 text-black"
                                        autoFocus
                                    />
                                </div>

                                {error && (
                                    <div className="bg-rose-100 border border-rose-300 text-rose-950 text-xs p-2.5 rounded-xl flex items-center gap-2 font-bold">
                                        <AlertCircle size={14} className="text-rose-700 shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => onValidateOtp(otp)}
                                    disabled={loading || otp.length < 4}
                                    className={`w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                                        !loading && otp.length >= 4
                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                    }`}
                                >
                                    {loading ? (
                                        <>
                                            <RefreshCw size={14} className="animate-spin" />
                                            <span>Verifying with Bank...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Validate OTP & Fetch Beneficiary</span>
                                            <ArrowRight size={14} />
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Step 3: Beneficiary Verified -> Final Execution */}
                        {cdoStep === 3 && (
                            <div className="space-y-3">
                                {/* Verified Beneficiary Card */}
                                <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 text-center space-y-1 animate-fadeIn">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-1">
                                        <UserCheck size={20} />
                                    </div>
                                    <p className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">
                                        Beneficiary Name Verified
                                    </p>
                                    <h4 className="text-base font-black text-black tracking-wide">
                                        {cdoData.beneficiaryName || 'Customer Account Holder'}
                                    </h4>
                                    <p className="text-[10px] text-slate-700 font-bold">
                                        A/C: {formData.accountNumber} ({formData.bankName})
                                    </p>
                                </div>

                                <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-[11px] font-bold text-amber-950 flex items-start gap-2">
                                    <AlertCircle size={14} className="text-amber-700 shrink-0 mt-0.5" />
                                    <span>
                                        ₹{amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })} will be debited from your retailer wallet and deposited directly into the customer's account.
                                    </span>
                                </div>

                                {error && (
                                    <div className="bg-rose-100 border border-rose-300 text-rose-950 text-xs p-2.5 rounded-xl flex items-center gap-2 font-bold">
                                        <AlertCircle size={14} className="text-rose-700 shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCdoStep(2)}
                                        disabled={loading}
                                        className="py-3 px-4 rounded-2xl border-2 border-slate-300 text-xs font-black text-black hover:bg-slate-100 transition cursor-pointer"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onTransact}
                                        disabled={loading}
                                        className="py-3 px-4 rounded-2xl bg-black hover:bg-slate-900 text-white text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-black/25"
                                    >
                                        {loading ? (
                                            <>
                                                <RefreshCw size={14} className="animate-spin" />
                                                <span>Processing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={14} className="text-emerald-400" />
                                                <span>Confirm & Deposit</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

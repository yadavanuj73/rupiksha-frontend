import React from 'react';
import { Plus, RefreshCw, ArrowRight, ShieldCheck, Zap, QrCode } from 'lucide-react';
import { InputField } from './ProfileShared';

const UPIDetails = ({ formData, handleInputChange, handleSave, isSaving, onVerifyUpi, isVerifyingUpi }) => {
    return (
        <div className="flex flex-col xl:flex-row gap-6">
            <div className="flex-1 bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-7 lg:p-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-50 text-[#0ea5e9] rounded-xl">
                            <QrCode size={20} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">UPI Configuration</h2>
                            <p className="text-xs text-slate-400 font-medium">Link UPI VPA address for instant settlements</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {formData.isUpiVerified && (
                            <div className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200/80">
                                <ShieldCheck size={14} className="text-emerald-600" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Verified</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="relative flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1">
                            <InputField
                                label="Primary UPI ID / VPA"
                                value={formData.upiId || ''}
                                onChange={(e) => {
                                    handleInputChange('upiId', e.target.value);
                                    if (formData.isUpiVerified) handleInputChange('isUpiVerified', false);
                                }}
                                placeholder="e.g. mobile@okaxis or name@upi"
                                subLabel="This Virtual Payment Address is used for instant payouts and ledger settlements."
                            />
                        </div>
                        <div className="sm:pt-2">
                            <button
                                type="button"
                                onClick={onVerifyUpi}
                                disabled={isVerifyingUpi || !formData.upiId || formData.isUpiVerified}
                                className={`w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase transition-all shadow-sm
                                ${formData.isUpiVerified
                                        ? 'bg-emerald-600 text-white cursor-default'
                                        : 'bg-amber-500 hover:bg-amber-600 text-white active:scale-95'
                                    } disabled:opacity-50`}
                            >
                                {isVerifyingUpi ? <RefreshCw size={14} className="animate-spin" /> : (formData.isUpiVerified ? <ShieldCheck size={14} /> : <Zap size={14} />)}
                                <span>{isVerifyingUpi ? 'Verifying...' : (formData.isUpiVerified ? 'Verified' : 'Verify UPI')}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-[#1e3a8a] hover:bg-[#1e40af] text-white px-8 py-3 rounded-xl font-bold uppercase text-xs flex items-center space-x-2 shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-60"
                    >
                        <span>{isSaving ? 'Saving Changes...' : 'Save & Submit'}</span>
                        {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    </button>
                </div>
            </div>

            {/* Helper Guide Card */}
            <div className="w-full xl:w-[340px] shrink-0 bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 lg:p-7 self-start">
                <h3 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">UPI Information</h3>
                <div className="space-y-4 text-xs text-slate-500 font-medium">
                    <p className="leading-relaxed">Register your UPI Virtual Payment Address (VPA) for quick and secure 24x7 settlements.</p>
                    <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200/70 text-amber-900">
                        <p className="font-bold uppercase text-[10px] tracking-wider mb-1">Important Security Note:</p>
                        <p className="text-[11px] leading-relaxed">Ensure the name on the UPI VPA matches your registered KYC business/individual name to prevent transaction delays.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UPIDetails;

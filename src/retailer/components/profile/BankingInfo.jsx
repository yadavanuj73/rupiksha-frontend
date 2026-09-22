import { dataService } from '../../../services/dataService';
import { Plus, ShieldCheck, RefreshCw, X, Landmark } from 'lucide-react';
import { InputField, SelectField } from './ProfileShared';

const BankingInfo = ({ formData, handleInputChange, handleSave, isSaving, isFetchingIFSC, isVerifyingAccount, setFormData, currentUser }) => {
    const rawBanks = (currentUser?.banks && Array.isArray(currentUser.banks) && currentUser.banks.length > 0)
        ? currentUser.banks
        : ((formData?.banks && Array.isArray(formData.banks) && formData.banks.length > 0)
            ? formData.banks
            : []);

    const banks = rawBanks.length > 0
        ? rawBanks
        : ((formData?.bankName || formData?.accountNumber)
            ? [{
                id: 'bank_registered',
                bankName: formData.bankName || 'Registered Bank',
                accountNumber: formData.accountNumber || '',
                ifscCode: formData.ifscCode || '',
                branchName: formData.branchName || '',
                accHolderName: formData.accHolderName || ''
            }]
            : []);

    const handleAddBank = () => {
        if (!formData.bankName || !formData.accountNumber) {
            alert("Please fill bank details first");
            return;
        }

        const newBank = {
            id: 'bank_' + Date.now(),
            bankName: formData.bankName,
            accountNumber: formData.accountNumber,
            ifscCode: formData.ifscCode,
            branchName: formData.branchName,
            accHolderName: formData.accHolderName
        };

        const success = dataService.addUserBank(currentUser?.username || 'current', newBank);
        if (success) {
            setFormData(prev => ({
                ...prev,
                accHolderName: '',
                bankName: '',
                ifscCode: '',
                branchName: '',
                accountNumber: '',
                confirmAccountNumber: ''
            }));
            handleSave();
        }
    };

    return (
        <div className="flex flex-col space-y-6">
            <div className="flex flex-col xl:flex-row gap-6">
                <div className="flex-1 bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-7 lg:p-8 space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                        <div className="p-2 bg-sky-50 text-[#0ea5e9] rounded-xl">
                            <Landmark size={20} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">Add Banking Information</h2>
                            <p className="text-xs text-slate-400 font-medium">Link settlement bank account for fast commission payouts</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                        <div className="sm:col-span-2">
                            <InputField
                                label="Account Holder Name"
                                value={formData.accHolderName || ''}
                                onChange={(e) => handleInputChange('accHolderName', e.target.value)}
                                placeholder={isVerifyingAccount ? "Verifying..." : "Account owner name as per passbook"}
                                icon={isVerifyingAccount ? <RefreshCw size={14} className="animate-spin text-sky-500" /> : (formData.accHolderName && <ShieldCheck size={14} className="text-emerald-500" />)}
                            />
                        </div>
                        <div>
                            <InputField
                                label="IFSC Code"
                                value={formData.ifscCode || ''}
                                onChange={(e) => handleInputChange('ifscCode', e.target.value.toUpperCase())}
                                placeholder="e.g. SBIN0001234"
                            />
                        </div>
                        <div>
                            <InputField
                                label="Bank Name"
                                value={formData.bankName || ''}
                                onChange={(e) => handleInputChange('bankName', e.target.value)}
                                placeholder="Fetched automatically via IFSC"
                                icon={formData.bankName && <ShieldCheck size={14} className="text-emerald-500" />}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <InputField
                                label="Branch Name"
                                value={formData.branchName || ''}
                                readOnly
                                placeholder="Branch will be fetched automatically via IFSC"
                                icon={isFetchingIFSC ? <RefreshCw size={14} className="animate-spin text-sky-500" /> : (formData.branchName && <ShieldCheck size={14} className="text-emerald-500" />)}
                            />
                        </div>
                        <div>
                            <InputField
                                label="Account Number"
                                value={formData.accountNumber || ''}
                                onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                                placeholder="Enter 9 to 18 digit account number"
                            />
                        </div>
                        <div>
                            <InputField
                                label="Confirm Account Number"
                                value={formData.confirmAccountNumber || ''}
                                onChange={(e) => handleInputChange('confirmAccountNumber', e.target.value)}
                                placeholder="Re-enter account number"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-[#1e3a8a] hover:bg-[#1e40af] text-white px-7 py-3 rounded-xl font-bold uppercase text-xs flex items-center space-x-2 shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-60"
                        >
                            <span>{isSaving ? 'Saving Changes...' : 'Save & Submit'}</span>
                            {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                        </button>
                        <button
                            onClick={handleAddBank}
                            type="button"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold uppercase text-xs flex items-center space-x-2 shadow-md active:scale-95 transition-all"
                        >
                            <Plus size={16} />
                            <span>Add to Bank List</span>
                        </button>
                    </div>
                </div>

                {/* Added Banks List */}
                <div className="w-full xl:w-[340px] shrink-0 bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 lg:p-7 overflow-y-auto max-h-[500px] self-start">
                    <h3 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                        <span>My Added Banks</span>
                        <span className="bg-sky-100 text-sky-700 text-xs px-2.5 py-0.5 rounded-full font-bold">{banks.length}</span>
                    </h3>
                    <div className="space-y-3">
                        {banks.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                                <Landmark size={28} className="mx-auto mb-2 text-slate-300" />
                                <p className="text-xs font-bold uppercase tracking-wider">No Banks Added Yet</p>
                                <p className="text-[10px] text-slate-400 mt-1">Fill bank details on left & click Add</p>
                            </div>
                        ) : (
                            banks.map((bank, index) => (
                                <div key={bank.id || index} className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/70 relative group">
                                    <button
                                        onClick={() => {
                                            if (window.confirm("Are you sure you want to remove this bank?")) {
                                                dataService.removeUserBank(currentUser?.username || 'current', bank.id);
                                            }
                                        }}
                                        className="absolute top-3 right-3 text-rose-300 hover:text-rose-500 transition-colors p-1"
                                        title="Remove bank"
                                    >
                                        <X size={15} />
                                    </button>
                                    <h4 className="text-xs font-bold text-slate-800 uppercase">{bank.bankName}</h4>
                                    <p className="text-[11px] font-medium text-slate-500 mt-1">A/C: •••• {String(bank.accountNumber || '').slice(-4)}</p>
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                                        <span className="text-[10px] font-mono font-bold text-sky-700 uppercase">{bank.ifscCode}</span>
                                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-gradient-to-r from-blue-700 to-sky-600 p-5 sm:p-6 rounded-2xl text-white flex items-center justify-between shadow-md">
                <div className="flex items-center space-x-4">
                    <div className="bg-white/20 p-3 rounded-xl shrink-0"><ShieldCheck size={24} /></div>
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-tight">Bank Details Protection & Security</h4>
                        <p className="text-xs text-blue-100 font-medium mt-0.5">All your financial records are secured with bank-grade encryption algorithms.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BankingInfo;

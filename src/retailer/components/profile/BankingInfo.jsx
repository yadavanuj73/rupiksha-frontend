import React from 'react';
import { dataService } from '../../../services/dataService';
import { Plus, ShieldCheck, RefreshCw, X, Landmark } from 'lucide-react';
import { InputField, SelectField } from './ProfileShared';

const BankingInfo = ({ formData, handleInputChange, handleSave, isSaving, isFetchingIFSC, isVerifyingAccount, setFormData, currentUser }) => {
    const rawBanks = (formData?.banks && Array.isArray(formData.banks) && formData.banks.length > 0)
        ? formData.banks
        : ((currentUser?.banks && Array.isArray(currentUser.banks) && currentUser.banks.length > 0)
            ? currentUser.banks
            : []);

    const primaryBank = rawBanks[0] || {};
    const effectiveAccHolderName = formData?.accHolderName || primaryBank.accHolderName || primaryBank.bankAccountHolder || currentUser?.accHolderName || currentUser?.name || currentUser?.fullName || '';
    const effectiveBankName = formData?.bankName || primaryBank.bankName || currentUser?.bankName || currentUser?.companyBankName || '';
    const effectiveIfscCode = formData?.ifscCode || primaryBank.ifscCode || currentUser?.ifscCode || currentUser?.bankIfsc || currentUser?.bankIfscCode || '';
    const effectiveBranchName = formData?.branchName || primaryBank.branchName || currentUser?.branchName || currentUser?.bankBranch || '';
    const effectiveAccountNumber = formData?.accountNumber || primaryBank.accountNumber || currentUser?.accountNumber || currentUser?.bankAccountNumber || currentUser?.companyBankAccountNumber || '';
    const effectiveConfirmAccountNumber = formData?.confirmAccountNumber || effectiveAccountNumber;

    const banks = rawBanks.length > 0
        ? rawBanks
        : ((effectiveBankName || effectiveAccountNumber)
            ? [{
                id: 'bank_registered',
                bankName: effectiveBankName || 'Registered Bank',
                accountNumber: effectiveAccountNumber || '',
                ifscCode: effectiveIfscCode || '',
                branchName: effectiveBranchName || '',
                accHolderName: effectiveAccHolderName || ''
            }]
            : []);

    const handleAddBank = () => {
        const bankNameToAdd = formData.bankName || effectiveBankName;
        const accountNumToAdd = formData.accountNumber || effectiveAccountNumber;
        if (!bankNameToAdd || !accountNumToAdd) {
            alert("Please fill bank details first");
            return;
        }

        const newBank = {
            id: 'bank_' + Date.now(),
            bankName: bankNameToAdd,
            accountNumber: accountNumToAdd,
            ifscCode: formData.ifscCode || effectiveIfscCode,
            branchName: formData.branchName || effectiveBranchName,
            accHolderName: formData.accHolderName || effectiveAccHolderName
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
        <div className="flex flex-col space-y-7 w-full">
            <div className="flex flex-col xl:flex-row gap-7 w-full">
                {/* Main Banking Form Card */}
                <div className="flex-1 bg-white rounded-[22px] border border-[#DCE6F2] shadow-[0_8px_30px_rgba(30,65,110,0.07)] p-6 sm:p-8 lg:p-9 relative overflow-hidden">
                    {/* Subtle Ambient Blue Accent */}
                    <div className="absolute top-0 right-0 w-80 sm:w-96 h-44 sm:h-52 bg-gradient-to-bl from-[#EAF4FF] via-[#EAF4FF]/40 to-transparent pointer-events-none rounded-tr-[22px]" />

                    {/* Header Area */}
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-11 h-11 rounded-[12px] bg-[#EAF4FF] border border-[#D7E3F2]/60 flex items-center justify-center shrink-0">
                            <Landmark size={22} strokeWidth={2} className="text-[#2563EB]" />
                        </div>
                        <div>
                            <h2 className="text-[19px] sm:text-[20px] font-[800] text-[#0B0F14] tracking-tight leading-tight">
                                Add Banking Information
                            </h2>
                            <p className="text-[13px] sm:text-[14px] font-[500] text-[#64748B] mt-0.5">
                                Link settlement bank account for fast commission payouts
                            </p>
                        </div>
                    </div>

                    {/* Subtle Horizontal Divider */}
                    <div className="w-full h-px bg-[#E3EAF3] my-6 sm:my-7 relative z-10" />

                    {/* Form Fields Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-7 relative z-10">
                        <div className="sm:col-span-2">
                            <InputField
                                label="Account Holder Name"
                                value={formData.accHolderName ?? effectiveAccHolderName ?? ''}
                                onChange={(e) => handleInputChange('accHolderName', e.target.value)}
                                placeholder={isVerifyingAccount ? "Verifying..." : "Account owner name as per passbook"}
                                icon={isVerifyingAccount ? <RefreshCw size={16} className="animate-spin text-[#2563EB]" /> : ((formData.accHolderName || effectiveAccHolderName) && <ShieldCheck size={18} className="text-[#16C784]" />)}
                            />
                        </div>
                        <div>
                            <InputField
                                label="IFSC Code"
                                value={formData.ifscCode ?? effectiveIfscCode ?? ''}
                                onChange={(e) => handleInputChange('ifscCode', e.target.value.toUpperCase())}
                                placeholder="e.g. SBIN0001234"
                            />
                        </div>
                        <div>
                            <InputField
                                label="Bank Name"
                                value={formData.bankName ?? effectiveBankName ?? ''}
                                onChange={(e) => handleInputChange('bankName', e.target.value)}
                                placeholder="Fetched automatically via IFSC"
                                icon={(formData.bankName || effectiveBankName) && <ShieldCheck size={18} className="text-[#16C784]" />}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <InputField
                                label="Branch Name"
                                value={formData.branchName ?? effectiveBranchName ?? ''}
                                readOnly
                                placeholder="Branch will be fetched automatically via IFSC"
                                icon={isFetchingIFSC ? <RefreshCw size={16} className="animate-spin text-[#2563EB]" /> : ((formData.branchName || effectiveBranchName) && <ShieldCheck size={18} className="text-[#16C784]" />)}
                            />
                        </div>
                        <div>
                            <InputField
                                label="Account Number"
                                value={formData.accountNumber ?? effectiveAccountNumber ?? ''}
                                onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                                placeholder="Enter 9 to 18 digit account number"
                            />
                        </div>
                        <div>
                            <InputField
                                label="Confirm Account Number"
                                value={formData.confirmAccountNumber ?? effectiveConfirmAccountNumber ?? ''}
                                onChange={(e) => handleInputChange('confirmAccountNumber', e.target.value)}
                                placeholder="Re-enter account number"
                            />
                        </div>
                    </div>

                    {/* Footer Section */}
                    <div className="w-full h-px bg-[#E3EAF3] my-6 sm:my-7 relative z-10" />

                    <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-[#2146A3] hover:bg-[#1B3A88] text-white px-8 py-3.5 rounded-[12px] font-bold uppercase text-[12px] sm:text-[13px] tracking-wider shadow-[0_4px_12px_rgba(33,70,163,0.25)] flex items-center space-x-2.5 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                        >
                            <span>{isSaving ? 'Saving Changes...' : 'Save & Submit'}</span>
                            {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                        </button>
                        <button
                            onClick={handleAddBank}
                            type="button"
                            className="bg-[#16C784] hover:bg-[#13ab71] text-white px-7 py-3.5 rounded-[12px] font-bold uppercase text-[12px] sm:text-[13px] tracking-wider shadow-[0_4px_12px_rgba(22,199,132,0.25)] flex items-center space-x-2 transition-all active:scale-95 cursor-pointer"
                        >
                            <Plus size={16} strokeWidth={2.5} />
                            <span>Add to Bank List</span>
                        </button>
                    </div>
                </div>

                {/* Added Banks List Sidebar */}
                <div className="w-full xl:w-[360px] shrink-0 bg-white rounded-[22px] border border-[#DCE6F2] shadow-[0_8px_30px_rgba(30,65,110,0.07)] p-6 sm:p-7 overflow-y-auto max-h-[560px] self-start relative">
                    <h3 className="text-[16px] font-[800] text-[#0B0F14] mb-4 pb-3 border-b border-[#E3EAF3] flex items-center justify-between">
                        <span>My Added Banks</span>
                        <span className="bg-[#EAF4FF] text-[#2563EB] text-xs px-3 py-1 rounded-full font-bold">{banks.length}</span>
                    </h3>
                    <div className="space-y-3.5">
                        {banks.length === 0 ? (
                            <div className="text-center py-10 text-[#64748B] bg-[#F8FAFD] rounded-[14px] border border-dashed border-[#D7E3F2]">
                                <Landmark size={32} className="mx-auto mb-2.5 text-[#64748B]/60" />
                                <p className="text-[12px] font-bold uppercase tracking-wider text-[#0B0F14]">No Banks Added Yet</p>
                                <p className="text-[11px] text-[#64748B] mt-1 font-medium">Fill bank details on left & click Add</p>
                            </div>
                        ) : (
                            banks.map((bank, index) => (
                                <div key={bank.id || index} className="p-4 bg-[#F8FAFD] hover:bg-[#F0F5FC] transition-colors rounded-[14px] border border-[#D7E3F2] relative group">
                                    <button
                                        onClick={() => {
                                            if (window.confirm("Are you sure you want to remove this bank?")) {
                                                dataService.removeUserBank(currentUser?.username || 'current', bank.id);
                                            }
                                        }}
                                        className="absolute top-3.5 right-3.5 text-[#FF3B5F]/60 hover:text-[#FF3B5F] transition-colors p-1 cursor-pointer"
                                        title="Remove bank"
                                    >
                                        <X size={16} />
                                    </button>
                                    <h4 className="text-[13px] font-bold text-[#0B0F14] uppercase pr-6">{bank.bankName}</h4>
                                    <p className="text-[12px] font-semibold text-[#64748B] mt-1">A/C: •••• {String(bank.accountNumber || '').slice(-4)}</p>
                                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[#E3EAF3]">
                                        <span className="text-[11px] font-mono font-bold text-[#2563EB] uppercase">{bank.ifscCode}</span>
                                        <span className="text-[10px] font-bold text-[#16C784] bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">Active</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Security Banner */}
            <div className="bg-gradient-to-r from-[#2146A3] to-[#2563EB] p-6 rounded-[20px] text-white flex items-center justify-between shadow-[0_8px_24px_rgba(33,70,163,0.18)]">
                <div className="flex items-center space-x-4">
                    <div className="bg-white/20 p-3 rounded-[12px] shrink-0"><ShieldCheck size={26} /></div>
                    <div>
                        <h4 className="text-[15px] font-[800] uppercase tracking-tight">Bank Details Protection & Security</h4>
                        <p className="text-[13px] text-blue-100 font-medium mt-0.5">All your financial records are secured with bank-grade encryption algorithms.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BankingInfo;


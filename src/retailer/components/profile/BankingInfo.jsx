import React from 'react';
import { dataService } from '../../../services/dataService';
import { Plus, ShieldCheck, RefreshCw, Landmark } from 'lucide-react';
import { InputField } from './ProfileShared';

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
        <div className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 w-full items-start">
                {/* Part 1 (Left 7 cols): Main Banking Form Card */}
                <div className="lg:col-span-7 bg-white rounded-[20px] border border-[#DCE6F2] shadow-[0_4px_20px_rgba(30,65,110,0.06)] p-4 sm:p-6 lg:p-7 relative overflow-hidden">
                    {/* Subtle Ambient Blue Accent */}
                    <div className="absolute top-0 right-0 w-72 h-36 bg-gradient-to-bl from-[#EAF4FF] via-[#EAF4FF]/40 to-transparent pointer-events-none rounded-tr-[20px]" />

                    {/* Header Area */}
                    <div className="flex items-center gap-3 relative z-10 mb-4">
                        <div className="w-10 h-10 rounded-[10px] bg-[#EAF4FF] border border-[#D7E3F2]/60 flex items-center justify-center shrink-0">
                            <Landmark size={20} strokeWidth={2} className="text-[#2563EB]" />
                        </div>
                        <div>
                            <h2 className="text-[17px] sm:text-[18px] font-[800] text-[#0B0F14] tracking-tight leading-tight">
                                Add Banking Information
                            </h2>
                            <p className="text-[12px] sm:text-[13px] font-[500] text-[#64748B] mt-0.5">
                                Link settlement bank account for fast commission payouts
                            </p>
                        </div>
                    </div>

                    {/* Subtle Horizontal Divider */}
                    <div className="w-full h-px bg-[#E3EAF3] mb-4 relative z-10" />

                    {/* Form Fields Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 relative z-10">
                        <div className="sm:col-span-2">
                            <InputField
                                label="Account Holder Name"
                                value={formData.accHolderName ?? effectiveAccHolderName ?? ''}
                                onChange={(e) => handleInputChange('accHolderName', e.target.value)}
                                placeholder={isVerifyingAccount ? "Verifying..." : "Account owner name as per passbook"}
                                icon={isVerifyingAccount ? <RefreshCw size={15} className="animate-spin text-[#2563EB]" /> : ((formData.accHolderName || effectiveAccHolderName) && <ShieldCheck size={16} className="text-[#16C784]" />)}
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
                                icon={(formData.bankName || effectiveBankName) && <ShieldCheck size={16} className="text-[#16C784]" />}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <InputField
                                label="Branch Name"
                                value={formData.branchName ?? effectiveBranchName ?? ''}
                                readOnly
                                placeholder="Branch will be fetched automatically via IFSC"
                                icon={isFetchingIFSC ? <RefreshCw size={15} className="animate-spin text-[#2563EB]" /> : ((formData.branchName || effectiveBranchName) && <ShieldCheck size={16} className="text-[#16C784]" />)}
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
                </div>

                {/* Part 2 (Right 5 cols): Added Banks List + Action Buttons */}
                <div className="lg:col-span-5 flex flex-col space-y-4">
                    {/* Added Banks List Card */}
                    <div className="bg-white rounded-[20px] border border-[#DCE6F2] shadow-[0_4px_20px_rgba(30,65,110,0.06)] p-4 sm:p-5 relative">
                        <h3 className="text-[14px] font-[800] text-[#0B0F14] mb-3 pb-2.5 border-b border-[#E3EAF3] flex items-center justify-between">
                            <span>My Added Banks</span>
                            <span className="bg-[#EAF4FF] text-[#2563EB] text-[11px] px-2.5 py-0.5 rounded-full font-bold">{banks.length}</span>
                        </h3>
                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto no-scrollbar">
                            {banks.length === 0 ? (
                                <div className="text-center py-6 text-[#64748B] bg-[#F8FAFD] rounded-[12px] border border-dashed border-[#D7E3F2]">
                                    <Landmark size={24} className="mx-auto mb-1.5 text-[#64748B]/60" />
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#0B0F14]">No Banks Added Yet</p>
                                    <p className="text-[10px] text-[#64748B] mt-0.5 font-medium">Fill bank details on left & click Add</p>
                                </div>
                            ) : (
                                banks.map((bank, index) => (
                                    <div key={bank.id || index} className="p-3 bg-[#F8FAFD] hover:bg-[#F0F5FC] transition-colors rounded-[12px] border border-[#D7E3F2] relative group">
                                        <h4 className="text-[12px] font-bold text-[#0B0F14] uppercase pr-2 truncate">{bank.bankName}</h4>
                                        <p className="text-[11px] font-semibold text-[#64748B] mt-0.5">A/C: •••• {String(bank.accountNumber || '').slice(-4)}</p>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E3EAF3]">
                                            <span className="text-[10.5px] font-mono font-bold text-[#2563EB] uppercase">{bank.ifscCode}</span>
                                            <span className="text-[9.5px] font-bold text-[#16C784] bg-emerald-50 border border-emerald-200/60 px-2 py-0.2 rounded-md">Active</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Action Buttons moved into Right Column */}
                    <div className="flex flex-col gap-2.5 w-full">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full bg-[#2146A3] hover:bg-[#1B3A88] text-white py-3 rounded-[11px] font-bold uppercase text-[12px] tracking-wider shadow-[0_4px_12px_rgba(33,70,163,0.20)] flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                        >
                            <span>{isSaving ? 'Saving Changes...' : 'Save & Submit'}</span>
                            {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                        </button>
                        <button
                            onClick={handleAddBank}
                            type="button"
                            className="w-full bg-[#16C784] hover:bg-[#13ab71] text-white py-3 rounded-[11px] font-bold uppercase text-[12px] tracking-wider shadow-[0_4px_12px_rgba(22,199,132,0.20)] flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
                        >
                            <Plus size={15} strokeWidth={2.5} />
                            <span>Add to Bank List</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BankingInfo;


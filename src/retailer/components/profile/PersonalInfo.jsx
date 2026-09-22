import React from 'react';
import { Camera, CheckCircle2, RefreshCw, ArrowRight, UserRound, ShieldCheck } from 'lucide-react';
import { InputField, SelectField } from './ProfileShared';

const PersonalInfo = ({
    formData,
    handleInputChange,
    handleSave,
    isSaving,
    isSendingOtp,
    profilePhoto,
    fileInputRef,
    handlePhotoChange,
    onVerifyEmail,
    onVerifyPan,
    isVerifyingPan
}) => {
    return (
        <div className="w-full">
            <div className="bg-white rounded-[20px] border border-[#DCE6F2] shadow-[0_4px_20px_rgba(30,65,110,0.06)] p-4 sm:p-6 lg:p-7 relative overflow-hidden w-full">
                {/* Subtle Ambient Blue Accent */}
                <div className="absolute top-0 right-0 w-80 sm:w-96 h-40 bg-gradient-to-bl from-[#EAF4FF] via-[#EAF4FF]/40 to-transparent pointer-events-none rounded-tr-[20px]" />

                {/* Header Area */}
                <div className="flex items-center gap-3 relative z-10 mb-4 sm:mb-5">
                    <div className="w-10 h-10 rounded-[10px] bg-[#EAF4FF] border border-[#D7E3F2]/60 flex items-center justify-center shrink-0">
                        <UserRound size={20} strokeWidth={2} className="text-[#2563EB]" />
                    </div>
                    <div>
                        <h2 className="text-[17px] sm:text-[18px] font-[800] text-[#0B0F14] tracking-tight leading-tight">
                            Update Your Personal Information
                        </h2>
                        <p className="text-[12px] sm:text-[13px] font-[500] text-[#64748B] mt-0.5">
                            Manage your personal identification and contact details
                        </p>
                    </div>
                </div>

                {/* Subtle Horizontal Divider */}
                <div className="w-full h-px bg-[#E3EAF3] mb-4 sm:mb-5 relative z-10" />

                {/* 2-Part Form Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 relative z-10 items-start">
                    {/* Part 1 (Left 5 cols): Profile Photo, Account Stats & KYC Docs */}
                    <div className="lg:col-span-5 flex flex-col space-y-4">
                        {/* Profile Photo Area */}
                        <div className="flex items-center space-x-4 p-3.5 bg-[#F8FAFD] rounded-[14px] border border-[#D7E3F2]">
                            <div className="relative group cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#D7E3F2] shadow-sm bg-white flex items-center justify-center relative">
                                    {profilePhoto ? (
                                        <img
                                            src={profilePhoto}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(formData.name || formData.username || 'User') + "&background=2563eb&color=fff";
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-[#2563EB] to-[#2146A3] flex items-center justify-center text-white text-lg font-black">
                                            {(formData.name || formData.username || 'U').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] font-bold">
                                        <Camera size={14} />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                    className="absolute -bottom-1 -right-1 bg-[#2146A3] text-white p-1.5 rounded-full border border-white shadow hover:bg-[#1B3A88] transition-colors cursor-pointer"
                                    title="Upload new photo"
                                >
                                    <Camera size={11} />
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handlePhotoChange}
                                    accept="image/*"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="text-[13px] font-bold text-[#0B0F14] truncate">{formData.name || 'Your Profile Photo'}</h4>
                                <p className="text-[11px] font-medium text-[#64748B] mt-0.5">Click camera to upload JPG, PNG</p>
                            </div>
                        </div>

                        {/* Account Overview 2x2 Badges */}
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="bg-[#F8FAFD] rounded-[11px] p-2.5 border border-[#D7E3F2] flex flex-col justify-center min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#526987]">Username</span>
                                <span className="text-[12.5px] font-bold text-[#0B0F14] truncate select-all mt-0.5" title={formData.username || 'N/A'}>
                                    {formData.username || 'N/A'}
                                </span>
                            </div>
                            <div className="bg-[#F8FAFD] rounded-[11px] p-2.5 border border-[#D7E3F2] flex flex-col justify-center min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#526987]">Registered Mobile</span>
                                <div className="flex items-center space-x-1 mt-0.5 min-w-0">
                                    <span className="text-[12.5px] font-bold text-[#0B0F14] truncate select-all">{formData.mobile || 'N/A'}</span>
                                    <CheckCircle2 size={13} className="text-[#16C784] shrink-0" />
                                </div>
                            </div>
                            <div className="bg-[#F8FAFD] rounded-[11px] p-2.5 border border-[#D7E3F2] flex flex-col justify-center min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#526987]">Email Address</span>
                                <div className="flex items-center space-x-1 mt-0.5 min-w-0">
                                    <span className="text-[12px] font-bold text-[#0B0F14] truncate select-all" title={formData.email || 'N/A'}>
                                        {formData.email || 'N/A'}
                                    </span>
                                    {formData.emailVerified ? (
                                        <CheckCircle2 size={13} className="text-[#16C784] shrink-0" />
                                    ) : (
                                        <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold shrink-0">Unverified</span>
                                    )}
                                </div>
                            </div>
                            <div className="bg-[#F8FAFD] rounded-[11px] p-2.5 border border-[#D7E3F2] flex flex-col justify-center min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#526987]">Party Code</span>
                                <span className="text-[12.5px] font-bold text-[#2563EB] font-mono truncate select-all mt-0.5">
                                    {formData.partyCode || 'PENDING'}
                                </span>
                            </div>
                        </div>

                        {/* KYC & Identity Inputs */}
                        <div className="space-y-3 pt-1">
                            <InputField
                                label="PAN Number"
                                value={formData.panNumber || ''}
                                onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
                                placeholder="ABCDE1234F"
                                icon={
                                    formData.isPanVerified ? (
                                        <div className="flex items-center gap-1 text-[#16C784] text-[10.5px] font-bold">
                                            <CheckCircle2 size={15} />
                                            <span>Verified</span>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={onVerifyPan}
                                            disabled={isVerifyingPan || !formData.panNumber}
                                            className="text-[10.5px] font-bold bg-[#EAF4FF] text-[#2563EB] px-3 py-1 rounded-full uppercase tracking-wider hover:bg-blue-100 disabled:opacity-50 cursor-pointer"
                                        >
                                            {isVerifyingPan ? 'Verifying...' : 'Verify PAN'}
                                        </button>
                                    )
                                }
                                subLabel={formData.isPanVerified ? `Verified Name: ${formData.panName || formData.name}` : "Enter 10-character PAN number"}
                            />

                            <InputField
                                label="Aadhaar Number"
                                value={formData.aadhaarNumber || ''}
                                onChange={(e) => handleInputChange('aadhaarNumber', e.target.value)}
                                placeholder="12-digit Aadhaar Number"
                                subLabel="Registered Aadhaar Number"
                            />
                        </div>
                    </div>

                    {/* Part 2 (Right 7 cols): Personal Details, Contact & Address */}
                    <div className="lg:col-span-7 flex flex-col space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <InputField label="Full Name" value={formData.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Full Name as per PAN" />
                            <InputField label="Mobile No." value={formData.mobile || ''} onChange={(e) => handleInputChange('mobile', e.target.value)} placeholder="10-digit mobile number" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <InputField
                                label="Email ID"
                                type="email"
                                value={formData.email || ''}
                                onChange={(e) => handleInputChange('email', e.target.value)}
                                placeholder="your.email@example.com"
                            />
                            <InputField label="Date Of Birth" type="date" value={formData.dob || ''} onChange={(e) => handleInputChange('dob', e.target.value)} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <SelectField label="Gender" value={formData.gender || 'Male'} options={['Male', 'Female', 'Other']} onChange={(e) => handleInputChange('gender', e.target.value)} />
                            <SelectField label="Marital Status" value={formData.maritalStatus || 'Single'} options={['Single', 'Married', 'Divorced', 'Widowed']} onChange={(e) => handleInputChange('maritalStatus', e.target.value)} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <InputField label="Personal Pincode" value={formData.personalPincode || formData.pincode || ''} onChange={(e) => handleInputChange('personalPincode', e.target.value)} placeholder="6-digit pincode" />
                            <InputField label="Personal City / Area" value={formData.personalArea || formData.area || ''} onChange={(e) => handleInputChange('personalArea', e.target.value)} placeholder="City / Area" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <InputField label="Residential Address 1" value={formData.residentialAddress1 || ''} onChange={(e) => handleInputChange('residentialAddress1', e.target.value)} placeholder="Flat, House No, Building" />
                            <InputField label="Residential Address 2" value={formData.residentialAddress2 || ''} onChange={(e) => handleInputChange('residentialAddress2', e.target.value)} placeholder="Street, Sector (Optional)" />
                        </div>
                    </div>
                </div>

                {/* Footer Section */}
                <div className="w-full h-px bg-[#E3EAF3] mt-5 mb-4 relative z-10" />

                <div className="flex justify-end relative z-10">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-[#2146A3] hover:bg-[#1B3A88] text-white px-6 py-2.5 sm:py-3 rounded-[11px] font-bold uppercase text-[12px] tracking-wider shadow-[0_4px_12px_rgba(33,70,163,0.20)] flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                    >
                        <span>{isSaving ? 'Saving Changes...' : 'Save & Submit'}</span>
                        {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PersonalInfo;


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
            <div className="bg-white rounded-[22px] border border-[#DCE6F2] shadow-[0_8px_30px_rgba(30,65,110,0.07)] p-6 sm:p-8 lg:p-9 relative overflow-hidden w-full">
                {/* Subtle Ambient Blue Accent */}
                <div className="absolute top-0 right-0 w-80 sm:w-96 h-44 sm:h-52 bg-gradient-to-bl from-[#EAF4FF] via-[#EAF4FF]/40 to-transparent pointer-events-none rounded-tr-[22px]" />

                {/* Header Area */}
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-11 h-11 rounded-[12px] bg-[#EAF4FF] border border-[#D7E3F2]/60 flex items-center justify-center shrink-0">
                        <UserRound size={22} strokeWidth={2} className="text-[#2563EB]" />
                    </div>
                    <div>
                        <h2 className="text-[19px] sm:text-[20px] font-[800] text-[#0B0F14] tracking-tight leading-tight">
                            Update Your Personal Information
                        </h2>
                        <p className="text-[13px] sm:text-[14px] font-[500] text-[#64748B] mt-0.5">
                            Manage your personal identification and contact details
                        </p>
                    </div>
                </div>

                {/* Subtle Horizontal Divider */}
                <div className="w-full h-px bg-[#E3EAF3] my-6 sm:my-7 relative z-10" />

                {/* Profile Photo & Overview Section */}
                <div className="flex flex-col items-center pb-6 sm:pb-8 w-full relative z-10">
                    <div className="relative mb-4 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-[#EAF4FF] shadow-md bg-[#F8FAFD] flex items-center justify-center relative">
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
                                <div className="w-full h-full bg-gradient-to-br from-[#2563EB] to-[#2146A3] flex items-center justify-center text-white text-2xl sm:text-3xl font-black">
                                    {(formData.name || formData.username || 'U').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-bold">
                                <Camera size={18} />
                                <span className="mt-1">Change</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            className="absolute bottom-1 right-1 bg-[#2146A3] text-white p-2.5 rounded-full border-2 border-white shadow-md hover:bg-[#1B3A88] transition-colors cursor-pointer"
                            title="Upload new photo"
                        >
                            <Camera size={14} />
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handlePhotoChange}
                            accept="image/*"
                        />
                    </div>
                    <p className="text-[12px] font-semibold text-[#64748B] mb-6 select-none text-center">
                        Click avatar or camera to upload profile photo (JPG, PNG)
                    </p>

                    {/* Account Overview Badges */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                        <div className="bg-[#F8FAFD] hover:bg-[#F0F5FC] transition-colors rounded-[14px] p-4 border border-[#D7E3F2] flex flex-col justify-center min-w-0">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#526987]">Username</span>
                            <span className="text-[14px] sm:text-[15px] font-bold text-[#0B0F14] break-all select-all mt-1 leading-snug" title={formData.username || 'N/A'}>
                                {formData.username || 'N/A'}
                            </span>
                        </div>
                        <div className="bg-[#F8FAFD] hover:bg-[#F0F5FC] transition-colors rounded-[14px] p-4 border border-[#D7E3F2] flex flex-col justify-center min-w-0">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#526987]">Registered Mobile</span>
                            <div className="flex items-center space-x-2 mt-1 flex-wrap">
                                <span className="text-[14px] sm:text-[15px] font-bold text-[#0B0F14] break-all select-all leading-snug">{formData.mobile || 'N/A'}</span>
                                <CheckCircle2 size={16} className="text-[#16C784] shrink-0" />
                            </div>
                        </div>
                        <div className="bg-[#F8FAFD] hover:bg-[#F0F5FC] transition-colors rounded-[14px] p-4 border border-[#D7E3F2] flex flex-col justify-center min-w-0">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#526987]">Email Address</span>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[14px] sm:text-[15px] font-bold text-[#0B0F14] break-all select-all leading-snug" title={formData.email || 'N/A'}>
                                    {formData.email || 'N/A'}
                                </span>
                                {formData.emailVerified ? (
                                    <CheckCircle2 size={16} className="text-[#16C784] shrink-0" />
                                ) : (
                                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-bold shrink-0">Unverified</span>
                                )}
                            </div>
                        </div>
                        <div className="bg-[#F8FAFD] hover:bg-[#F0F5FC] transition-colors rounded-[14px] p-4 border border-[#D7E3F2] flex flex-col justify-center min-w-0">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#526987]">Party Code</span>
                            <span className="text-[14px] sm:text-[15px] font-bold text-[#2563EB] font-mono break-all select-all mt-1 leading-snug">
                                {formData.partyCode || 'PENDING'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Editable Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 relative z-10">
                    <div>
                        <InputField label="Full Name" value={formData.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Full Name as per PAN" />
                    </div>
                    <div>
                        <InputField label="Mobile No." value={formData.mobile || ''} onChange={(e) => handleInputChange('mobile', e.target.value)} placeholder="10-digit mobile number" />
                    </div>
                    <div>
                        <InputField
                            label="Email ID"
                            type="email"
                            value={formData.email || ''}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            placeholder="your.email@example.com"
                        />
                    </div>
                    <div>
                        <SelectField label="Gender" value={formData.gender || 'Male'} options={['Male', 'Female', 'Other']} onChange={(e) => handleInputChange('gender', e.target.value)} />
                    </div>
                    <div>
                        <SelectField label="Marital Status" value={formData.maritalStatus || 'Single'} options={['Single', 'Married', 'Divorced', 'Widowed']} onChange={(e) => handleInputChange('maritalStatus', e.target.value)} />
                    </div>
                    <div>
                        <InputField label="Date Of Birth" type="date" value={formData.dob || ''} onChange={(e) => handleInputChange('dob', e.target.value)} />
                    </div>

                    <div>
                        <InputField
                            label="PAN Number"
                            value={formData.panNumber || ''}
                            onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
                            placeholder="ABCDE1234F"
                            icon={
                                formData.isPanVerified ? (
                                    <div className="flex items-center gap-1.5 text-[#16C784] text-[11px] font-bold">
                                        <CheckCircle2 size={16} />
                                        <span>Verified</span>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={onVerifyPan}
                                        disabled={isVerifyingPan || !formData.panNumber}
                                        className="text-[11px] font-bold bg-[#EAF4FF] text-[#2563EB] px-3.5 py-1.5 rounded-full uppercase tracking-wider hover:bg-blue-100 disabled:opacity-50 cursor-pointer"
                                    >
                                        {isVerifyingPan ? 'Verifying...' : 'Verify PAN'}
                                    </button>
                                )
                            }
                            subLabel={formData.isPanVerified ? `Verified Name: ${formData.panName || formData.name}` : "Enter 10-character PAN number"}
                        />
                    </div>

                    <div>
                        <InputField
                            label="Aadhaar Number"
                            value={formData.aadhaarNumber || ''}
                            onChange={(e) => handleInputChange('aadhaarNumber', e.target.value)}
                            placeholder="12-digit Aadhaar Number"
                            subLabel="Registered Aadhaar Number"
                        />
                    </div>

                    <div>
                        <InputField label="Personal Pincode" value={formData.personalPincode || formData.pincode || ''} onChange={(e) => handleInputChange('personalPincode', e.target.value)} placeholder="6-digit pincode" />
                    </div>

                    <div className="sm:col-span-2 lg:col-span-2">
                        <InputField label="Residential Address Line 1" value={formData.residentialAddress1 || ''} onChange={(e) => handleInputChange('residentialAddress1', e.target.value)} placeholder="Flat, House No, Building" />
                    </div>

                    <div>
                        <InputField label="Personal City / Area" value={formData.personalArea || formData.area || ''} onChange={(e) => handleInputChange('personalArea', e.target.value)} placeholder="City / Area" />
                    </div>

                    <div className="sm:col-span-2 lg:col-span-3">
                        <InputField label="Residential Address Line 2" value={formData.residentialAddress2 || ''} onChange={(e) => handleInputChange('residentialAddress2', e.target.value)} placeholder="Street, Sector, Landmark (Optional)" />
                    </div>
                </div>

                {/* Footer Section */}
                <div className="w-full h-px bg-[#E3EAF3] my-6 sm:my-7 relative z-10" />

                <div className="flex justify-end relative z-10">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-[#2146A3] hover:bg-[#1B3A88] text-white px-8 py-3.5 rounded-[12px] font-bold uppercase text-[12px] sm:text-[13px] tracking-wider shadow-[0_4px_12px_rgba(33,70,163,0.25)] flex items-center space-x-2.5 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                    >
                        <span>{isSaving ? 'Saving Changes...' : 'Save & Submit'}</span>
                        {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PersonalInfo;


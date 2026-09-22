import React from 'react';
import { Camera, CheckCircle2, RefreshCw, ArrowRight, User, ShieldCheck } from 'lucide-react';
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
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-7 lg:p-8 space-y-6 w-full">
                {/* Header & Avatar */}
                <div className="flex flex-col items-center border-b border-slate-100 pb-6 w-full">
                    <div className="flex items-center justify-between w-full mb-6">
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">Update Your Personal Information</h2>
                            <p className="text-xs text-slate-400 font-medium">Manage your personal identification and contact details</p>
                        </div>
                    </div>

                    <div className="relative mb-6 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-sky-100 shadow-lg bg-slate-100 flex items-center justify-center relative">
                            {profilePhoto ? (
                                <img
                                    src={profilePhoto}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(formData.name || 'User') + "&background=0ea5e9&color=fff";
                                    }}
                                />
                            ) : (
                                <User size={42} className="text-slate-400" />
                            )}
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold">
                                <Camera size={18} />
                                <span>Change</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            className="absolute bottom-1 right-1 bg-[#1e3a8a] text-white p-2.5 rounded-full border-2 border-white shadow-md hover:bg-blue-800 transition-colors"
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
                    <p className="text-[11px] font-semibold text-slate-400 -mt-3 mb-6">Click avatar or camera to upload profile photo (JPG, PNG)</p>

                    {/* Account Overview Badges (Full width, auto-wrap, no truncating - shows complete details) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
                        <div className="bg-slate-50/90 hover:bg-slate-100/70 transition-colors rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-center min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Username</span>
                            <span className="text-[13px] font-bold text-slate-800 break-all select-all mt-1 leading-snug" title={formData.username || 'N/A'}>
                                {formData.username || 'N/A'}
                            </span>
                        </div>
                        <div className="bg-slate-50/90 hover:bg-slate-100/70 transition-colors rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-center min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registered Mobile</span>
                            <div className="flex items-center space-x-1.5 mt-1 flex-wrap">
                                <span className="text-[13px] font-bold text-slate-800 break-all select-all leading-snug">{formData.mobile || 'N/A'}</span>
                                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                            </div>
                        </div>
                        <div className="bg-slate-50/90 hover:bg-slate-100/70 transition-colors rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-center min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</span>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-[13px] font-bold text-slate-800 break-all select-all leading-snug" title={formData.email || 'N/A'}>
                                    {formData.email || 'N/A'}
                                </span>
                                {formData.emailVerified ? (
                                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                                ) : (
                                    <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold shrink-0">Unverified</span>
                                )}
                            </div>
                        </div>
                        <div className="bg-slate-50/90 hover:bg-slate-100/70 transition-colors rounded-xl p-3.5 border border-slate-200/70 flex flex-col justify-center min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Party Code</span>
                            <span className="text-[13px] font-bold text-sky-700 font-mono break-all select-all mt-1 leading-snug">
                                {formData.partyCode || 'PENDING'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Editable Fields Grid (Full Width & Spacious) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
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
                                    <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold">
                                        <CheckCircle2 size={15} />
                                        <span>Verified</span>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={onVerifyPan}
                                        disabled={isVerifyingPan || !formData.panNumber}
                                        className="text-[10px] font-black bg-sky-50 text-sky-600 px-3 py-1 rounded-full uppercase tracking-wider hover:bg-sky-100 disabled:opacity-50"
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

                <div className="flex justify-end pt-4 border-t border-slate-100">
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
        </div>
    );
};

export default PersonalInfo;

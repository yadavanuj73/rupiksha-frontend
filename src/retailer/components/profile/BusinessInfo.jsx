import React from 'react';
import { ArrowRight, RefreshCw, Building2 } from 'lucide-react';
import { InputField, SelectField } from './ProfileShared';

const BusinessInfo = ({ formData, handleInputChange, handleSave, isSaving }) => {
    return (
        <div className="w-full">
            <div className="bg-white rounded-[20px] border border-[#DCE6F2] shadow-[0_4px_20px_rgba(30,65,110,0.06)] p-4 sm:p-6 lg:p-7 relative overflow-hidden w-full">
                {/* Subtle Ambient Blue Accent */}
                <div className="absolute top-0 right-0 w-80 sm:w-96 h-40 bg-gradient-to-bl from-[#EAF4FF] via-[#EAF4FF]/40 to-transparent pointer-events-none rounded-tr-[20px]" />

                {/* Header Area */}
                <div className="flex items-center gap-3 relative z-10 mb-4 sm:mb-5">
                    <div className="w-10 h-10 rounded-[10px] bg-[#EAF4FF] border border-[#D7E3F2]/60 flex items-center justify-center shrink-0">
                        <Building2 size={20} strokeWidth={2} className="text-[#2563EB]" />
                    </div>
                    <div>
                        <h2 className="text-[17px] sm:text-[18px] font-[800] text-[#0B0F14] tracking-tight leading-tight">
                            Update Your Business Information
                        </h2>
                        <p className="text-[12px] sm:text-[13px] font-[500] text-[#64748B] mt-0.5">
                            Keep your shop and business profile updated
                        </p>
                    </div>
                </div>

                {/* Subtle Horizontal Divider */}
                <div className="w-full h-px bg-[#E3EAF3] mb-4 sm:mb-5 relative z-10" />

                {/* 2-Part Form Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-7 relative z-10">
                    {/* Part 1: Business Overview & Classification */}
                    <div className="flex flex-col space-y-3.5">
                        <InputField
                            label="Business / Shop Name"
                            value={formData.businessName || ''}
                            onChange={(e) => handleInputChange('businessName', e.target.value)}
                            placeholder="Enter registered business name"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <SelectField
                                label="Business Type"
                                value={formData.businessType || 'Sole proprietorship'}
                                options={['Sole proprietorship', 'Partnership', 'Private Limited', 'Public Limited', 'Individual']}
                                onChange={(e) => handleInputChange('businessType', e.target.value)}
                            />
                            <SelectField
                                label="Business Category"
                                value={formData.category || 'Retail'}
                                options={['Retail', 'Telecom', 'Fintech', 'Hosting', 'E-Commerce', 'Wholesale']}
                                onChange={(e) => handleInputChange('category', e.target.value)}
                            />
                        </div>

                        <InputField
                            label="GST Number"
                            value={formData.gstNumber || ''}
                            onChange={(e) => handleInputChange('gstNumber', e.target.value.toUpperCase())}
                            placeholder="GSTIN (Optional)"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-0.5">
                            <InputField
                                label="Sales Executive Name"
                                value={formData.salesName || ''}
                                onChange={(e) => handleInputChange('salesName', e.target.value)}
                                placeholder="Executive Name"
                            />
                            <InputField
                                label="Sales Executive Contact"
                                value={formData.salesContact || ''}
                                onChange={(e) => handleInputChange('salesContact', e.target.value)}
                                placeholder="Executive Mobile"
                            />
                        </div>
                    </div>

                    {/* Part 2: Address & Location Details */}
                    <div className="flex flex-col space-y-3.5">
                        <InputField
                            label="Business Address Line 1"
                            value={formData.address1 || formData.shopAddress || ''}
                            onChange={(e) => handleInputChange('address1', e.target.value)}
                            placeholder="Building, Street, Landmark"
                        />

                        <InputField
                            label="Business Address Line 2"
                            value={formData.address2 || ''}
                            onChange={(e) => handleInputChange('address2', e.target.value)}
                            placeholder="Area, Landmark (Optional)"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <InputField
                                label="Pincode"
                                value={formData.pincode || ''}
                                onChange={(e) => handleInputChange('pincode', e.target.value)}
                                placeholder="6-digit pincode"
                            />
                            <InputField
                                label="City / Area"
                                value={formData.area || formData.city || ''}
                                onChange={(e) => handleInputChange('area', e.target.value)}
                                placeholder="City / Area"
                            />
                        </div>

                        {/* Verification Note Box */}
                        <div className="p-3 bg-[#F8FAFD] rounded-[11px] border border-[#D7E3F2] flex items-center justify-between mt-auto">
                            <span className="text-[11px] font-bold text-[#526987] uppercase tracking-wide">Shop Verification</span>
                            <span className="text-[11px] font-bold text-[#16C784] bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">Verified Address</span>
                        </div>
                    </div>
                </div>

                {/* Footer Section */}
                <div className="w-full h-px bg-[#E3EAF3] mt-5 mb-4 relative z-10" />

                <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
                    <button
                        type="button"
                        className="text-[11.5px] font-bold text-[#2563EB] uppercase tracking-wider hover:underline select-none"
                    >
                        Shop Address Verification
                    </button>
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

export default BusinessInfo;


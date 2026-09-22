import React from 'react';
import { ArrowRight, RefreshCw, Building2 } from 'lucide-react';
import { InputField, SelectField } from './ProfileShared';

const BusinessInfo = ({ formData, handleInputChange, handleSave, isSaving }) => {
    return (
        <div className="w-full">
            <div className="bg-white rounded-[22px] border border-[#DCE6F2] shadow-[0_8px_30px_rgba(30,65,110,0.07)] p-6 sm:p-8 lg:p-9 relative overflow-hidden w-full">
                {/* Subtle Ambient Blue Accent */}
                <div className="absolute top-0 right-0 w-80 sm:w-96 h-44 sm:h-52 bg-gradient-to-bl from-[#EAF4FF] via-[#EAF4FF]/40 to-transparent pointer-events-none rounded-tr-[22px]" />

                {/* Header Area */}
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-11 h-11 rounded-[12px] bg-[#EAF4FF] border border-[#D7E3F2]/60 flex items-center justify-center shrink-0">
                        <Building2 size={22} strokeWidth={2} className="text-[#2563EB]" />
                    </div>
                    <div>
                        <h2 className="text-[19px] sm:text-[20px] font-[800] text-[#0B0F14] tracking-tight leading-tight">
                            Update Your Business Information
                        </h2>
                        <p className="text-[13px] sm:text-[14px] font-[500] text-[#64748B] mt-0.5">
                            Keep your shop and business profile updated
                        </p>
                    </div>
                </div>

                {/* Subtle Horizontal Divider */}
                <div className="w-full h-px bg-[#E3EAF3] my-6 sm:my-7 relative z-10" />

                {/* Form Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 relative z-10">
                    {/* Row 1: Full Width Business Name */}
                    <div className="col-span-full">
                        <InputField
                            label="Business / Shop Name"
                            value={formData.businessName || ''}
                            onChange={(e) => handleInputChange('businessName', e.target.value)}
                            placeholder="Enter registered business name"
                        />
                    </div>

                    {/* Row 2: Business Type, Category, GST */}
                    <div>
                        <SelectField
                            label="Business Type"
                            value={formData.businessType || 'Sole proprietorship'}
                            options={['Sole proprietorship', 'Partnership', 'Private Limited', 'Public Limited', 'Individual']}
                            onChange={(e) => handleInputChange('businessType', e.target.value)}
                        />
                    </div>
                    <div>
                        <SelectField
                            label="Business Category"
                            value={formData.category || 'Retail'}
                            options={['Retail', 'Telecom', 'Fintech', 'Hosting', 'E-Commerce', 'Wholesale']}
                            onChange={(e) => handleInputChange('category', e.target.value)}
                        />
                    </div>
                    <div>
                        <InputField
                            label="GST Number"
                            value={formData.gstNumber || ''}
                            onChange={(e) => handleInputChange('gstNumber', e.target.value.toUpperCase())}
                            placeholder="GSTIN (Optional)"
                        />
                    </div>

                    {/* Row 3: Address Line 1 & Line 2 */}
                    <div className="md:col-span-1 lg:col-span-2">
                        <InputField
                            label="Business Address Line 1"
                            value={formData.address1 || formData.shopAddress || ''}
                            onChange={(e) => handleInputChange('address1', e.target.value)}
                            placeholder="Building, Street, Landmark"
                        />
                    </div>
                    <div>
                        <InputField
                            label="Business Address Line 2"
                            value={formData.address2 || ''}
                            onChange={(e) => handleInputChange('address2', e.target.value)}
                            placeholder="Area, Landmark (Optional)"
                        />
                    </div>

                    {/* Row 4: Pincode, City / Area, Sales Executive Name */}
                    <div>
                        <InputField
                            label="Pincode"
                            value={formData.pincode || ''}
                            onChange={(e) => handleInputChange('pincode', e.target.value)}
                            placeholder="6-digit pincode"
                        />
                    </div>
                    <div>
                        <InputField
                            label="City / Area"
                            value={formData.area || formData.city || ''}
                            onChange={(e) => handleInputChange('area', e.target.value)}
                            placeholder="City / Area"
                        />
                    </div>
                    <div>
                        <InputField
                            label="Sales Executive Name"
                            value={formData.salesName || ''}
                            onChange={(e) => handleInputChange('salesName', e.target.value)}
                            placeholder="Executive Name"
                        />
                    </div>

                    {/* Optional Sales Executive Contact */}
                    {formData.salesContact !== undefined && (
                        <div className="col-span-full md:col-span-1">
                            <InputField
                                label="Sales Executive Contact"
                                value={formData.salesContact || ''}
                                onChange={(e) => handleInputChange('salesContact', e.target.value)}
                                placeholder="Executive Mobile"
                            />
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="w-full h-px bg-[#E3EAF3] my-6 sm:my-7 relative z-10" />

                <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
                    <button
                        type="button"
                        className="text-[12px] font-bold text-[#2563EB] uppercase tracking-wider hover:underline select-none"
                    >
                        Shop Address Verification
                    </button>
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

export default BusinessInfo;


import React from 'react';
import { ArrowRight, RefreshCw, Building2 } from 'lucide-react';
import { InputField, SelectField } from './ProfileShared';

const BusinessInfo = ({ formData, handleInputChange, handleSave, isSaving }) => {
    return (
        <div className="w-full">
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-7 lg:p-8 space-y-6 w-full">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-sky-50 text-[#0ea5e9] rounded-xl">
                        <Building2 size={20} />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">Update Your Business Information</h2>
                        <p className="text-xs text-slate-400 font-medium">Keep your shop and business profile updated</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                    <div className="sm:col-span-2 lg:col-span-3">
                        <InputField label="Business / Shop Name" value={formData.businessName || ''} onChange={(e) => handleInputChange('businessName', e.target.value)} placeholder="Enter registered business name" />
                    </div>
                    <SelectField label="Business Type" value={formData.businessType || 'Sole proprietorship'} options={['Sole proprietorship', 'Partnership', 'Private Limited', 'Public Limited', 'Individual']} onChange={(e) => handleInputChange('businessType', e.target.value)} />
                    <SelectField label="Business Category" value={formData.category || 'Retail'} options={['Retail', 'Telecom', 'Fintech', 'Hosting', 'E-Commerce', 'Wholesale']} onChange={(e) => handleInputChange('category', e.target.value)} />
                    <div>
                        <InputField label="GST Number" value={formData.gstNumber || ''} onChange={(e) => handleInputChange('gstNumber', e.target.value.toUpperCase())} placeholder="GSTIN (Optional)" />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-2">
                        <InputField label="Business Address Line 1" value={formData.address1 || formData.shopAddress || ''} onChange={(e) => handleInputChange('address1', e.target.value)} placeholder="Building, Street, Landmark" />
                    </div>
                    <div>
                        <InputField label="Business Address Line 2" value={formData.address2 || ''} onChange={(e) => handleInputChange('address2', e.target.value)} placeholder="Area, Landmark (Optional)" />
                    </div>
                    <div>
                        <InputField label="Pincode" value={formData.pincode || ''} onChange={(e) => handleInputChange('pincode', e.target.value)} placeholder="6-digit pincode" />
                    </div>
                    <div>
                        <InputField label="City / Area" value={formData.area || formData.city || ''} onChange={(e) => handleInputChange('area', e.target.value)} placeholder="City / Area" />
                    </div>
                    <div>
                        <InputField label="Sales Executive Name" value={formData.salesName || ''} onChange={(e) => handleInputChange('salesName', e.target.value)} placeholder="Executive Name" />
                    </div>
                    <div>
                        <InputField label="Sales Executive Contact" value={formData.salesContact || ''} onChange={(e) => handleInputChange('salesContact', e.target.value)} placeholder="Executive Mobile" />
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
                    <button type="button" className="text-[11px] font-bold text-sky-600 uppercase tracking-wider hover:underline">
                        Shop Address Verification
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-[#1e3a8a] hover:bg-[#1e40af] text-white px-7 py-3 rounded-xl font-bold uppercase text-xs flex items-center space-x-2 shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-60"
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

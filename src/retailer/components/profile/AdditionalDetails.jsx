import React from 'react';
import { RefreshCw, ArrowRight, ChevronDown, Layers } from 'lucide-react';
import { InputField, SelectField } from './ProfileShared';

const AdditionalDetails = ({ formData, handleInputChange, handleSave, isSaving, additionalTab, setAdditionalTab }) => {
    return (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5 bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <Layers size={18} className="text-[#0ea5e9]" />
                    <span className="text-sm font-bold text-slate-800">Additional Profile Details</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {['personal', 'business', 'general'].map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setAdditionalTab(tab)}
                            className={`px-4 py-2 text-xs font-bold uppercase tracking-tight transition-all rounded-xl shadow-xs ${
                                additionalTab === tab
                                    ? 'bg-[#1e3a8a] text-white'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                            }`}
                        >
                            {tab} details
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-5 sm:p-7 lg:p-8">
                {additionalTab === 'personal' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                        <InputField label="Alternative Mobile Number" value={formData.altNumber || ''} onChange={(e) => handleInputChange('altNumber', e.target.value)} placeholder="Secondary contact number" />
                        <SelectField label="Educational Qualification" value={formData.addEducation || 'GRADUATE'} options={['HIGHER SECONDARY', 'GRADUATE', 'POST GRADUATE', 'DIPLOMA', 'OTHER']} onChange={(e) => handleInputChange('addEducation', e.target.value)} />
                        <SelectField label="Physically Handicapped" value={formData.handicapped || 'NO'} options={['NO', 'YES']} onChange={(e) => handleInputChange('handicapped', e.target.value)} />
                        <SelectField label="Nominee Relationship" value={formData.nomineeDetails || 'Spouse'} options={['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Sibling']} onChange={(e) => handleInputChange('nomineeDetails', e.target.value)} />
                        <InputField label="Nominee Full Name" value={formData.nomineeName || ''} onChange={(e) => handleInputChange('nomineeName', e.target.value)} placeholder="Nominee legal name" />
                        <InputField label="Nominee Age" value={formData.nomineeAge || ''} onChange={(e) => handleInputChange('nomineeAge', e.target.value)} placeholder="Nominee age (years)" />
                        <SelectField label="Marital Status" value={formData.marriedStatus || 'Single'} options={['Single', 'Married']} onChange={(e) => handleInputChange('marriedStatus', e.target.value)} />
                        <InputField label="Spouse Name" value={formData.spouseName || ''} onChange={(e) => handleInputChange('spouseName', e.target.value)} placeholder="Spouse name (if married)" />
                        <InputField label="Wedding Date" type="date" value={formData.weddingDate || ''} onChange={(e) => handleInputChange('weddingDate', e.target.value)} />
                    </div>
                )}

                {additionalTab === 'business' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                        <SelectField label="Expected Monthly Business (Rs)" value={formData.expectedBizRs || '5 Lac to 10 Lac'} options={['Under 1 Lac', '1 Lac to 5 Lac', '5 Lac to 10 Lac', '10 Lac to 25 Lac', 'Above 25 Lac']} onChange={(e) => handleInputChange('expectedBizRs', e.target.value)} />
                        <SelectField label="Expected Monthly Transactions" value={formData.expectedBizTxn || '1001 to 2000'} options={['100 to 500', '501 to 1000', '1001 to 2000', 'Above 2000']} onChange={(e) => handleInputChange('expectedBizTxn', e.target.value)} />
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Weekly Off Day</label>
                            <div className="bg-[#1e1e4b] text-white px-3 py-1.5 rounded-lg text-xs font-bold inline-block">Sunday</div>
                        </div>
                        <SelectField label="Current Monthly Income" value={formData.monthlyIncome || '50K to 1 Lac'} options={['Under 25K', '25K to 50K', '50K to 1 Lac', 'Above 1 Lac']} onChange={(e) => handleInputChange('monthlyIncome', e.target.value)} />
                        <SelectField label="Business Experience (Years)" value={formData.bizExperience || '3 to 5 years'} options={['1 to 2 years', '3 to 5 years', '5 to 10 years', '10 years & above']} onChange={(e) => handleInputChange('bizExperience', e.target.value)} />
                        <SelectField label="Daily Customer Footfall" value={formData.footFall || '101 to 250'} options={['Under 50', '51 to 100', '101 to 250', 'Above 250']} onChange={(e) => handleInputChange('footFall', e.target.value)} />
                    </div>
                )}

                {additionalTab === 'general' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                        <SelectField label="Additional Services Required" value={formData.servicesRequired || 'NO'} options={['NO', 'YES']} onChange={(e) => handleInputChange('servicesRequired', e.target.value)} />
                        <InputField label="Specific Services of Interest" value={formData.selectServices || ''} onChange={(e) => handleInputChange('selectServices', e.target.value)} placeholder="e.g. Micro ATM, CMS, Payouts" />
                        <SelectField label="Competitor Partner ID Available?" value={formData.competitorId || 'NO'} options={['NO', 'YES']} onChange={(e) => handleInputChange('competitorId', e.target.value)} />
                        <InputField label="Existing Competitors Used" value={formData.competitors || ''} onChange={(e) => handleInputChange('competitors', e.target.value)} placeholder="e.g. Spice Money, Payworld, Fingpay" />
                        <div className="sm:col-span-2">
                            <InputField label="How did you hear about RuPiKsha?" value={formData.referenceFrom || ''} onChange={(e) => handleInputChange('referenceFrom', e.target.value)} placeholder="e.g. Sales Executive, Social Media, Referral" />
                        </div>
                    </div>
                )}
            </div>

            <div className="p-5 sm:p-7 border-t border-slate-100 flex justify-end bg-slate-50/50">
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
    );
};

export default AdditionalDetails;

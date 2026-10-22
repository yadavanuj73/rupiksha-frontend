import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Search,
    Building2,
    Lock
} from 'lucide-react';
import MobilePrepaidFlow from './MobilePrepaidFlow';
import ElectricityFlow from './ElectricityFlow';
import LoanRepaymentFlow from './LoanRepaymentFlow';
import BbpsServiceNav from './BbpsServiceNav';

const BbpsCategoryDetail = ({ category, onBack }) => {
    const [billerSearch, setBillerSearch] = useState('');
    const [customerIdentifier, setCustomerIdentifier] = useState('');
    const [customerMobile, setCustomerMobile] = useState('');

    if (!category) return null;

    if (category.id === 'mobile-prepaid') {
        return <MobilePrepaidFlow onBack={onBack} category={category} />;
    }

    if (category.id === 'electricity') {
        return <ElectricityFlow onBack={onBack} category={category} />;
    }

    if (category.id === 'loan-repayment' || category.id === 'loan') {
        return <LoanRepaymentFlow onBack={onBack} category={category} />;
    }

    const Icon = category.icon;
    const gradient = category.gradient || 'from-indigo-500 to-blue-600';

    return (
        <div className="space-y-4 font-['Inter',sans-serif] max-w-full overflow-hidden">
            {/* Top Navigation & Service Bar */}
            <BbpsServiceNav
                onBack={onBack}
                title={category.name}
                icon={category.icon}
                gradient={category.gradient || 'from-indigo-500 to-blue-600'}
                badgeText="Bharat Connect"
            />

            {/* Main Responsive Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* LEFT: Biller Search & Biller Selection */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="rounded-2xl md:rounded-3xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs">
                        <div className="flex items-center justify-between mb-3.5">
                            <div>
                                <h3 className="text-sm md:text-base font-black text-black">
                                    Select Biller
                                </h3>
                                <p className="text-xs text-slate-700 font-bold">
                                    Search registered billers for {category.name}
                                </p>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-black border border-slate-300">
                                Provider Catalogue
                            </span>
                        </div>

                        {/* Search Input */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                            <input
                                type="text"
                                value={billerSearch}
                                onChange={(e) => setBillerSearch(e.target.value)}
                                placeholder={`Search ${category.name} billers by name, state, or operator...`}
                                className="w-full pl-10 pr-4 py-2.5 text-xs md:text-sm rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-bold text-black placeholder-slate-500 transition-all shadow-2xs"
                            />
                        </div>

                        {/* Biller Area Placeholder */}
                        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-6 md:p-8 text-center space-y-2.5">
                            <div className="mx-auto w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-xs">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-black">
                                    Biller integration will be available soon.
                                </h4>
                                <p className="text-xs font-bold text-slate-700 max-w-md mx-auto leading-relaxed">
                                    Live biller catalogue synchronization for <span className="font-black text-black">{category.name}</span> will connect with the official Bharat Connect MDM API in the next release.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Dynamic Customer Input Form Area */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="rounded-2xl md:rounded-3xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div>
                                <h3 className="text-sm md:text-base font-black text-black">
                                    Customer Details
                                </h3>
                                <p className="text-xs text-slate-700 font-bold">
                                    Dynamic biller input configuration
                                </p>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                                Coming Soon
                            </span>
                        </div>

                        {/* Customer Identifier Parameter */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-black text-black">
                                {category.fieldLabel || 'Consumer Identifier / Account Number'}
                                <span className="text-rose-600 ml-1">*</span>
                            </label>
                            <input
                                type="text"
                                value={customerIdentifier}
                                onChange={(e) => setCustomerIdentifier(e.target.value)}
                                placeholder={category.fieldPlaceholder || 'Enter consumer number'}
                                disabled
                                className="w-full px-3.5 py-2.5 text-xs md:text-sm rounded-xl border border-slate-300 bg-slate-100 text-slate-700 font-bold cursor-not-allowed"
                            />
                            <p className="text-[11px] text-slate-600 font-bold">
                                Specific input parameters will be dynamically loaded upon selecting a biller.
                            </p>
                        </div>

                        {/* Customer Mobile Number */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-black text-black">
                                Customer Mobile Number
                                <span className="text-rose-600 ml-1">*</span>
                            </label>
                            <input
                                type="tel"
                                maxLength={10}
                                value={customerMobile}
                                onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, ''))}
                                placeholder="10-digit mobile number for SMS receipt"
                                disabled
                                className="w-full px-3.5 py-2.5 text-xs md:text-sm rounded-xl border border-slate-300 bg-slate-100 text-slate-700 font-bold cursor-not-allowed"
                            />
                        </div>

                        {/* Continue Button */}
                        <button
                            type="button"
                            disabled
                            aria-disabled="true"
                            className="w-full py-3 px-5 rounded-xl bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed transition-all shadow-none border border-slate-300 mt-2"
                            title="Payment processing will be available soon"
                        >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Continue to Payment (Coming Soon)</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BbpsCategoryDetail;

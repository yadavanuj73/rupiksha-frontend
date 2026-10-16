import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Search,
    ShieldCheck,
    Info,
    Building2,
    Lock
} from 'lucide-react';

const BbpsCategoryDetail = ({ category, onBack }) => {
    const [billerSearch, setBillerSearch] = useState('');
    const [customerIdentifier, setCustomerIdentifier] = useState('');
    const [customerMobile, setCustomerMobile] = useState('');

    if (!category) return null;

    const Icon = category.icon;
    const gradient = category.gradient || 'from-indigo-500 to-blue-600';

    return (
        <div className="space-y-5 font-['Inter',sans-serif]">
            {/* Top Breadcrumb & Back Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="group inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-300 text-black font-black text-xs hover:border-blue-600 hover:text-blue-700 hover:shadow-xs transition-all cursor-pointer"
                >
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    <span>Back to all categories</span>
                </button>

                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span className="text-slate-600">Bharat Connect</span>
                    <span>/</span>
                    <span className="text-black font-black">{category.name}</span>
                </nav>
            </div>

            {/* Category Header Card */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs"
            >
                <div className={`pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-3xl`} />

                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                    <div
                        className={`h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-3xl bg-gradient-to-br ${gradient} text-white shadow-xl flex items-center justify-center shrink-0`}
                    >
                        <Icon className="h-8 w-8 md:h-10 md:w-10 drop-shadow-sm" strokeWidth={2.3} />
                    </div>

                    <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h2 className="text-2xl md:text-3xl font-black text-black tracking-tight">
                                {category.name}
                            </h2>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border bg-slate-100 text-black border-slate-300 shadow-2xs">
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                                Official BBPS Category
                            </span>
                        </div>
                        <p className="text-xs md:text-sm font-bold text-slate-800 max-w-2xl leading-relaxed">
                            {category.description}
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Main Two-Column Layout: Biller Selection & Dynamic Customer Input */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* LEFT: Biller Search & Biller List */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-base font-black text-black">
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
                        <div className="relative mb-5">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                            <input
                                type="text"
                                value={billerSearch}
                                onChange={(e) => setBillerSearch(e.target.value)}
                                placeholder={`Search ${category.name} billers by name, state, or operator...`}
                                className="w-full pl-11 pr-4 py-3 text-sm rounded-2xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-bold text-black placeholder-slate-500 transition-all"
                            />
                        </div>

                        {/* Biller Area Placeholder */}
                        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center space-y-3">
                            <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-xs">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-black">
                                    Biller integration will be available soon.
                                </h4>
                                <p className="text-xs font-bold text-slate-700 max-w-md mx-auto leading-relaxed">
                                    Live biller catalogue synchronization for <span className="font-black text-black">{category.name}</span> will connect with the official Bharat Connect MDM API in the next release.
                                </p>
                            </div>
                            <div className="pt-2 flex items-center justify-center gap-2 text-[11px] font-black text-blue-700">
                                <Info className="w-3.5 h-3.5" />
                                <span>No fabricated billers displayed</span>
                            </div>
                        </div>
                    </div>

                    {/* Category Information Note */}
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 flex items-start gap-3 text-xs text-blue-950 leading-relaxed font-bold">
                        <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-black text-black">NPCI Bharat Connect Guarantee: </span>
                            Once integrated, every transaction initiated through this portal will generate an official BBPS reference number and support instant bill fetch where enabled by the respective utility board.
                        </div>
                    </div>
                </div>

                {/* RIGHT: Dynamic Customer Input Form Area */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div>
                                <h3 className="text-base font-black text-black">
                                    Customer Details
                                </h3>
                                <p className="text-xs text-slate-700 font-bold">
                                    Dynamic biller input configuration
                                </p>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-black border border-slate-300">
                                Pending Integration
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
                                className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-300 bg-slate-100 text-slate-700 font-bold cursor-not-allowed"
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
                                className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-300 bg-slate-100 text-slate-700 font-bold cursor-not-allowed"
                            />
                        </div>

                        {/* Notice Box */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800 space-y-1">
                            <div className="flex items-center gap-1.5 font-black text-black">
                                <Lock className="w-3.5 h-3.5 text-slate-700" />
                                <span>Future Integration Readiness</span>
                            </div>
                            <p className="font-bold text-[11.5px] leading-relaxed text-slate-700">
                                Client-side input validation, bill fetch endpoints, and wallet debit flow will be enabled once backend provider services are connected.
                            </p>
                        </div>

                        {/* Continue Button */}
                        <button
                            type="button"
                            disabled
                            aria-disabled="true"
                            className="w-full py-3.5 px-5 rounded-2xl bg-slate-200 text-slate-500 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed transition-all shadow-none border border-slate-300"
                            title="Payment processing will be available once biller integration is activated"
                        >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Continue to Payment (Integration Pending)</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BbpsCategoryDetail;

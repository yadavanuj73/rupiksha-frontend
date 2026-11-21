import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, History, ShieldCheck, Landmark } from 'lucide-react';
import ManualWalletRecharge from '../../components/shared/ManualWalletRecharge';
import FundRequestHistoryView from '../../components/shared/FundRequestHistoryView';

const NAVY = '#0f2557';
const NAVY3 = '#2257a8';

const AddMoney = () => {
    const [activeTab, setActiveTab] = useState('recharge');

    return (
        <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-16 font-['Inter',sans-serif]">
            {/* Page Header */}
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm"
            >
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[3px] mb-1" style={{ color: NAVY3 }}>
                        DISTRIBUTOR PORTAL
                    </p>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: NAVY }}>
                        Add Money to Wallet
                    </h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Manual bank transfer & direct float approval
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Tab Switcher */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('recharge')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'recharge'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Wallet size={14} /> Recharge
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'history'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <History size={14} /> My Requests
                        </button>
                    </div>

                    <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                        <ShieldCheck size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            256-Bit Encrypted
                        </span>
                    </div>
                </div>
            </motion.div>

            {/* Content Area */}
            <div>
                {activeTab === 'recharge' ? (
                    <ManualWalletRecharge
                        portalTitle="Distributor Portal"
                        onRechargeSubmitted={() => setActiveTab('history')}
                    />
                ) : (
                    <FundRequestHistoryView
                        title="Distributor Fund Request History"
                        subtitle="Track status of your manual bank transfer approvals"
                    />
                )}
            </div>
        </div>
    );
};

export default AddMoney;

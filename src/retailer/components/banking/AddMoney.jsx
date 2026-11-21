import React, { useState } from 'react';
import { Wallet, History, ShieldCheck } from 'lucide-react';
import ManualWalletRecharge from '../../../components/shared/ManualWalletRecharge';
import FundRequestHistoryView from '../../../components/shared/FundRequestHistoryView';

const AddMoney = ({ mode = 'add-money' }) => {
    const [activeTab, setActiveTab] = useState('recharge');

    return (
        <div className="flex flex-col min-h-full bg-slate-50 font-['Inter',sans-serif]">
            {/* Top Navigation & Subheader */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center space-x-3">
                    <div className="bg-blue-600 p-2 rounded-xl text-white shadow-sm">
                        <Wallet size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                            Wallet Top-Up
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Direct Bank Transfer & Float Approval
                        </p>
                    </div>
                </div>

                {/* Tabs & Security Badge */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('recharge')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'recharge'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Wallet size={14} /> Recharge
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'history'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <History size={14} /> My Requests
                        </button>
                    </div>

                    <div className="hidden md:flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">RBI Verified Flow</span>
                    </div>
                </div>
            </div>

            {/* Tab Body */}
            <div className="flex-1 p-3 sm:p-6 lg:p-8">
                {activeTab === 'recharge' ? (
                    <ManualWalletRecharge
                        portalTitle="Retailer Portal"
                        onRechargeSubmitted={() => setActiveTab('history')}
                    />
                ) : (
                    <div className="max-w-6xl mx-auto">
                        <FundRequestHistoryView
                            title="My Fund Requests"
                            subtitle="Status of your bank deposit submissions and admin verification"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddMoney;

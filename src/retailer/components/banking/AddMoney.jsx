import React, { useState } from 'react';
import { Wallet, History } from 'lucide-react';
import ManualWalletRecharge from '../../../components/shared/ManualWalletRecharge';
import FundRequestHistoryView from '../../../components/shared/FundRequestHistoryView';

const AddMoney = ({ mode = 'add-money' }) => {
    const [activeTab, setActiveTab] = useState('recharge');

    return (
        <div className="flex flex-col min-h-full bg-slate-50 font-['Inter',sans-serif]">
            {/* Top Navigation & Subheader - Compact Bar */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-2.5 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center space-x-2.5">
                    <div className="bg-blue-600 p-1.5 rounded-xl text-white shadow-sm">
                        <Wallet size={16} />
                    </div>
                    <h1 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                        Wallet Top-Up
                    </h1>
                </div>

                {/* Tabs */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl">
                    <button
                        onClick={() => setActiveTab('recharge')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'recharge'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Wallet size={13} /> Recharge
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'history'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <History size={13} /> My Requests
                    </button>
                </div>
            </div>

            {/* Tab Body */}
            <div className="flex-1 p-2 sm:p-3 lg:p-4">
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

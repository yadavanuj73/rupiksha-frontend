import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, History } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import ManualWalletRecharge from '../../components/shared/ManualWalletRecharge';
import FundRequestHistoryView from '../../components/shared/FundRequestHistoryView';

const NAVY = '#0f2557';

const AddMoney = ({ defaultTab = 'recharge' }) => {
    const location = useLocation();
    const queryTab = new URLSearchParams(location.search).get('tab');
    const isHistoryRoute = location.pathname.endsWith('/wallet-history');
    const initialTab = queryTab || (isHistoryRoute ? 'history' : defaultTab);
    const [activeTab, setActiveTab] = useState(initialTab);

    useEffect(() => {
        if (queryTab) {
            setActiveTab(queryTab);
        } else if (location.pathname.endsWith('/wallet-history')) {
            setActiveTab('history');
        } else if (location.pathname.endsWith('/add-money')) {
            setActiveTab('recharge');
        }
    }, [location.pathname, queryTab]);

    return (
        <div className="p-2 sm:p-3 max-w-7xl mx-auto space-y-2 pb-1 font-['Inter',sans-serif]">
            {/* Page Header - Height reduced by 70%, compact bar */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-3 bg-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl border border-slate-100 shadow-sm"
            >
                <h1 className="text-sm sm:text-base font-black tracking-tight" style={{ color: NAVY }}>
                    Add Money to Wallet
                </h1>

                {/* Tab Switcher */}
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
            </motion.div>

            {/* Content Area */}
            <div>
                {activeTab === 'recharge' ? (
                    <ManualWalletRecharge
                        portalTitle="Super Distributor Portal"
                        onRechargeSubmitted={() => setActiveTab('history')}
                    />
                ) : (
                    <FundRequestHistoryView
                        title="Super Distributor Fund Request History"
                        subtitle="Track status of your manual bank transfer approvals"
                    />
                )}
            </div>
        </div>
    );
};

export default AddMoney;

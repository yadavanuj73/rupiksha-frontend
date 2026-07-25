import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
    LayoutGrid, Plane, Smartphone, HandCoins, FileText,
    Fingerprint, Calculator, Zap, Lightbulb, Landmark, Headset,
    FileChartColumn, CreditCard, ScanFace, ChevronRight, ChevronDown,
    Handshake, Home, Coins, Shield, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dataService } from '../../services/dataService';

// Standalone MenuItem component to avoid unmounting/remounting (fixes blinking issue)
const MenuItem = ({ item, isActive, onClick, isExpanded, toggleExpand, activeTab, setActiveTab }) => {
    return (
        <div className="px-3">
            <motion.div
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                    if (item.hasSubmenu) {
                        toggleExpand(item.id);
                    } else {
                        onClick();
                    }
                }}
                className="flex items-center justify-between px-3 py-2.5 my-1.5 cursor-pointer group transition-all duration-300 rounded-xl relative"
                style={{ color: isActive ? '#ffffff' : '#334155' }}
            >
                {isActive && (
                    <div className="absolute inset-0 bg-blue-600 border border-blue-600 shadow-sm rounded-xl z-0" />
                )}

                <div className="flex items-center space-x-3 relative z-10 w-full">
                    {item.iconColor ? (
                        <div className={`p-1.5 rounded-lg transition-all duration-300 ${isActive ? 'bg-white/20 text-white ring-2 ring-white/30' : item.iconColor}`}>
                            <item.icon size={16} strokeWidth={2.5} />
                        </div>
                    ) : (
                        <div className="transition-all duration-300" style={{ color: isActive ? '#ffffff' : '#334155' }}>
                            <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                        </div>
                    )}
                    <span className="font-bold text-[13.5px] tracking-tight" style={{ color: isActive ? '#ffffff' : '#334155' }}>
                        {item.label}
                    </span>
                </div>
                <div className="relative z-10">
                    {item.hasSubmenu ? (
                        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                            <ChevronDown size={14} style={{ color: isActive ? '#ffffff' : '#94a3b8' }} />
                        </div>
                    ) : null}
                </div>
            </motion.div>

            {/* Submenu */}
            <AnimatePresence>
                {item.hasSubmenu && isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="ml-9 border-l border-slate-200 overflow-hidden"
                    >
                        {item.subItems.map((sub, idx) => {
                            const isSubActive = activeTab === sub.id;
                            return (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        if (item.id === 'travel') {
                                            setActiveTab('travel');
                                            try { window.dispatchEvent(new CustomEvent('travelSelect', { detail: sub.id })); } catch (e) { }
                                        }
                                        else if (item.id === 'utility') {
                                            setActiveTab('utility');
                                            try { window.dispatchEvent(new CustomEvent('utilitySelect', { detail: sub.id })); } catch (e) { }
                                        }
                                        else {
                                            setActiveTab(sub.id);
                                        }
                                    }}
                                    className="block w-full text-left px-3.5 py-2 text-[11px] font-black uppercase tracking-wider transition-all rounded-lg cursor-pointer hover:bg-slate-100 hover:text-blue-700"
                                    style={{ 
                                        color: isSubActive ? '#1d4ed8' : '#64748b',
                                        backgroundColor: isSubActive ? '#eff6ff' : undefined
                                    }}
                                >
                                    {sub.label}
                                </div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Sidebar = ({ activeTab, setActiveTab, showMobileSidebar }) => {
    const { t } = useLanguage();
    const [expandedItems, setExpandedItems] = useState({ travel: false, reports: false, all_services: true });
    const [appData, setAppData] = useState(dataService.getData());

    useEffect(() => {
        const updateData = () => setAppData(dataService.getData());
        window.addEventListener('dataUpdated', updateData);
        return () => window.removeEventListener('dataUpdated', updateData);
    }, []);

    const toggleExpand = (id) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));

    const serviceItems = [
        {
            id: 'all_services',
            label: 'All Services',
            icon: Smartphone,
            iconColor: 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-200',
            hasSubmenu: true,
            subItems: [
                { id: 'all_services', label: 'All Catalog' },
                { id: 'aeps_services_1', label: 'Fingpay AEPS' },
                { id: 'aeps_services_2', label: 'Levin AEPS' },
                { id: 'matm', label: 'Micro ATM (m-ATM)' },
                { id: 'cms', label: 'CMS Banking' },
                { id: 'utility', label: 'Recharge & Bill Pay' },
                { id: 'travel', label: 'Travel Services' },
                { id: 'payout', label: 'Payout Hub' },
                { id: 'bharat_connect', label: 'Bharat Connect' }
            ]
        }
    ];

    const businessItems = [
        {
            id: 'reports',
            label: 'Transactions History',
            icon: History,
            hasSubmenu: true,
            subItems: [
                // Requested 17 Subcategories
                { id: 'aeps_1', label: 'AEPS 1' },
                { id: 'aeps_2', label: 'AEPS 2' },
                { id: 'money_transfer', label: 'Money Transfer' },
                { id: 'move_to_bank', label: 'Move To Bank' },
                { id: 'airtel_cms', label: 'Airtel CMS' },
                { id: 'fingpay_cms', label: 'Fingpay CMS' },
                { id: 'bbps_bill_pay', label: 'BBPS Bill Pay' },
                { id: 'wallet', label: 'Wallet' },
                { id: 'wallet_to_wallet', label: 'Wallet To Wallet' },
                { id: 'mobile_dth_recharge', label: 'Mobile & Dth Recharge' },
                { id: 'aeps_cash_deposit', label: 'Aeps Cash Deposit' },
                { id: 'micro_atm_transactions', label: 'Micro ATM Transactions' },
                { id: 'aadhaar_pay', label: 'Aadhaar Pay' },
                { id: 'payment_gateway', label: 'Payment Gateway' },
                { id: 'credit_card_bill', label: 'Credit Card Bill' },
                { id: 'upi_cash_withdrawal', label: 'UPI Cash Withdrawal' },
                { id: 'my_earnings_report', label: 'My Earnings Report' }
            ]
        },
        { id: 'gst_einvoice_report', label: 'GST E-Invoice Report', icon: FileChartColumn, onClick: () => setActiveTab('gst_einvoice_report') },
        { id: 'plans', label: 'Commission Plans', icon: CreditCard, onClick: () => setActiveTab('plans') },
    ];

    const ekycItems = [
        { id: 'retailer_ekyc', label: 'Retailer eKYC', icon: ScanFace, type: 'ekyc' },
        { id: 'icici_ekyc', label: 'ICICI eKYC', icon: Fingerprint, type: 'ekyc' },
        { id: 'support', label: 'Help & Support', icon: Headset, type: 'support' },
    ];

    const currentUser = appData.currentUser;
    const getInitials = () => {
        if (currentUser?.businessName) {
            return currentUser.businessName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        }
        return currentUser?.mobile?.slice(-2) || 'RX';
    };

    return (
        <motion.div
            initial={false}
            animate={{
                x: typeof window !== 'undefined' && window.innerWidth < 1024 ? (showMobileSidebar ? 0 : -260) : 0
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`fixed top-0 left-0 w-64 flex-shrink-0 border-r border-slate-200 flex flex-col h-screen font-['Inter',sans-serif] z-50 transition-colors duration-500 lg:top-[76px] lg:h-[calc(100vh-76px)]
                ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            style={{ backgroundColor: '#f8fafc' }}
        >
            {/* Logo Area */}
            <div className="px-5 py-4 flex items-center justify-start h-[76px] border-b border-slate-200 lg:h-[64px] lg:mt-0">
                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black tracking-widest uppercase text-blue-700">Navigation</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2 scrollbar-none">
                {/* Main Navigation List */}
                <div className="flex flex-col px-1">
                    <MenuItem
                        item={{ id: 'dashboard', label: 'Dashboard', icon: LayoutGrid }}
                        isActive={activeTab === 'dashboard'}
                        onClick={() => setActiveTab('dashboard')}
                        isExpanded={expandedItems['dashboard']}
                        toggleExpand={toggleExpand}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                    />
                    
                    {serviceItems.map((item) => (
                        <MenuItem
                            key={item.id}
                            item={item}
                            isActive={activeTab === item.id || (item.subItems && item.subItems.some(sub => sub.id === activeTab))}
                            onClick={() => setActiveTab(item.id)}
                            isExpanded={expandedItems[item.id]}
                            toggleExpand={toggleExpand}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                    ))}

                    {businessItems.map((item) => (
                        <MenuItem
                            key={item.id}
                            item={item}
                            isActive={activeTab === item.id || (item.subItems && item.subItems.some(sub => sub.id === activeTab))}
                            onClick={item.onClick}
                            isExpanded={expandedItems[item.id]}
                            toggleExpand={toggleExpand}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                    ))}

                    {ekycItems.map((item) => (
                        <MenuItem
                            key={item.id}
                            item={item}
                            isActive={activeTab === item.id}
                            onClick={() => setActiveTab(item.id)}
                            isExpanded={expandedItems[item.id]}
                            toggleExpand={toggleExpand}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                    ))}
                </div>
            </div>

            <div className="p-4 border-t border-slate-200">
                <div className="flex items-center justify-between px-2 py-1.5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 overflow-hidden">
                            {currentUser?.profilePhoto ? (
                                <img src={currentUser.profilePhoto} alt="U" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[10px] font-bold text-slate-400">{getInitials()}</span>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800 line-clamp-1">{currentUser?.businessName || 'Merchant'}</span>
                            <span className="text-[10px] text-slate-400 font-medium">Retailer Account</span>
                        </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-300" />
                </div>
            </div>
        </motion.div>
    );
};

export default Sidebar;

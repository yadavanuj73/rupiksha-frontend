import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
    LayoutGrid, Plane, Smartphone, HandCoins, FileText,
    Fingerprint, Calculator, Zap, Lightbulb, Landmark, Headset,
    FileChartColumn, ScanFace, ChevronRight, ChevronDown,
    Handshake, Home, Coins, Shield, History, Lock, Unlock, Pin, PinOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dataService } from '../../services/dataService';

// Standalone MenuItem component with mini/expanded support
const MenuItem = ({ item, isActive, onClick, isExpanded, toggleExpand, activeTab, setActiveTab, isSidebarOpen }) => {
    return (
        <div className="px-1.5">
            <motion.div
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                    if (item.hasSubmenu) {
                        toggleExpand(item.id);
                    } else {
                        onClick();
                    }
                }}
                className={`flex items-center ${isSidebarOpen ? 'justify-between px-2.5' : 'justify-center px-0'} py-2 my-1 cursor-pointer group transition-all duration-200 rounded-xl relative`}
                title={!isSidebarOpen ? item.label : undefined}
                style={{ color: isActive ? '#ffffff' : '#000000' }}
            >
                {isActive && (
                    <div className="absolute inset-0 bg-black border border-black shadow-sm rounded-xl z-0" />
                )}

                <div className={`flex items-center ${isSidebarOpen ? 'space-x-2.5' : 'justify-center'} relative z-10 w-full min-w-0`}>
                    {item.iconColor ? (
                        <div className={`p-1.5 rounded-lg shrink-0 transition-all duration-200 ${isActive ? 'bg-white/20 text-white ring-1 ring-white/30' : item.iconColor}`}>
                            <item.icon size={15} strokeWidth={2.5} />
                        </div>
                    ) : (
                        <div className="shrink-0 transition-all duration-200" style={{ color: isActive ? '#ffffff' : '#000000' }}>
                            <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                        </div>
                    )}
                    
                    {isSidebarOpen && (
                        <span className="font-extrabold text-xs tracking-tight truncate flex-1 text-black" style={{ color: isActive ? '#ffffff' : '#000000' }}>
                            {item.label}
                        </span>
                    )}
                </div>

                {isSidebarOpen && item.hasSubmenu && (
                    <div className="relative z-10 shrink-0 ml-1">
                        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                            <ChevronDown size={13} style={{ color: isActive ? '#ffffff' : '#475569' }} />
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Submenu */}
            <AnimatePresence>
                {isSidebarOpen && item.hasSubmenu && isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="ml-6 pl-2 border-l-2 border-slate-300 overflow-hidden space-y-0.5"
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
                                    className="block w-full text-left px-2 py-1.5 text-[10.5px] font-black uppercase tracking-wider transition-all rounded-lg cursor-pointer hover:bg-slate-200 hover:text-black truncate"
                                    style={{ 
                                        color: isSubActive ? '#000000' : '#334155',
                                        backgroundColor: isSubActive ? '#e2e8f0' : undefined
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

const Sidebar = ({ activeTab, setActiveTab, showMobileSidebar, isLocked = true, setIsLocked, isHovered = false, setIsHovered }) => {
    const { t } = useLanguage();
    const [expandedItems, setExpandedItems] = useState({ travel: false, reports: false, all_services: true });
    const [appData, setAppData] = useState(dataService.getData());

    useEffect(() => {
        const updateData = () => setAppData(dataService.getData());
        window.addEventListener('dataUpdated', updateData);
        return () => window.removeEventListener('dataUpdated', updateData);
    }, []);

    const toggleExpand = (id) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));

    const isExpanded = isLocked || isHovered;

    const toggleLock = (e) => {
        e.stopPropagation();
        const next = !isLocked;
        if (setIsLocked) setIsLocked(next);
        try {
            localStorage.setItem('rupiksha_sidebar_locked', String(next));
        } catch (err) {}
    };

    const serviceItems = [
        {
            id: 'all_services',
            label: 'All Services',
            icon: Smartphone,
            iconColor: 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-sm',
            hasSubmenu: true,
            subItems: [
                { id: 'aeps_services_1', label: 'AEPS 1' },
                { id: 'aeps_services_2', label: 'AEPS 2' },
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
                { id: 'aeps_1', label: 'AEPS 1' },
                { id: 'aeps_2', label: 'AEPS 2' },
                { id: 'payout_hub', label: 'Payout Hub' },
                { id: 'wallet', label: 'Wallet' },
                { id: 'wallet_to_wallet', label: 'Wallet To Wallet' },
                { id: 'mobile_dth_recharge', label: 'Mobile & Dth Recharge' },
                { id: 'micro_atm_transactions', label: 'Micro ATM Transactions' },
                { id: 'payment_gateway', label: 'Payment Gateway' },
                { id: 'credit_card_bill', label: 'Credit Card Bill' },
                { id: 'upi_cash_withdrawal', label: 'UPI Cash Withdrawal' },
                { id: 'commission', label: 'Commission' }
            ]
        },
        { id: 'gst_einvoice_report', label: 'GST E-Invoice Report', icon: FileChartColumn, onClick: () => setActiveTab('gst_einvoice_report') },
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
        <motion.aside
            onMouseEnter={() => setIsHovered && setIsHovered(true)}
            onMouseLeave={() => setIsHovered && setIsHovered(false)}
            initial={false}
            animate={{
                width: typeof window !== 'undefined' && window.innerWidth >= 1024 
                    ? (isExpanded ? 208 : 56) 
                    : 208,
                x: typeof window !== 'undefined' && window.innerWidth < 1024 
                    ? (showMobileSidebar ? 0 : -220) 
                    : 0
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className={`fixed top-0 left-0 flex-shrink-0 border-r border-slate-300 flex flex-col h-screen font-['Inter',sans-serif] z-50 transition-colors duration-300 lg:top-[76px] lg:h-[calc(100vh-76px)] bg-slate-50 shadow-md ${
                !isLocked && isHovered ? 'shadow-2xl ring-1 ring-black/5 z-50' : ''
            }`}
        >
            {/* Header / Lock Area */}
            <div className="px-3 py-2 flex items-center justify-between h-[52px] border-b border-slate-200">
                {isExpanded ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center justify-between w-full"
                    >
                        <span className="text-[10px] font-black tracking-widest uppercase text-black">Navigation</span>
                        <button
                            type="button"
                            onClick={toggleLock}
                            className={`p-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                isLocked 
                                    ? 'bg-black text-white hover:bg-slate-800' 
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                            title={isLocked ? "Sidebar locked open. Click to enable auto-slide." : "Sidebar slideable. Click to lock open."}
                        >
                            {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                        </button>
                    </motion.div>
                ) : (
                    <div className="w-full flex justify-center">
                        <button
                            type="button"
                            onClick={toggleLock}
                            className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                            title="Click to lock sidebar open"
                        >
                            <Unlock size={13} />
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation List */}
            <div className="flex-1 overflow-y-auto py-1 scrollbar-none">
                <div className="flex flex-col">
                    <MenuItem
                        item={{ id: 'dashboard', label: 'Dashboard', icon: LayoutGrid }}
                        isActive={activeTab === 'dashboard'}
                        onClick={() => setActiveTab('dashboard')}
                        isExpanded={expandedItems['dashboard']}
                        toggleExpand={toggleExpand}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        isSidebarOpen={isExpanded}
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
                            isSidebarOpen={isExpanded}
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
                            isSidebarOpen={isExpanded}
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
                            isSidebarOpen={isExpanded}
                        />
                    ))}
                </div>
            </div>

            {/* Footer Merchant Profile */}
            <div className="p-2 border-t border-slate-200">
                <div className={`flex items-center ${isExpanded ? 'justify-between' : 'justify-center'} px-1 py-1`}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-slate-300 overflow-hidden shrink-0 shadow-xs">
                            {currentUser?.profilePhoto ? (
                                <img src={currentUser.profilePhoto} alt="U" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[10px] font-black text-black">{getInitials()}</span>
                            )}
                        </div>
                        {isExpanded && (
                            <div className="flex flex-col min-w-0">
                                <span className="text-xs font-black text-black truncate">{currentUser?.businessName || 'Merchant'}</span>
                                <span className="text-[9.5px] text-slate-500 font-bold">Retailer</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.aside>
    );
};

export default Sidebar;

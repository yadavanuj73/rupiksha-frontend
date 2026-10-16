import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
    LayoutGrid, Plane, Smartphone, HandCoins, FileText,
    Calculator, Zap, Lightbulb, Landmark, Headset,
    FileChartColumn, ChevronRight, ChevronDown,
    Handshake, Home, Coins, Shield, History, Lock, Unlock, Pin, PinOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dataService } from '../../services/dataService';
import mainLogo from '../../assets/logo rupiksha transprent.png';

// Standalone MenuItem component with mini/expanded support
const MenuItem = ({ item, isActive, onClick, isExpanded, toggleExpand, activeTab, setActiveTab, isSidebarOpen }) => {
    return (
        <div className={isSidebarOpen ? "px-2" : "flex justify-center my-1"}>
            <motion.div
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                    if (item.hasSubmenu) {
                        toggleExpand(item.id);
                    } else {
                        onClick();
                    }
                }}
                className={`flex items-center cursor-pointer group transition-all duration-200 relative ${
                    isSidebarOpen
                        ? `justify-between px-3 py-2.5 my-0.5 rounded-xl border ${
                            isActive
                                ? 'bg-[#EAF1FF] text-[#2463EB] border-[#B8CEFF] font-extrabold shadow-xs'
                                : 'border-transparent text-[#344054] hover:bg-[#F5F8FD] hover:text-[#101828]'
                        }`
                        : `w-[46px] h-[46px] rounded-[13px] justify-center ${
                            isActive
                                ? 'bg-[#EAF1FF] text-[#2463EB] shadow-xs ring-1 ring-[#B8CEFF]'
                                : 'text-[#344054] hover:bg-[#F5F8FD] hover:text-[#101828]'
                        }`
                }`}
                title={!isSidebarOpen ? item.label : undefined}
            >
                <div className={`flex items-center ${isSidebarOpen ? 'space-x-2.5' : 'justify-center'} relative z-10 w-full min-w-0`}>
                    <div className={`shrink-0 transition-transform duration-200 group-hover:scale-105 ${isActive ? 'text-[#2463EB]' : 'text-[#344054]'}`}>
                        <item.icon size={21} strokeWidth={isActive ? 2.3 : 1.9} />
                    </div>
                    
                    {isSidebarOpen && (
                        <span className={`font-bold text-[13px] tracking-tight truncate flex-1 ${isActive ? 'text-[#2463EB]' : 'text-[#344054]'}`}>
                            {item.label}
                        </span>
                    )}
                </div>

                {isSidebarOpen && item.hasSubmenu && (
                    <div className="relative z-10 shrink-0 ml-1">
                        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                            <ChevronDown size={14} className={isActive ? 'text-white' : 'text-slate-700 group-hover:text-indigo-600'} />
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
                        className="ml-5 pl-2.5 border-l-2 border-indigo-100/90 overflow-hidden space-y-1 my-1"
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
                                    className={`block w-full text-left px-2.5 py-1.5 text-[12px] font-bold transition-all duration-200 rounded-lg cursor-pointer truncate ${
                                        isSubActive
                                            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-black shadow-xs'
                                            : 'text-slate-900 hover:bg-gradient-to-r hover:from-blue-50 hover:via-indigo-50/90 hover:to-purple-50 hover:text-blue-700 hover:font-black hover:translate-x-1 hover:shadow-2xs'
                                    }`}
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
        window.addEventListener('distributorDataUpdated', updateData);
        window.addEventListener('profileUpdated', updateData);
        return () => {
            window.removeEventListener('dataUpdated', updateData);
            window.removeEventListener('distributorDataUpdated', updateData);
            window.removeEventListener('profileUpdated', updateData);
        };
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
                { id: 'aeps_services_1', label: 'Aeps 1' },
                { id: 'aeps_services_2', label: 'Aeps 2' },
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
                { id: 'bbps', label: 'BBPS' },
                { id: 'aeps_1', label: 'Aeps 1' },
                { id: 'aeps_2', label: 'Aeps 2' },
                { id: 'payout_hub', label: 'Payout Hub' },
                { id: 'wallet', label: 'Wallet' },
                { id: 'wallet_to_wallet', label: 'Wallet to Wallet' },
                { id: 'mobile_dth_recharge', label: 'Mobile & DTH Recharge' },
                { id: 'micro_atm_transactions', label: 'Micro ATM Transactions' },
                { id: 'payment_gateway', label: 'Payment Gateway' },
                { id: 'credit_card_bill', label: 'Credit Card Bill' },
                { id: 'upi_cash_withdrawal', label: 'UPI Cash Withdrawal' }
            ]
        },
        { id: 'commission', label: 'Commission Plan', icon: Coins, onClick: () => setActiveTab('commission') },
        { id: 'gst_einvoice_report', label: 'GST E-Invoice Report', icon: FileChartColumn, onClick: () => setActiveTab('gst_einvoice_report') },
    ];

    const supportItems = [
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
                    ? (isExpanded ? 218 : 70) 
                    : 218,
                x: typeof window !== 'undefined' && window.innerWidth < 1024 
                    ? (showMobileSidebar ? 0 : -230) 
                    : 0
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className={`fixed top-0 left-0 flex-shrink-0 border-r border-[#E5ECF6] flex flex-col h-screen font-['Inter',sans-serif] z-50 transition-colors duration-300 lg:top-[76px] lg:h-[calc(100vh-76px)] bg-white shadow-xs ${
                !isLocked && isHovered ? 'shadow-2xl ring-1 ring-black/5 z-50' : ''
            }`}
        >
            {/* Header / Lock Area */}
            <div className={`shrink-0 border-b border-[#E5ECF6] transition-all duration-300 ${
                isExpanded ? 'px-3 py-3' : 'px-2 py-2.5'
            }`}>
                {isExpanded ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-start justify-between w-full gap-2"
                    >
                        <div className="flex-1 flex justify-center items-center py-1">
                            <img
                                src={mainLogo}
                                alt="Rupiksha"
                                className="h-16 w-auto object-contain max-w-[135px]"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={toggleLock}
                            className={`p-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 shrink-0 ${
                                isLocked 
                                    ? 'bg-slate-900 text-white hover:bg-slate-800' 
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                            title={isLocked ? "Sidebar locked open. Click to enable auto-slide." : "Sidebar slideable. Click to lock open."}
                        >
                            {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
                        </button>
                    </motion.div>
                ) : (
                    <div className="w-full flex flex-col items-center gap-2">
                        <img
                            src={mainLogo}
                            alt="R"
                            className="w-[42px] h-[42px] object-contain rounded-xl p-0.5"
                        />
                        <button
                            type="button"
                            onClick={toggleLock}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                            title="Click to lock sidebar open"
                        >
                            <Unlock size={13} />
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation List */}
            <div className="flex-1 overflow-y-auto py-1.5 scrollbar-none">
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

                    <MenuItem
                        item={{ id: 'wallet_transfer', label: 'Wallet to Wallet', icon: Coins }}
                        isActive={activeTab === 'wallet_transfer'}
                        onClick={() => setActiveTab('wallet_transfer')}
                        isExpanded={false}
                        toggleExpand={toggleExpand}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        isSidebarOpen={isExpanded}
                    />

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

                    {supportItems.map((item) => (
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
            <div className="p-2 border-t border-[#E5ECF6]">
                <div className={`flex items-center ${isExpanded ? 'justify-between' : 'justify-center'} px-1 py-1`}>
                    <div className="flex items-center gap-2">
                        <div className="w-[36px] h-[36px] rounded-full bg-white flex items-center justify-center border border-[#DFE8F5] overflow-hidden shrink-0 shadow-xs">
                            {(() => {
                                const sideUid = currentUser?.id || currentUser?.userId || currentUser?.username;
                                const sidePhoto = currentUser?.profilePhoto || currentUser?.photoUrl || (sideUid ? localStorage.getItem(`rupiksha_photo_${sideUid}`) : null);
                                return sidePhoto ? (
                                    <img src={sidePhoto} alt="U" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-[10px] font-black text-black">{getInitials()}</span>
                                );
                            })()}
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

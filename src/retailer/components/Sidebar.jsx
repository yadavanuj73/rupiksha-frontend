import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
    LayoutGrid, Plane, Smartphone, HandCoins, FileText,
    Fingerprint, Calculator, Zap, Lightbulb, Landmark, Headset,
    FileChartColumn, CreditCard, ScanFace, ChevronRight, ChevronDown,
    Handshake, Home, Coins, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dataService } from '../../services/dataService';
const Sidebar = ({ activeTab, setActiveTab, showMobileSidebar }) => {
    const { t } = useLanguage();
    const [expandedItems, setExpandedItems] = useState({ travel: false, reports: false });
    const [appData, setAppData] = useState(dataService.getData());

    useEffect(() => {
        const updateData = () => setAppData(dataService.getData());
        window.addEventListener('dataUpdated', updateData);
        return () => window.removeEventListener('dataUpdated', updateData);
    }, []);

    const toggleExpand = (id) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));

    // Professional, clean colors.

    const serviceItems = [
        { id: 'travel', label: 'Travel Hub', icon: Plane },
        { id: 'utility', label: 'Utility Hub', icon: Zap },
        { id: 'payout', label: 'Payout Hub', icon: HandCoins },
        {
            id: 'loans',
            label: 'Loan Hub',
            icon: Handshake,
            hasSubmenu: true,
            subItems: [
                { id: 'personal_loan', label: 'Personal Loan' },
                { id: 'home_loan', label: 'Home Loan' },
                { id: 'gold_loan', label: 'Gold Loan' },
                { id: 'instant_loan', label: 'Instant Loan' },
                { id: 'loan_status', label: 'Track Application' },
            ]
        },
    ];

    const businessItems = [
        {
            id: 'reports',
            label: 'Reports & Ledger',
            icon: FileChartColumn,
            hasSubmenu: true,
            subItems: [
                { id: 'sale_report', label: 'Sale Report' },
                { id: 'consolidated_ledger', label: 'Consolidated-ledger' },
                { id: 'daily_ledger', label: 'Daily ledger' },
                { id: 'gstin_invoice', label: 'GSTIN Invoice' },
                { id: 'cons_gstin_invoice', label: 'Consolidated GSTIN Invoice' },
                { id: 'cons_comm_receipt', label: 'Consolidated Commission Receipt' },
                { id: 'tds_report', label: 'TDS' },
                { id: 'payment_req_history', label: 'Payment Request History' },
                { id: 'emi_reports', label: 'EMI Reports' },
                { id: 'qr_txn_report', label: 'QR Transactions Report' },
            ]
        },
        { id: 'gst_einvoice_report', label: 'GST E-Invoice Report', icon: FileChartColumn, onClick: () => setActiveTab('gst_einvoice_report') },
        { id: 'plans', label: 'Commission Plans', icon: CreditCard, onClick: () => setActiveTab('plans') },
        { id: 'gst_certification', label: 'GST Certification', icon: Shield, onClick: () => setActiveTab('gst_certification') },
        { id: 'tds_certificate', label: 'TDS Certificate', icon: FileText, onClick: () => setActiveTab('tds_certificate') },
    ];

    const ekycItems = [
        { id: 'retailer_ekyc', label: 'Retailer eKYC', icon: ScanFace, type: 'ekyc' },
        { id: 'icici_ekyc', label: 'ICICI eKYC', icon: Fingerprint, type: 'ekyc' },
        { id: 'support', label: 'Help & Support', icon: Headset, type: 'support' },
    ];

    const MenuItem = ({ item, isActive, onClick }) => {
        const isExpanded = expandedItems[item.id];

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
                        <motion.div
                            layoutId="active-pill"
                            className="absolute inset-0 bg-blue-600 border border-blue-600 shadow-lg rounded-xl z-0"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                    )}

                    <div className="flex items-center space-x-3 relative z-10 w-full">
                        <div className={`transition-all duration-300 ${isActive ? 'scale-110' : ''}`} style={{ color: isActive ? '#ffffff' : '#334155' }}>
                            <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                        </div>
                        <span className="font-bold text-[13.5px] tracking-tight" style={{ color: isActive ? '#ffffff' : '#334155' }}>
                            {item.label}
                        </span>
                    </div>
                    <div className="relative z-10">
                        {item.hasSubmenu ? (
                            <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                                <ChevronDown size={14} style={{ color: isActive ? '#ffffff' : '#94a3b8' }} />
                            </div>
                        ) : isActive && !item.hasSubmenu && (
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.4)]"
                            />
                        )}
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
                                        className="block px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all rounded-lg"
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
                {/* Main section */}
                {/* Main Navigation List */}
                <div className="flex flex-col px-1">
                    <MenuItem
                        item={{ id: 'dashboard', label: 'Dashboard', icon: LayoutGrid }}
                        isActive={activeTab === 'dashboard'}
                        onClick={() => setActiveTab('dashboard')}
                    />
                    <MenuItem
                        item={{ id: 'all_services', label: 'All Services', icon: Smartphone }}
                        isActive={activeTab === 'all_services'}
                        onClick={() => setActiveTab('all_services')}
                    />
                    
                    {serviceItems.map((item) => (
                        <MenuItem
                            key={item.id}
                            item={item}
                            isActive={activeTab === item.id || (item.subItems && item.subItems.some(sub => sub.id === activeTab))}
                            onClick={() => setActiveTab(item.id)}
                        />
                    ))}

                    {businessItems.map((item) => (
                        <MenuItem
                            key={item.id}
                            item={item}
                            isActive={activeTab === item.id || (item.subItems && item.subItems.some(sub => sub.id === activeTab))}
                            onClick={item.onClick}
                        />
                    ))}

                    {ekycItems.map((item) => (
                        <MenuItem
                            key={item.id}
                            item={item}
                            isActive={activeTab === item.id}
                            onClick={() => setActiveTab(item.id)}
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

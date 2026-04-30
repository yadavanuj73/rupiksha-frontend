import React, { useState, useEffect } from 'react';
import { Wallet, Bell, ChevronDown, Menu, User, CreditCard, Settings, MoreVertical, Plus, BadgeCheck, Clock3, OctagonAlert } from 'lucide-react';
import { dataService } from '../../services/dataService';
import mainLogo from '../../assets/rupiksha_logo.png';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Header = ({ onAddMoney, onProfileClick, onMenuClick }) => {
    const navigate = useNavigate();
    const [appData, setAppData] = useState(dataService.getData());
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [balance, setBalance] = useState("0.00");

    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        const updateData = () => {
            const data = dataService.getData();
            setAppData(data);

            const systemNotifs = [];
            if (data.currentUser?.aeps_kyc_status !== 'DONE') {
                systemNotifs.push({
                    id: 'kyc_alert',
                    title: 'Verify Your Account',
                    message: 'Complete AEPS KYC to unlock full service access.',
                    type: 'alert',
                    read: false,
                    path: '/aeps-kyc'
                });
            }
            setNotifications(systemNotifs);

            // Fetch live balance
            if (data.currentUser) {
                dataService.getWalletBalance(data.currentUser.id).then(bal => setBalance(bal));
            }
        };
        updateData();
        window.addEventListener('dataUpdated', updateData);
        return () => window.removeEventListener('dataUpdated', updateData);
    }, []);

    const currentUser = appData.currentUser;
    const getInitials = () => {
        if (currentUser?.name) return currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        return 'RX';
    };

    const retailerName = currentUser?.name || currentUser?.businessName || 'Retailer';
    const rawKyc = String(currentUser?.kycStatus || currentUser?.profile_kyc_status || '').toUpperCase();
    const kycChip = rawKyc === 'APPROVED' || rawKyc === 'DONE'
        ? { label: 'Approved', className: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: BadgeCheck }
        : rawKyc === 'REJECTED'
            ? { label: 'Rejected', className: 'bg-rose-50 border-rose-200 text-rose-700', icon: OctagonAlert }
            : { label: 'Pending', className: 'bg-amber-50 border-amber-200 text-amber-700', icon: Clock3 };
    const KycIcon = kycChip.icon;

    return (
        <header className="fixed top-0 left-0 right-0 h-[76px] bg-white border-b border-slate-200 shadow-sm z-[60] font-['Inter',sans-serif]">
            <div className="h-full flex items-center justify-between px-3 md:px-5 gap-3">
                <div className="flex items-center gap-3 min-w-[170px]">
                    <button
                        onClick={onMenuClick}
                        className="p-2 hover:bg-slate-100 rounded-xl lg:hidden text-slate-600 transition-colors border border-slate-200"
                    >
                        <Menu size={19} />
                    </button>
                    <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                            <img src={mainLogo} alt="RUPIKSHA" className="h-8 w-8 object-contain" />
                        </div>
                        <p className="hidden sm:block text-[12px] font-black text-blue-700 tracking-wide">RUPIKSHA</p>
                    </button>
                </div>

                <div className="hidden md:flex flex-1 justify-center px-4">
                    <div className="w-full max-w-[560px] bg-blue-50 border border-blue-100 rounded-2xl px-5 py-2.5 text-center">
                        <p className="text-[13px] font-black text-slate-700 truncate">
                            Welcome <span className="text-blue-700">{retailerName}</span> to Rupiksha Retailer Family
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`hidden sm:flex items-center gap-1.5 border rounded-full px-2.5 py-1 ${kycChip.className}`}>
                        <KycIcon size={12} />
                        <span className="text-[9px] font-black uppercase tracking-[0.15em]">KYC {kycChip.label}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <Wallet size={13} className="text-amber-500" />
                        <div className="text-right hidden sm:block">
                            <p className="text-[9px] font-black text-slate-500 uppercase leading-none">Main</p>
                            <p className="text-[11px] font-black text-amber-600 mt-0.5">₹ {balance}</p>
                        </div>
                        <button onClick={onAddMoney} className="bg-amber-500 hover:bg-amber-400 text-white rounded-lg p-1.5 transition-all shadow-sm shadow-amber-500/30">
                            <Plus size={13} />
                        </button>
                    </div>

                    <div className="relative">
                        <button
                            className="relative cursor-pointer p-2 rounded-full border border-slate-200 hover:bg-slate-100 transition-colors"
                            onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
                        >
                            <Bell size={18} className="text-slate-500" />
                            {unreadCount > 0 && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                    <span className="text-[9px] font-black text-white">{unreadCount}</span>
                                </div>
                            )}
                        </button>
                        <AnimatePresence>
                            {showNotifications && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 15, scale: 0.95 }}
                                        className="absolute right-0 mt-3 w-72 bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-200 z-50 overflow-hidden"
                                    >
                                        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Notifications</h3>
                                        </div>
                                        <div className="max-h-80 overflow-y-auto w-full">
                                            {notifications.length > 0 ? notifications.map((notif, idx) => (
                                                <div key={idx} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { if (notif.path) navigate(notif.path); setShowNotifications(false); }}>
                                                    <p className="text-xs font-bold text-slate-800 mb-1">{notif.title}</p>
                                                    <p className="text-[10px] text-slate-500">{notif.message}</p>
                                                </div>
                                            )) : (
                                                <div className="flex flex-col items-center justify-center py-10">
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">No Notifications Yet</p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="relative">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 pl-1.5 pr-4 py-1.5 rounded-full transition-all hover:bg-slate-100 shadow-sm"
                        >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 p-0.5">
                                <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                                    <span className="text-[10px] font-black text-slate-800 uppercase">{getInitials()}</span>
                                </div>
                            </div>
                            <div className="hidden md:block text-left">
                                <span className="text-sm font-black text-slate-800 tracking-tight block">{retailerName.split(' ')[0]}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Retailer</span>
                            </div>
                            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${showProfileMenu ? 'rotate-180 text-blue-600' : ''}`} />
                        </motion.button>

                        <AnimatePresence>
                            {showProfileMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 15, scale: 0.95 }}
                                        className="absolute right-0 mt-3 w-64 bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-200 z-50 overflow-hidden"
                                    >
                                        <div className="p-2">
                                            <div className="px-5 py-5 bg-slate-50 rounded-t-[20px] mb-2 border-b border-slate-100">
                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Session Active</p>
                                                <p className="text-sm font-black text-slate-800 truncate">{retailerName}</p>
                                                <p className="text-[11px] font-bold text-slate-400 mt-0.5">{currentUser?.username}</p>
                                            </div>
                                            <div className="space-y-0.5 px-1">
                                                {[
                                                    { id: 'profile', icon: <User size={16} />, label: 'My Profile', color: 'text-blue-600 bg-blue-50' },
                                                    { id: 'visiting_card', icon: <CreditCard size={16} />, label: 'Visiting Card', color: 'text-indigo-600 bg-indigo-50' },
                                                    { id: 'settings', icon: <Settings size={16} />, label: 'Settings', color: 'text-slate-600 bg-slate-50' },
                                                    { id: 'logout', icon: <MoreVertical size={16} />, label: 'Sign Out', color: 'text-rose-600 bg-rose-50' },
                                                ].map((item) => (
                                                    <button key={item.id} onClick={() => { onProfileClick(item.id); setShowProfileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors group ${item.id === 'logout' ? 'mt-4 border-t border-slate-100 pt-4' : ''}`}>
                                                        <div className={`p-2 rounded-lg ${item.color} group-hover:scale-110 transition-transform`}>{item.icon}</div>
                                                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">{item.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;

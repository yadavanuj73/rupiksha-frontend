import React, { useState, useEffect } from 'react';
import { Bell, ChevronDown, Menu, User, CreditCard, Settings, MoreVertical, BadgeCheck, Clock3, OctagonAlert } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Header = ({ onAddMoney, onProfileClick, onMenuClick }) => {
    const navigate = useNavigate();
    const { user: authUser } = useAuth();
    const [appData, setAppData] = useState(dataService.getData());
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [imgError, setImgError] = useState(false);

    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        const updateData = () => {
            const data = dataService.getData();
            setAppData(data);
            setImgError(false);

            const systemNotifs = [];
            // Non-BBPS / AEPS alerts temporarily hidden in BBPS-only mode
            setNotifications(systemNotifs);
        };
        updateData();
        const user = dataService.getCurrentUser();
        if (user && (user.id || user.username)) {
            dataService.fetchUserProfile().catch(() => {});
        }
        window.addEventListener('dataUpdated', updateData);
        window.addEventListener('distributorDataUpdated', updateData);
        window.addEventListener('profileUpdated', updateData);
        return () => {
            window.removeEventListener('dataUpdated', updateData);
            window.removeEventListener('distributorDataUpdated', updateData);
            window.removeEventListener('profileUpdated', updateData);
        };
    }, []);

    const currentUser = authUser || appData.currentUser || dataService.getCurrentUser();
    const userUid = currentUser?.id || currentUser?.userId || currentUser?.username;
    const userPhoto = currentUser?.profilePhoto || currentUser?.photoUrl || (userUid ? localStorage.getItem(`rupiksha_photo_${userUid}`) : null);
    const retailerName = currentUser?.fullName || currentUser?.name || currentUser?.businessName || currentUser?.username || 'User';

    const getInitials = () => {
        const displayName = currentUser?.fullName || currentUser?.name || currentUser?.username || 'Anujkumar Yadav';
        return displayName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };
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
                    <button onClick={() => navigate('/dashboard')} className="flex items-center">
                        <p className="text-[15px] font-black text-blue-700 tracking-wider">RUPIKSHA</p>
                    </button>
                </div>

                <div className="hidden md:flex flex-1 justify-center px-4">
                    <div className="w-full max-w-[560px] bg-blue-50 border border-blue-100 rounded-2xl px-5 py-2.5 text-center">
                        <p className="text-[13px] font-black text-slate-700 truncate">
                            Welcome <span className="text-blue-700">{retailerName}</span> to Rupiksha Family
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`hidden sm:flex items-center gap-1.5 border rounded-full px-2.5 py-1 ${kycChip.className}`}>
                        <KycIcon size={12} />
                        <span className="text-[9px] font-black uppercase tracking-[0.15em]">KYC {kycChip.label}</span>
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
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 p-0.5 shadow-sm">
                                <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                                    {userPhoto && !imgError ? (
                                        <img
                                            src={userPhoto}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                            onError={() => setImgError(true)}
                                        />
                                    ) : (
                                        <span className="text-[10px] font-black text-slate-800 uppercase">{getInitials()}</span>
                                    )}
                                </div>
                            </div>
                            <div className="hidden md:block text-left">
                                <span className="text-sm font-black text-slate-800 tracking-tight block">{retailerName.split(' ')[0]}</span>
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
                                            {/* User details and profile cards temporarily hidden */}
                                            {false && (
                                            <div className="px-5 py-5 bg-slate-50 rounded-t-[20px] mb-2 border-b border-slate-100 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 p-0.5 shadow-sm shrink-0">
                                                    <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                                                        {userPhoto && !imgError ? (
                                                            <img src={userPhoto} alt="Profile" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[11px] font-black text-blue-700 uppercase">{getInitials()}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Session Active</p>
                                                    <p className="text-sm font-black text-slate-800 truncate">{retailerName}</p>
                                                    <p className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">{currentUser?.username}</p>
                                                </div>
                                            </div>
                                            )}
                                            <div className="space-y-0.5 px-1">
                                                {[
                                                    { id: 'profile', icon: <User size={16} />, label: 'My Profile', color: 'text-blue-600 bg-blue-50' },
                                                    { id: 'visiting_card', icon: <CreditCard size={16} />, label: 'Visiting Card', color: 'text-indigo-600 bg-indigo-50' },
                                                    { id: 'settings', icon: <Settings size={16} />, label: 'Settings', color: 'text-slate-600 bg-slate-50' },
                                                    { id: 'logout', icon: <MoreVertical size={16} />, label: 'Sign Out', color: 'text-rose-600 bg-rose-50' },
                                                ].filter(item => !['profile', 'visiting_card', 'settings'].includes(item.id)).map((item) => (
                                                    <button key={item.id} onClick={() => { onProfileClick(item.id); setShowProfileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors group">
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

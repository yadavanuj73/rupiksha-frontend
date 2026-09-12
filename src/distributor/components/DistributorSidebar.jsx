import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { menuItems } from '../data/menuItems';
import {
    ChevronDown, ChevronRight, Phone, Smartphone, LayoutGrid, Users, Lock, Unlock,
    History, Coins, FileChartColumn, Headset
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sharedDataService } from '../../services/sharedDataService';
import { dataService } from '../../services/dataService';

const logo = '/rupiksha logo.jpeg';

const DistributorSidebar = ({
    showMobile,
    onClose,
    isSidebarLocked,
    toggleSidebarLock,
    isSidebarHovered,
    setIsSidebarHovered,
    isExpanded
}) => {
    const [openMenus, setOpenMenus] = useState({});
    const [dist, setDist] = useState(null);
    const location = useLocation();

    useEffect(() => {
        const loadUser = () => {
            const currentDist = sharedDataService.getCurrentDistributor() || dataService.getCurrentUser();
            setDist(currentDist);
        };
        loadUser();
        window.addEventListener('distributorDataUpdated', loadUser);
        return () => window.removeEventListener('distributorDataUpdated', loadUser);
    }, []);

    const toggleMenu = (title) => setOpenMenus((prev) => ({ ...prev, [title]: !prev[title] }));

    const isPathActive = (path, item) => {
        if (location.pathname === path) return true;
        if (path !== '/distributor' && location.pathname.startsWith(path)) return true;
        if (item?.submenu && item.submenu.some(sub => location.pathname === sub.path || location.pathname.startsWith(sub.path))) return true;
        return false;
    };

    const getInitials = () => {
        if (dist?.name) {
            return dist.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        }
        return dist?.mobile?.slice(-2) || 'DS';
    };

    return (
        <>
            {/* Mobile backdrop */}
            <AnimatePresence>
                {showMobile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Collapsible & Lockable Sidebar — Exact Retailer Panel Styling */}
            <motion.aside
                onMouseEnter={() => setIsSidebarHovered && setIsSidebarHovered(true)}
                onMouseLeave={() => setIsSidebarHovered && setIsSidebarHovered(false)}
                initial={false}
                animate={{
                    width: typeof window !== 'undefined' && window.innerWidth >= 1024
                        ? (isExpanded ? 220 : 58)
                        : 220,
                    x: typeof window !== 'undefined' && window.innerWidth < 1024
                        ? (showMobile ? 0 : -230)
                        : 0
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                className={`fixed top-0 left-0 flex-shrink-0 border-r border-slate-300 flex flex-col h-screen font-['Inter',sans-serif] z-50 transition-colors duration-300 lg:top-16 lg:h-[calc(100vh-64px)] bg-slate-50 shadow-md ${
                    !isSidebarLocked && isSidebarHovered ? 'shadow-2xl ring-1 ring-black/5 z-50' : ''
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
                            <span className="text-xs font-black tracking-wider text-slate-950">Navigation</span>
                            <button
                                type="button"
                                onClick={toggleSidebarLock}
                                className={`p-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                    isSidebarLocked
                                        ? 'bg-black text-white hover:bg-slate-800'
                                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                                title={isSidebarLocked ? "Sidebar locked open. Click to enable auto-slide." : "Sidebar slideable. Click to lock open."}
                            >
                                {isSidebarLocked ? <Lock size={12} /> : <Unlock size={12} />}
                            </button>
                        </motion.div>
                    ) : (
                        <div className="w-full flex justify-center">
                            <button
                                type="button"
                                onClick={toggleSidebarLock}
                                className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                                title="Click to lock sidebar open"
                            >
                                <Unlock size={13} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Navigation Links List */}
                <div className="flex-1 overflow-y-auto py-1.5 scrollbar-none px-1.5 space-y-0.5">
                    {/* Dashboard Item */}
                    <NavLink
                        to="/distributor"
                        end
                        onClick={onClose}
                        title={!isExpanded ? "Dashboard" : undefined}
                        className={({ isActive }) =>
                            `flex items-center ${isExpanded ? 'justify-between px-2.5' : 'justify-center px-0'} py-2 my-1 cursor-pointer group transition-all duration-200 rounded-xl relative border ${
                                isActive
                                    ? 'bg-slate-950 text-white border-slate-900 shadow-sm'
                                    : 'border-transparent text-slate-950 hover:bg-gradient-to-r hover:from-blue-50/90 hover:via-indigo-50/80 hover:to-purple-50/80 hover:text-indigo-950 hover:border-indigo-100/80 hover:shadow-xs'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <div className={`flex items-center ${isExpanded ? 'space-x-2.5' : 'justify-center'} relative z-10 w-full min-w-0`}>
                                <div className={`shrink-0 transition-all duration-200 ${isActive ? 'text-white' : 'text-slate-950 group-hover:text-blue-600'} group-hover:scale-105`}>
                                    <LayoutGrid size={18} strokeWidth={isActive ? 2.5 : 2.2} />
                                </div>
                                {isExpanded && (
                                    <span className={`font-black text-[13px] tracking-tight truncate flex-1 ${isActive ? 'text-white' : 'text-slate-950 group-hover:text-indigo-950'}`}>
                                        Dashboard
                                    </span>
                                )}
                            </div>
                        )}
                    </NavLink>

                    {/* Dynamic menu items */}
                    {menuItems.map((item) => {
                        const isActive = isPathActive(item.path, item);
                        const isOpen = openMenus[item.title];

                        return (
                            <div key={item.title}>
                                {item.submenu ? (
                                    <div>
                                        <div
                                            onClick={() => {
                                                if (!isExpanded && setIsSidebarHovered) setIsSidebarHovered(true);
                                                toggleMenu(item.title);
                                            }}
                                            title={!isExpanded ? item.title : undefined}
                                            className={`flex items-center ${isExpanded ? 'justify-between px-2.5' : 'justify-center px-0'} py-2 my-1 cursor-pointer group transition-all duration-200 rounded-xl relative border ${
                                                isActive
                                                    ? 'bg-slate-950 text-white border-slate-900 shadow-sm'
                                                    : 'border-transparent text-slate-950 hover:bg-gradient-to-r hover:from-blue-50/90 hover:via-indigo-50/80 hover:to-purple-50/80 hover:text-indigo-950 hover:border-indigo-100/80 hover:shadow-xs'
                                            }`}
                                        >
                                            <div className={`flex items-center ${isExpanded ? 'space-x-2.5' : 'justify-center'} relative z-10 w-full min-w-0`}>
                                                <div className={`shrink-0 transition-all duration-200 ${isActive ? 'text-white' : 'text-slate-950 group-hover:text-blue-600'} group-hover:scale-105`}>
                                                    <item.icon size={18} strokeWidth={isActive ? 2.5 : 2.2} />
                                                </div>
                                                {isExpanded && (
                                                    <span className={`font-black text-[13px] tracking-tight truncate flex-1 ${isActive ? 'text-white' : 'text-slate-950 group-hover:text-indigo-950'}`}>
                                                        {item.title}
                                                    </span>
                                                )}
                                            </div>

                                            {isExpanded && (
                                                <div className="relative z-10 shrink-0 ml-1">
                                                    <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                                                        <ChevronDown size={14} className={isActive ? 'text-white' : 'text-slate-700 group-hover:text-indigo-600'} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Submenu */}
                                        <AnimatePresence>
                                            {isOpen && isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                    className="ml-5 pl-2.5 border-l-2 border-indigo-100/90 overflow-hidden space-y-1 my-1"
                                                >
                                                    {item.submenu.map((sub) => {
                                                        const isSubActive = location.pathname === sub.path;
                                                        return (
                                                            <NavLink
                                                                key={sub.path}
                                                                to={sub.path}
                                                                onClick={onClose}
                                                                className={`block w-full text-left px-2.5 py-1.5 text-[12px] font-bold transition-all duration-200 rounded-lg cursor-pointer truncate ${
                                                                    isSubActive
                                                                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-black shadow-xs'
                                                                        : 'text-slate-900 hover:bg-gradient-to-r hover:from-blue-50 hover:via-indigo-50/90 hover:to-purple-50 hover:text-blue-700 hover:font-black hover:translate-x-1 hover:shadow-2xs'
                                                                }`}
                                                            >
                                                                {sub.title}
                                                            </NavLink>
                                                        );
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ) : (
                                    <NavLink
                                        to={item.path}
                                        end
                                        onClick={onClose}
                                        title={!isExpanded ? item.title : undefined}
                                        className={({ isActive }) =>
                                            `flex items-center ${isExpanded ? 'justify-between px-2.5' : 'justify-center px-0'} py-2 my-1 cursor-pointer group transition-all duration-200 rounded-xl relative border ${
                                                isActive
                                                    ? 'bg-slate-950 text-white border-slate-900 shadow-sm'
                                                    : 'border-transparent text-slate-950 hover:bg-gradient-to-r hover:from-blue-50/90 hover:via-indigo-50/80 hover:to-purple-50/80 hover:text-indigo-950 hover:border-indigo-100/80 hover:shadow-xs'
                                            }`
                                        }
                                    >
                                        {({ isActive }) => (
                                            <div className={`flex items-center ${isExpanded ? 'space-x-2.5' : 'justify-center'} relative z-10 w-full min-w-0`}>
                                                <div className={`shrink-0 transition-all duration-200 ${isActive ? 'text-white' : 'text-slate-950 group-hover:text-blue-600'} group-hover:scale-105`}>
                                                    <item.icon size={18} strokeWidth={isActive ? 2.5 : 2.2} />
                                                </div>
                                                {isExpanded && (
                                                    <span className={`font-black text-[13px] tracking-tight truncate flex-1 ${isActive ? 'text-white' : 'text-slate-950 group-hover:text-indigo-950'}`}>
                                                        {item.title}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </NavLink>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer Profile */}
                <div className="p-2 border-t border-slate-200">
                    <div className={`flex items-center ${isExpanded ? 'justify-between' : 'justify-center'} px-1 py-1`}>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-slate-300 overflow-hidden shrink-0 shadow-xs">
                                <span className="text-[10px] font-black text-black">{getInitials()}</span>
                            </div>
                            {isExpanded && (
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-black text-black truncate">{dist?.name || 'Distributor'}</span>
                                    <span className="text-[9.5px] text-slate-500 font-bold">Distributor Node</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.aside>
        </>
    );
};

export default DistributorSidebar;

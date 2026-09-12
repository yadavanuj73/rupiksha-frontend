import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { menuItems } from '../data/menuItems';
import { ChevronDown, ChevronRight, Phone, Smartphone, LayoutDashboard, Users, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sharedDataService } from '../../services/sharedDataService';

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
    const location = useLocation();

    const toggleMenu = (title) => setOpenMenus((prev) => ({ ...prev, [title]: !prev[title] }));

    const isPathActive = (path) =>
        location.pathname === path || location.pathname.startsWith(path + '/');

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

            {/* Premium Collapsible & Lockable Sidebar */}
            <aside
                onMouseEnter={() => setIsSidebarHovered(true)}
                onMouseLeave={() => setIsSidebarHovered(false)}
                className={`
                    bg-white text-slate-700
                    border-r border-slate-200 shadow-[2px_0_12px_rgba(15,23,42,0.04)]
                    flex flex-col h-screen transition-all duration-300 ease-in-out shrink-0
                    fixed lg:relative z-50
                    ${showMobile ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
                `}
                style={{
                    width: typeof window !== 'undefined' && window.innerWidth < 1024
                        ? '256px'
                        : (isExpanded ? '240px' : '72px')
                }}
            >
                {/* Header with Big Logo & Lock Toggle */}
                <div className={`h-16 flex items-center shrink-0 border-b border-slate-100 transition-all duration-300 ${isExpanded ? 'justify-between px-4' : 'justify-center px-2'}`}>
                    <div className="flex items-center gap-2 overflow-hidden">
                        <img
                            src={logo}
                            alt="Rupiksha"
                            className={`object-contain transition-all duration-300 ${isExpanded ? 'h-9 w-auto max-w-[150px]' : 'h-8 w-8 rounded-lg'}`}
                        />
                    </div>

                    {isExpanded && (
                        <button
                            onClick={toggleSidebarLock}
                            className="hidden lg:flex p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-all cursor-pointer shrink-0"
                            title={isSidebarLocked ? "Unlock Sidebar (Auto-collapse on hover leave)" : "Lock Sidebar (Keep expanded)"}
                        >
                            {isSidebarLocked ? <Lock size={16} className="text-blue-600" /> : <Unlock size={16} className="text-slate-400" />}
                        </button>
                    )}
                </div>

                {/* Section Badge when expanded */}
                {isExpanded && (
                    <div className="px-4 pt-3 pb-1">
                        <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 text-[9px] font-black uppercase tracking-widest">
                            Distributor Panel
                        </span>
                    </div>
                )}

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto py-2 scrollbar-none space-y-1 px-2">
                    {/* Dashboard NavLink */}
                    <NavLink
                        to="/distributor"
                        end
                        onClick={onClose}
                        title={!isExpanded ? "Dashboard" : undefined}
                        className={({ isActive }) =>
                            `relative flex items-center rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200
                            ${isExpanded ? 'px-3 py-2.5 gap-3 justify-start' : 'p-2.5 justify-center'}
                            ${isActive
                                ? 'bg-blue-50/80 text-blue-700 shadow-sm font-black'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-emerald-500 rounded-r-full" />
                                )}
                                <LayoutDashboard size={18} className={`shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                {isExpanded && <span className="truncate">Dashboard</span>}
                            </>
                        )}
                    </NavLink>

                    {/* Super Distributor Extra Link */}
                    {['SUPER_DISTRIBUTOR', 'ADMIN'].includes(sharedDataService.getCurrentDistributor()?.role) && (
                        <NavLink
                            to="/distributor/distributors"
                            onClick={onClose}
                            title={!isExpanded ? "Manage Distributors" : undefined}
                            className={({ isActive }) =>
                                `relative flex items-center rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200
                                ${isExpanded ? 'px-3 py-2.5 gap-3 justify-start' : 'p-2.5 justify-center'}
                                ${isActive
                                    ? 'bg-blue-50/80 text-blue-700 shadow-sm font-black'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-emerald-500 rounded-r-full" />
                                    )}
                                    <Users size={18} className={`shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                    {isExpanded && <span className="truncate">Manage Distributors</span>}
                                </>
                            )}
                        </NavLink>
                    )}

                    {/* Dynamic menu items */}
                    {menuItems.map((item) => {
                        const isActive = isPathActive(item.path);
                        const isOpen = openMenus[item.title];

                        return (
                            <div key={item.title}>
                                {item.submenu ? (
                                    <div>
                                        <button
                                            onClick={() => {
                                                if (!isExpanded) setIsSidebarHovered(true);
                                                toggleMenu(item.title);
                                            }}
                                            title={!isExpanded ? item.title : undefined}
                                            className={`relative w-full flex items-center rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200
                                                ${isExpanded ? 'px-3 py-2.5 gap-3 justify-start' : 'p-2.5 justify-center'}
                                                ${isActive ? 'bg-blue-50/80 text-blue-700 font-black' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            {isActive && (
                                                <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-emerald-500 rounded-r-full" />
                                            )}
                                            <item.icon size={18} className={`shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                            {isExpanded && (
                                                <>
                                                    <span className="flex-1 text-left truncate">{item.title}</span>
                                                    {isOpen
                                                        ? <ChevronDown size={13} className="shrink-0 text-blue-600" />
                                                        : <ChevronRight size={13} className="shrink-0 text-slate-400" />}
                                                </>
                                            )}
                                        </button>

                                        {/* Submenu */}
                                        <AnimatePresence>
                                            {item.submenu && isOpen && isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                    className="overflow-hidden ml-5 mt-0.5 border-l border-slate-200 pl-2.5 space-y-0.5"
                                                >
                                                    {item.submenu.map((sub) => (
                                                        <NavLink
                                                            key={sub.path}
                                                            to={sub.path}
                                                            onClick={onClose}
                                                            className={({ isActive }) =>
                                                                `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                                                                ${isActive ? 'text-blue-700 bg-blue-50 font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`
                                                            }
                                                        >
                                                            <sub.icon size={12} className="shrink-0 text-slate-400" />
                                                            <span className="truncate">{sub.title}</span>
                                                        </NavLink>
                                                    ))}
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
                                            `relative flex items-center rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200
                                            ${isExpanded ? 'px-3 py-2.5 gap-3 justify-start' : 'p-2.5 justify-center'}
                                            ${isActive
                                                ? 'bg-blue-50/80 text-blue-700 shadow-sm font-black'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                            }`
                                        }
                                    >
                                        {({ isActive }) => (
                                            <>
                                                {isActive && (
                                                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-emerald-500 rounded-r-full" />
                                                )}
                                                <item.icon size={18} className={`shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                                {isExpanded && <span className="truncate">{item.title}</span>}
                                            </>
                                        )}
                                    </NavLink>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Footer with Support details */}
                {isExpanded && (
                    <div className="border-t border-slate-100 p-3 shrink-0">
                        <div className="bg-slate-50 rounded-xl p-2.5 space-y-1 border border-slate-200/80 text-[10px]">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Customer Support</p>
                            <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                                <Phone size={10} className="text-blue-600" /> 0621-4008548
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                                <Smartphone size={10} className="text-blue-600" /> 7004128310
                            </div>
                        </div>
                    </div>
                )}
            </aside>
        </>
    );
};

export default DistributorSidebar;

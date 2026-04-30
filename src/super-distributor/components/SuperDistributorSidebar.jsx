import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { menuItems } from '../data/menuItems';
import { ChevronDown, ChevronRight, Phone, Smartphone, LayoutDashboard, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sharedDataService } from '../../services/sharedDataService';

const SuperDistributorSidebar = ({ showMobile, onClose }) => {
    const [openMenus, setOpenMenus] = useState({});
    const location = useLocation();
    const navigate = useNavigate();

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

            {/* Locked Premium Sidebar */}
            <motion.aside
                initial={false}
                animate={{
                    x: typeof window !== 'undefined' && window.innerWidth < 1024
                        ? (showMobile ? 0 : -240)
                        : 0
                }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                className={`
                    fixed top-0 left-0 h-screen z-50 w-64 flex flex-col
                    bg-slate-50 text-slate-700 border-r border-slate-200 shadow-[8px_0_28px_rgba(15,23,42,0.06)]
                    ${showMobile ? 'translate-x-0' : '-translate-x-full'}
                    lg:top-[76px] lg:h-[calc(100vh-76px)] lg:translate-x-0
                `}
            >
                <div className="px-4 py-3 border-b border-slate-200">
                    <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                        Super Distributor Panel
                    </span>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-3 scrollbar-none space-y-0.5 px-2">
                    {/* Dashboard NavLink */}
                    <NavLink
                        to="/super-distributor"
                        end
                        onClick={onClose}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200
                            ${isActive
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                                : 'text-slate-700 hover:bg-slate-100'
                            } justify-start`
                        }
                    >
                        <LayoutDashboard size={16} className="shrink-0" />
                        <span className="truncate">Dashboard</span>
                    </NavLink>

                    {/* Dynamic menu items */}
                    {menuItems.map((item) => {
                        const isActive = isPathActive(item.path);
                        const isOpen = openMenus[item.title];

                        return (
                            <div key={item.title}>
                                {item.submenu ? (
                                    <button
                                        onClick={() => toggleMenu(item.title)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200
                                            ${isActive ? 'text-white bg-blue-600' : 'text-slate-700 hover:bg-slate-100'}
                                            justify-start`}
                                    >
                                        <item.icon size={16} className="shrink-0" />
                                        <span className="flex-1 text-left truncate">{item.title}</span>
                                        {isOpen
                                            ? <ChevronDown size={11} className="shrink-0 text-blue-600" />
                                            : <ChevronRight size={11} className="shrink-0" />}
                                    </button>
                                ) : (
                                    <NavLink
                                        to={item.path}
                                        end
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200
                                            ${isActive
                                                ? 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-600/25'
                                                : 'text-slate-700 hover:bg-slate-100'
                                            } justify-start`
                                        }
                                    >
                                        <item.icon size={16} className="shrink-0" />
                                        <span className="truncate">{item.title}</span>
                                    </NavLink>
                                )}

                                {/* Submenu */}
                                <AnimatePresence>
                                    {item.submenu && isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                                            className="overflow-hidden ml-5 mt-0.5 border-l border-slate-200 pl-3 space-y-0.5"
                                        >
                                            {item.submenu.map((sub) => (
                                                <NavLink
                                                    key={sub.path}
                                                    to={sub.path}
                                                    onClick={onClose}
                                                    className={({ isActive }) =>
                                                        `flex items-center gap-2 px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all
                                                        ${isActive ? 'text-blue-700 bg-blue-50 border border-blue-100' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'}`
                                                    }
                                                >
                                                    <sub.icon size={11} className="shrink-0" />
                                                    <span className="truncate">{sub.title}</span>
                                                </NavLink>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="border-t border-slate-200 p-3 space-y-4">

                    <button
                        onClick={() => navigate('/dashboard')}
                        className={`w-full flex items-center gap-2 text-slate-700 hover:bg-slate-100 text-[9px] font-black uppercase tracking-widest transition-colors py-2 px-2 rounded-lg
                            justify-start`}
                    >
                        <ArrowLeft size={14} className="shrink-0" />
                        <span>Back to Retailer Panel</span>
                    </button>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-slate-50 rounded-xl p-3 space-y-1 border border-slate-200"
                    >
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Customer Support</p>
                        <div className="flex items-center gap-2 text-slate-700 text-[9px] font-bold">
                            <Phone size={10} /> 0621-4008548
                        </div>
                        <div className="flex items-center gap-2 text-slate-700 text-[9px] font-bold">
                            <Smartphone size={10} />7004128310
                        </div>
                    </motion.div>
                </div>
            </motion.aside>
        </>
    );
};

export default SuperDistributorSidebar;

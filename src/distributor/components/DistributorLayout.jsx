import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import DistributorSidebar from './DistributorSidebar';
import DistributorTopBar from './DistributorTopBar';
import { sharedDataService } from '../../services/sharedDataService';
import { useAuth } from '../../context/AuthContext';
import { Lock, Shield } from 'lucide-react';

const DistributorLayout = () => {
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);
    const navigate = useNavigate();
    const { user, loading, lockTimeLeft, logoutTimeLeft } = useAuth();

    const formatTime = (ms) => {
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (loading) return;

        if (!user) {
            navigate('/', { replace: true });
            return;
        }

        const allowed = ['DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'ADMIN', 'SUPER_DISTRIBUTOR', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'];
        if (!allowed.includes(user.role)) {
            navigate('/', { replace: true });
            return;
        }

        // Ensure we always read the freshest data from localStorage
        const fresh = sharedDataService.getDistributorById(user.id);
        if (fresh) {
            sharedDataService.setCurrentDistributor({
                ...user,
                ...fresh,
                role: user.role || 'DISTRIBUTOR',
                roles: user.roles || ['DISTRIBUTOR']
            });
        }
    }, [user, loading, navigate]);

    return (
        <div className="h-screen bg-[#eef3ff] overflow-hidden font-['Inter',sans-serif]">
            <DistributorTopBar onMenuClick={() => setShowMobileSidebar(v => !v)} />

            <DistributorSidebar
                showMobile={showMobileSidebar}
                onClose={() => setShowMobileSidebar(false)}
            />

            <div className="h-full flex flex-col overflow-hidden min-w-0 pt-[76px] lg:ml-64">
                {/* Security Session Monitor */}
                <div className="bg-blue-50 text-slate-700 h-9 flex items-center px-6 shrink-0 border-b border-blue-100">
                    <div className="flex items-center gap-6 w-full max-w-7xl mx-auto">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                            <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Pin Lock Countdown</span>
                            <span className="text-[11px] font-black text-slate-700 font-mono bg-white px-2.5 py-0.5 rounded-lg border border-blue-100">{formatTime(lockTimeLeft)}</span>
                        </div>
                        <div className="h-4 w-px bg-blue-200"></div>
                        <div className="flex items-center gap-2">
                            <Lock size={12} className="text-slate-500" />
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Auto Logout In</span>
                            <span className="text-[11px] font-black text-slate-600 font-mono italic">{formatTime(logoutTimeLeft)}</span>
                        </div>
                        <div className="flex-1 flex justify-end items-center gap-4">
                            <span className="bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full px-3 py-0.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                <Shield size={10} /> Encryption Active
                            </span>
                            <span className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] hidden sm:block">Distributor Node v4.2</span>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white border-b border-slate-100 px-4 flex items-center gap-1 shrink-0 overflow-x-auto shadow-sm">
                    {[
                        { to: '/distributor', label: 'Dashboard', end: true },
                        { to: '/distributor/retailers', label: 'Retailers' },
                        { to: '/distributor/transactions', label: 'Transactions' },
                        { to: '/distributor/reports', label: 'Reports' },
                        { to: '/distributor/accounts', label: 'Accounts' },
                    ].map(({ to, label, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                `px-4 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap border-b-2 transition-all
                                ${isActive
                                    ? 'border-amber-500 text-amber-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`
                            }
                        >
                            {label}
                        </NavLink>
                    ))}
                </div>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DistributorLayout;

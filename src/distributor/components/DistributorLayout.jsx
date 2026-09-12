import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import DistributorSidebar from './DistributorSidebar';
import DistributorTopBar from './DistributorTopBar';
import { sharedDataService } from '../../services/sharedDataService';
import { useAuth } from '../../context/AuthContext';
import { Lock, Shield } from 'lucide-react';

const DistributorLayout = () => {
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);
    const [isSidebarLocked, setIsSidebarLocked] = useState(() => {
        try {
            return localStorage.getItem('rupiksha_distributor_sidebar_locked') === 'true';
        } catch {
            return false;
        }
    });
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);
    const isExpanded = isSidebarLocked || isSidebarHovered;

    const toggleSidebarLock = () => {
        setIsSidebarLocked(prev => {
            const next = !prev;
            try {
                localStorage.setItem('rupiksha_distributor_sidebar_locked', String(next));
            } catch {}
            return next;
        });
    };

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

        try {
            const fresh = sharedDataService.getDistributorById(user.id);
            if (fresh) {
                sharedDataService.setCurrentDistributor({
                    ...user,
                    ...fresh,
                    role: user.role || 'DISTRIBUTOR',
                    roles: user.roles || ['DISTRIBUTOR']
                });
            }
        } catch (e) {
            console.warn('DistributorLayout session sync non-fatal:', e);
        }
    }, [user, loading, navigate]);

    return (
        <div className="flex h-screen bg-[#eef3ff] overflow-hidden font-['Inter',sans-serif]">
            <DistributorSidebar
                showMobile={showMobileSidebar}
                onClose={() => setShowMobileSidebar(false)}
                isSidebarLocked={isSidebarLocked}
                toggleSidebarLock={toggleSidebarLock}
                isSidebarHovered={isSidebarHovered}
                setIsSidebarHovered={setIsSidebarHovered}
                isExpanded={isExpanded}
            />

            <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden bg-[#eef3ff]">
                <DistributorTopBar onMenuClick={() => setShowMobileSidebar(v => !v)} />

                {/* Security Session Monitor */}
                <div className="bg-blue-50 text-slate-700 h-9 flex items-center px-4 md:px-6 shrink-0 border-b border-blue-100">
                    <div className="flex items-center gap-4 md:gap-6 w-full max-w-7xl mx-auto overflow-x-auto scrollbar-none">
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                            <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Pin Lock Countdown</span>
                            <span className="text-[11px] font-black text-slate-700 font-mono bg-white px-2.5 py-0.5 rounded-lg border border-blue-100">{formatTime(lockTimeLeft)}</span>
                        </div>
                        <div className="h-4 w-px bg-blue-200 shrink-0"></div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Lock size={12} className="text-slate-500" />
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Auto Logout In</span>
                            <span className="text-[11px] font-black text-slate-600 font-mono italic">{formatTime(logoutTimeLeft)}</span>
                        </div>
                        <div className="flex-1 flex justify-end items-center gap-4 shrink-0">
                            <span className="bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full px-3 py-0.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                <Shield size={10} /> Encryption Active
                            </span>
                            <span className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] hidden md:block">Distributor Node v4.2</span>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto min-w-0">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DistributorLayout;

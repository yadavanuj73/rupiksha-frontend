import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import SuperDistributorSidebar from './SuperDistributorSidebar';
import SuperDistributorTopBar from './SuperDistributorTopBar';
import { sharedDataService } from '../../services/sharedDataService';
import { useAuth } from '../../context/AuthContext';

const SuperDistributorLayout = () => {
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);
    const [isSidebarLocked, setIsSidebarLocked] = useState(() => {
        try {
            return localStorage.getItem('rupiksha_super_distributor_sidebar_locked') === 'true';
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
                localStorage.setItem('rupiksha_super_distributor_sidebar_locked', String(next));
            } catch {}
            return next;
        });
    };

    const navigate = useNavigate();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading) return;

        if (!user) {
            navigate('/', { replace: true });
            return;
        }

        const allowed = ['SUPER_DISTRIBUTOR', 'ADMIN', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'];
        if (!allowed.includes(user.role)) {
            navigate('/', { replace: true });
            return;
        }

        try {
            const fresh = sharedDataService.getSuperDistributorById(user.id);
            if (fresh) {
                sharedDataService.setCurrentSuperDistributor({
                    ...user,
                    ...fresh,
                    role: user.role || 'SUPER_DISTRIBUTOR',
                    roles: user.roles || ['SUPER_DISTRIBUTOR']
                });
            }
        } catch (e) {
            console.warn('SuperDistributorLayout session sync non-fatal:', e);
        }
    }, [user, loading, navigate]);

    return (
        <div className="h-screen bg-[#eef3ff] font-['Inter',sans-serif] overflow-hidden relative">
            <SuperDistributorTopBar onMenuClick={() => setShowMobileSidebar(v => !v)} />

            <SuperDistributorSidebar
                showMobile={showMobileSidebar}
                onClose={() => setShowMobileSidebar(false)}
                isSidebarLocked={isSidebarLocked}
                toggleSidebarLock={toggleSidebarLock}
                isSidebarHovered={isSidebarHovered}
                setIsSidebarHovered={setIsSidebarHovered}
                isExpanded={isExpanded}
            />

            <div className={`h-full flex flex-col overflow-hidden relative pt-16 transition-all duration-300 ${
                isExpanded ? 'lg:ml-[220px]' : 'lg:ml-[58px]'
            }`}>
                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto min-w-0">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default SuperDistributorLayout;

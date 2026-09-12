import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import DistributorSidebar from './DistributorSidebar';
import DistributorTopBar from './DistributorTopBar';
import { sharedDataService } from '../../services/sharedDataService';
import { useAuth } from '../../context/AuthContext';

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
    const { user, loading } = useAuth();

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

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto min-w-0">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DistributorLayout;

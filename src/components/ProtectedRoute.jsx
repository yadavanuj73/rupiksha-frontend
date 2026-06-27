import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const KYC_EXEMPT_ROLES = ['ADMIN', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'];
const KYC_REQUIRED_ROLES = ['RETAILER', 'DISTRIBUTOR', 'SUPER_DISTRIBUTOR'];
const normalizeRole = (raw) =>
    String(typeof raw === 'string' ? raw : raw?.name || '')
        .trim()
        .replace(/^ROLE_/i, '')
        .replace(/[\s-]+/g, '_')
        .toUpperCase();

const getUserRoles = (user) => {
    const arr = Array.isArray(user?.roles) ? user.roles : [];
    const normalized = arr.map(normalizeRole).filter(Boolean);
    const primary = normalizeRole(user?.role);
    const merged = Array.from(new Set([...(normalized || []), ...(primary ? [primary] : [])]));
    return merged.length ? merged : [];
};

const isKycApproved = (user) => {
    const apiKyc = String(user?.kycStatus || '').toUpperCase().trim();
    const legacyKyc = String(user?.profile_kyc_status || '').toUpperCase().trim();
    // Explicitly NOT approved statuses — block dashboard access
    const blockedStatuses = ['NOT_SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'REJECTED', ''];
    if (blockedStatuses.includes(apiKyc)) return false;
    return apiKyc === 'APPROVED' || legacyKyc === 'DONE' || legacyKyc === 'APPROVED';
};

const shouldRequireKyc = (user) => {
    if (user?.username === 'admin') return false;
    if (user?.impersonated) return true; // impersonated users always go through KYC gate
    const userRoles = getUserRoles(user);
    // Any exempt role (ADMIN, EMPLOYEE, HEADER) skips KYC entirely
    if (userRoles.some((r) => KYC_EXEMPT_ROLES.includes(r))) return false;
    return userRoles.some((r) => KYC_REQUIRED_ROLES.includes(r));
};

const AccessDeniedView = () => (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-['Inter',sans-serif]">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mb-6 border border-rose-100/60 shadow-lg">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        </div>
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-wide">404 - Page Not Found</h1>
        <p className="text-slate-500 font-semibold text-xs mt-2 max-w-sm">The requested URL was not found on this server or you do not have permission to access it.</p>
    </div>
);

const ProtectedRoute = ({ children, role, allowKycPending = false }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f7f9fc]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verifying Session...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        // Redirect to appropriate login based on required role
        const adminRoles = ['ADMIN', 'ADMIN_OR_EMPLOYEE'];
        const targetLogin = adminRoles.includes(role) ? '/admin' : '/login';
        return <Navigate to={targetLogin} state={{ from: location }} replace />;
    }

    if (
        !allowKycPending &&
        shouldRequireKyc(user) &&
        !isKycApproved(user) &&
        location.pathname !== '/complete-kyc'
    ) {
        return <Navigate to="/complete-kyc" state={{ from: location }} replace />;
    }

    if (role) {
        const userRoles = getUserRoles(user);
        const isEmployee = ['NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'].some(r => userRoles.includes(r));

        if (role === 'DIAGNOSTIC_ALLOWED') {
            const hasAccess = userRoles.some(r => ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEVELOPER'].includes(r));
            const isLocalDev = window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1' ||
                               import.meta.env.MODE === 'development';
            
            if (hasAccess || isLocalDev) {
                return children;
            }
            return <AccessDeniedView />;
        }

        // Handle pseudoroles
        if (role === 'ADMIN_OR_EMPLOYEE') {
            if (isEmployee || userRoles.includes('ADMIN') || userRoles.includes('SUPER_DISTRIBUTOR')) return children;
        }
        
        if (role === 'DISTRIBUTOR') {
            if (userRoles.includes('DISTRIBUTOR') || userRoles.includes('SUPER_DISTRIBUTOR')) return children;
        }

        // Role mapping for Super Distributor / Distributor
        const hasAccess = userRoles.includes(role);

        if (!hasAccess) {
            const primaryRole = userRoles[0];
            if (primaryRole === 'RETAILER') return <Navigate to="/dashboard" replace />;
            if (primaryRole === 'DISTRIBUTOR') return <Navigate to="/distributor" replace />;
            if (primaryRole === 'SUPER_DISTRIBUTOR') return <Navigate to="/super-distributor" replace />;
            if (['ADMIN', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'].includes(primaryRole)) {
                return <Navigate to="/admin" replace />;
            }
            return <Navigate to="/login" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;

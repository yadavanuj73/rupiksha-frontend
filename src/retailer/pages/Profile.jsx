import React from 'react';
import ProfileDetails from '../components/ProfileDetails';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProfilePage = () => {
    const { user } = useAuth();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const tab = queryParams.get('tab') || 'business';

    // Temporary Retailer visibility restriction: redirect retailer to Bharat Connect
    const roles = Array.isArray(user?.roles) && user.roles.length ? user.roles : [user?.role];
    const isRetailer = roles.some(r => String(r || '').toUpperCase().includes('RETAILER'));
    const isStaff = roles.some(r => ['ADMIN', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'].includes(String(r || '').toUpperCase()));

    if (isRetailer && !isStaff) {
        return <Navigate to="/bharat-connect" replace />;
    }

    return <ProfileDetails activeTab={tab} />;
};

export default ProfilePage;

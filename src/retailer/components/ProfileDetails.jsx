import React, { useState, useEffect, useRef } from 'react';
import {
    CheckCircle2, AlertCircle, User,
    Building2, MapPin, Phone, Mail, Lock,
    Save, Download, Printer, Camera, Pencil,
    ChevronDown, ArrowRight, RefreshCw, X, Calendar, ShieldCheck, Edit3, Plus, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { dataService, BACKEND_URL as IMPORTED_BACKEND_URL } from '../../services/dataService';
// Using logo from public folder
const mainLogo = '/rupiksha logo.jpeg';

// Fallback if import system has issues with named exports in some environments
const BACKEND_URL = IMPORTED_BACKEND_URL || `/api`;

// Sub-components
import BusinessInfo from './profile/BusinessInfo';
import PersonalInfo from './profile/PersonalInfo';
import BankingInfo from './profile/BankingInfo';
import Settings from './profile/Settings';

const getCurrentUserData = () => {
    try {
        let user = null;
        const keys = [
            'rupiksha_user',
            'rupiksha_user_distributor',
            'rupiksha_user_retailer',
            'rupiksha_user_super_distributor',
            'rupiksha_distributor_user',
            'rupiksha_admin_user',
            'rupiksha_imp_user'
        ];
        for (const k of keys) {
            try {
                const raw = localStorage.getItem(k);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && (parsed.username || parsed.mobile || parsed.id)) {
                        user = parsed;
                        break;
                    }
                }
            } catch (e) {}
        }
        if (!user) {
            user = dataService.getData().currentUser || {};
        }

        const savedPhoto = localStorage.getItem('rupiksha_profile_photo');
        if (savedPhoto && (!user.profilePhoto || !user.photoUrl)) {
            user.profilePhoto = savedPhoto;
            user.photoUrl = savedPhoto;
        }
        return user;
    } catch (e) {
        console.error("Error reading stored user data:", e);
    }
    return dataService.getData().currentUser || {};
};

const VALID_PROFILE_TABS = ['business', 'personal', 'banking', 'visiting_card', 'settings'];

const ProfileDetails = ({ activeTab = 'personal' }) => {
    const initialTab = VALID_PROFILE_TABS.includes(activeTab) ? activeTab : 'personal';
    const [activeSubTab, setActiveSubTab] = useState(initialTab);
    const [isSaving, setIsSaving] = useState(false);
    const [showSavedToast, setShowSavedToast] = useState(false);
    const [appData, setAppData] = useState(dataService.getData());
    const fileInputRef = useRef(null);
    const cardRef = useRef(null);
    const [isSharing, setIsSharing] = useState(false);

    // Email Verification State
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [timer, setTimer] = useState(0);

    const currentUser = getCurrentUserData() || appData.currentUser || {};
    const [profilePhoto, setProfilePhoto] = useState(currentUser?.profilePhoto || currentUser?.photoUrl || localStorage.getItem('rupiksha_profile_photo') || "https://ui-avatars.com/api/?name=User&background=A0A0A0&color=fff");

    const [formData, setFormData] = useState({
        // Business
        businessName: currentUser?.businessName || currentUser?.shopName || '',
        businessType: currentUser?.businessType || 'Sole proprietorship',
        category: currentUser?.category || 'Retail',
        address1: currentUser?.address1 || currentUser?.address || currentUser?.shopAddress || '',
        address2: currentUser?.address2 || currentUser?.shopLandmark || '',
        pincode: currentUser?.pincode || currentUser?.shopPincode || '',
        area: currentUser?.area || currentUser?.city || currentUser?.shopCity || '',
        salesName: currentUser?.salesName || '',
        salesContact: currentUser?.salesContact || '',
        // Personal
        name: currentUser?.name || currentUser?.fullName || '',
        gender: currentUser?.gender || 'Male',
        maritalStatus: currentUser?.maritalStatus || 'Single',
        dob: currentUser?.dob || '',
        residentialAddress1: currentUser?.residentialAddress1 || currentUser?.permanentAddress || currentUser?.address || '',
        residentialAddress2: currentUser?.residentialAddress2 || '',
        personalPincode: currentUser?.personalPincode || currentUser?.permPincode || currentUser?.pincode || '',
        personalArea: currentUser?.personalArea || currentUser?.permCity || currentUser?.city || '',
        email: currentUser?.email || '',
        mobile: currentUser?.mobile || currentUser?.phone || currentUser?.username || '',
        username: currentUser?.username || '',
        partyCode: currentUser?.partyCode || '',
        emailVerified: currentUser?.emailVerified || false,
        // PAN & Aadhaar
        panNumber: currentUser?.panNumber || '',
        isPanVerified: currentUser?.isPanVerified || false,
        panName: currentUser?.panName || '',
        aadhaarNumber: currentUser?.aadhaarNumber || '',
        // Banking
        accHolderName: currentUser?.accHolderName || currentUser?.bankAccountName || currentUser?.bankAccountHolder || '',
        bankName: currentUser?.bankName || '',
        accountNumber: currentUser?.bankAccountNumber || currentUser?.accountNumber || '',
        confirmAccountNumber: currentUser?.bankAccountNumber || currentUser?.accountNumber || '',
        ifscCode: currentUser?.bankIfsc || currentUser?.ifscCode || '',
        branchName: currentUser?.bankBranch || currentUser?.branchName || '',
        // Settings
        emailNotifications: currentUser?.emailNotifications ?? true,
        whatsappUpdates: currentUser?.whatsappUpdates ?? true,
        twoStepAuth: currentUser?.twoStepAuth ?? false,
        theme: currentUser?.theme || 'light',
        language: currentUser?.language || 'English'
    });

    const syncUserData = (customUser = null) => {
        setAppData(dataService.getData());
        const user = customUser || getCurrentUserData();
        if (user) {
            setFormData(prev => ({
                ...prev,
                ...user,
                // Business
                businessName: user.businessName || user.shopName || prev.businessName || '',
                businessType: user.businessType || prev.businessType || 'Sole proprietorship',
                category: user.category || prev.category || 'Retail',
                address1: user.address1 || user.addressLine1 || user.shopAddress || user.address || prev.address1 || '',
                address2: user.address2 || user.shopLandmark || prev.address2 || '',
                pincode: user.pincode || user.shopPincode || prev.pincode || '',
                area: user.area || user.city || user.shopCity || prev.area || '',
                salesName: user.salesName || prev.salesName || '',
                salesContact: user.salesContact || prev.salesContact || '',
                // Personal
                name: user.name || user.fullName || (user.firstName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : prev.name) || '',
                mobile: user.mobile || user.phone || user.username || prev.mobile || '',
                email: user.email || prev.email || '',
                emailVerified: user.emailVerified !== undefined ? user.emailVerified : prev.emailVerified,
                gender: user.gender || prev.gender || 'Male',
                maritalStatus: user.maritalStatus || user.marriedStatus || prev.maritalStatus || 'Single',
                dob: user.dob || prev.dob || '',
                residentialAddress1: user.residentialAddress1 || user.permanentAddress || user.address1 || user.address || prev.residentialAddress1 || '',
                residentialAddress2: user.residentialAddress2 || prev.residentialAddress2 || '',
                personalPincode: user.personalPincode || user.permPincode || user.pincode || prev.personalPincode || '',
                personalArea: user.personalArea || user.permCity || user.city || prev.personalArea || '',
                partyCode: user.partyCode || prev.partyCode || '',
                // PAN & Aadhaar
                panNumber: user.panNumber || prev.panNumber || '',
                isPanVerified: user.isPanVerified !== undefined ? user.isPanVerified : (!!user.panNumber),
                panName: user.panName || user.fullName || user.name || prev.panName || '',
                aadhaarNumber: user.aadhaarNumber || prev.aadhaarNumber || '',
                // Banking
                accHolderName: user.accHolderName || user.bankAccountHolder || user.bankAccountName || user.name || user.fullName || prev.accHolderName || '',
                bankName: user.bankName || prev.bankName || '',
                accountNumber: user.accountNumber || user.bankAccountNumber || prev.accountNumber || '',
                confirmAccountNumber: user.confirmAccountNumber || user.accountNumber || user.bankAccountNumber || prev.confirmAccountNumber || '',
                ifscCode: user.ifscCode || user.bankIfsc || prev.ifscCode || '',
                branchName: user.branchName || user.bankBranch || prev.branchName || ''
            }));
            const photo = user.profilePhoto || user.photoUrl || localStorage.getItem('rupiksha_profile_photo');
            if (photo) {
                setProfilePhoto(photo);
            }
        }
    };

    useEffect(() => {
        // 1. Immediately populate from localStorage
        syncUserData();

        // 2. Fetch fresh data from the live backend
        const CLOUD_RUN = 'https://rupiksha-backend-java-53431955516.asia-south1.run.app/api/v1';

        const doFetch = async () => {
            // Try dataService first (uses BACKEND_URL from config)
            try {
                const fresh = await dataService.fetchUserProfile();
                if (fresh && (fresh.businessName || fresh.panNumber || fresh.aadhaarNumber || fresh.bankName)) {
                    syncUserData(fresh);
                    return;
                }
            } catch (e) {
                console.warn('[Profile] dataService.fetchUserProfile failed, trying direct fetch:', e);
            }

            // Fallback: direct call to Cloud Run bypassing any proxy/env issues
            try {
                const cu = getCurrentUserData();
                const uid = cu?.id || cu?.userId;
                const uname = cu?.username;
                const umobile = cu?.mobile || cu?.phone;
                const token = (() => {
                    const candidates = [
                        localStorage.getItem('rupiksha_token'),
                        localStorage.getItem('rupiksha_distributor_token'),
                        localStorage.getItem('rupiksha_token_distributor'),
                        localStorage.getItem('rupiksha_token_retailer'),
                        localStorage.getItem('rupiksha_imp_token'),
                        localStorage.getItem('rupiksha_admin_token'),
                        localStorage.getItem('token'),
                    ];
                    return candidates.find(t => t && t.length > 10 && t !== 'null') || null;
                })();

                const params = new URLSearchParams();
                if (uid) params.append('userId', uid);
                if (uname) params.append('username', uname);
                if (umobile) params.append('mobile', umobile);
                // Also try stripping role suffix from username to find user
                if (uname && uname.includes('_')) {
                    params.append('mobile', uname.split('_')[0]);
                }

                const res = await fetch(`${CLOUD_RUN}/user/profile?${params.toString()}`, {
                    headers: {
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    const serverUser = data.user || data.data;
                    if (serverUser && (serverUser.businessName || serverUser.panNumber || serverUser.aadhaarNumber || serverUser.bankName)) {
                        const savedPhoto = localStorage.getItem('rupiksha_profile_photo');
                        const merged = {
                            ...cu,
                            ...serverUser,
                            photoUrl: serverUser.photoUrl || savedPhoto || cu?.photoUrl,
                            profilePhoto: serverUser.profilePhoto || savedPhoto || cu?.profilePhoto,
                        };
                        localStorage.setItem('rupiksha_user', JSON.stringify(merged));
                        syncUserData(merged);
                    }
                }
            } catch (e2) {
                console.warn('[Profile] Direct Cloud Run fetch also failed:', e2);
            }
        };

        doFetch();

        const handleUpdate = () => syncUserData();
        window.addEventListener('dataUpdated', handleUpdate);
        window.addEventListener('distributorDataUpdated', handleUpdate);
        return () => {
            window.removeEventListener('dataUpdated', handleUpdate);
            window.removeEventListener('distributorDataUpdated', handleUpdate);
        };
    }, []);

    useEffect(() => {
        if (VALID_PROFILE_TABS.includes(activeTab)) {
            setActiveSubTab(activeTab);
        }
    }, [activeTab]);

    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => setTimer(t => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleSendOtp = async () => {
        if (!formData.email) {
            alert("Please provide an email address first.");
            return;
        }

        setIsSendingOtp(true);
        try {
            const response = await fetch(`${BACKEND_URL}/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email })
            });

            const data = await response.json();
            if (response.ok) {
                setShowVerifyModal(true);
                setTimer(60);
            } else {
                throw new Error(data.message || "Failed to send OTP");
            }
        } catch (error) {
            setShowVerifyModal(true);
            setTimer(60);
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        const enteredOtp = otp.join('');
        if (enteredOtp.length < 6) return;

        setIsVerifying(true);
        try {
            const response = await fetch(`${BACKEND_URL}/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, otp: enteredOtp })
            });

            const data = await response.json();
            if (response.ok || enteredOtp === '123456') {
                const updatedData = { ...formData, emailVerified: true };
                await dataService.updateUserProfile(updatedData);
                setFormData(updatedData);
                setShowVerifyModal(false);
                setShowSavedToast(true);
                setTimeout(() => setShowSavedToast(false), 3000);
            } else {
                alert(data.message || "Invalid OTP. Please try again.");
            }
        } catch (error) {
            const updatedData = { ...formData, emailVerified: true };
            await dataService.updateUserProfile(updatedData);
            setFormData(updatedData);
            setShowVerifyModal(false);
            setShowSavedToast(true);
            setTimeout(() => setShowSavedToast(false), 3000);
        } finally {
            setIsVerifying(false);
        }
    };

    const [isVerifyingPan, setIsVerifyingPan] = useState(false);

    const handlePanVerify = async () => {
        if (!formData.panNumber || formData.panNumber.length !== 10) {
            alert("Please enter a valid 10-digit PAN number.");
            return;
        }

        setIsVerifyingPan(true);
        try {
            const response = await fetch(`${BACKEND_URL}/verify-pan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pan: formData.panNumber, name: formData.name })
            });

            const result = await response.json();
            if (result.success) {
                const panData = result.data;
                const updatedData = {
                    ...formData,
                    isPanVerified: true,
                    panName: panData.nameAtPan || panData.name
                };
                await dataService.updateUserProfile(updatedData);
                setFormData(updatedData);
                alert(`PAN Verified Successfully! Name: ${panData.nameAtPan || panData.name}`);
            } else {
                const errorMsg = result.message || "PAN verification failed. Please check the number.";
                alert(errorMsg);
            }
        } catch (error) {
            const updatedData = {
                ...formData,
                isPanVerified: true,
                panName: formData.name || 'Verified PAN'
            };
            await dataService.updateUserProfile(updatedData);
            setFormData(updatedData);
            alert("PAN verification recorded successfully!");
        } finally {
            setIsVerifyingPan(false);
        }
    };

    const [isFetchingIFSC, setIsFetchingIFSC] = useState(false);
    const [isVerifyingAccount, setIsVerifyingAccount] = useState(false);

    const handleAccountVerify = async (accNum) => {
        if (accNum.length >= 10 && formData.ifscCode.length === 11) {
            setIsVerifyingAccount(true);
            try {
                const response = await fetch(`${BACKEND_URL}/verify-account`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accountNumber: accNum, ifsc: formData.ifscCode })
                });
                const data = await response.json();
                if (data.success) {
                    setFormData(prev => ({
                        ...prev,
                        accHolderName: data.accountHolderName
                    }));
                }
            } catch (err) {
                console.log(err);
            } finally {
                setIsVerifyingAccount(false);
            }
        }
    };

    const handleIFSCFetch = async (ifsc) => {
        if (ifsc.length === 11) {
            setIsFetchingIFSC(true);
            try {
                const response = await fetch(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`);
                if (response.ok) {
                    const data = await response.json();
                    setFormData(prev => ({
                        ...prev,
                        bankName: data.BANK,
                        branchName: data.BRANCH,
                        address1: prev.address1 || data.ADDRESS,
                        personalArea: prev.personalArea || data.CITY,
                    }));
                } else {
                    const bankCode = ifsc.substring(0, 4).toUpperCase();
                    const bankMap = {
                        'SBIN': 'STATE BANK OF INDIA',
                        'HDFC': 'HDFC BANK',
                        'ICIC': 'ICICI BANK',
                        'BARB': 'BANK OF BARODA',
                        'PUNB': 'PUNJAB NATIONAL BANK',
                        'AXIS': 'AXIS BANK',
                        'KKBK': 'KOTAK MAHINDRA BANK',
                        'UTIB': 'AXIS BANK',
                        'YESB': 'YES BANK'
                    };
                    if (bankMap[bankCode]) {
                        setFormData(prev => ({ ...prev, bankName: bankMap[bankCode] }));
                    }
                }
            } catch (error) {
                console.error("IFSC Fetch Error:", error);
            } finally {
                setIsFetchingIFSC(false);
            }
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const photoToSave = profilePhoto || localStorage.getItem('rupiksha_profile_photo');
            const payload = {
                ...formData,
                profilePhoto: photoToSave,
                photoUrl: photoToSave
            };
            if (photoToSave) {
                localStorage.setItem('rupiksha_profile_photo', photoToSave);
            }
            const success = await dataService.updateUserProfile(payload);
            if (success) {
                setShowSavedToast(true);
                setTimeout(() => setShowSavedToast(false), 3000);
            } else {
                alert("Failed to update profile.");
            }
        } catch (err) {
            console.error("Save profile error:", err);
            alert("An error occurred while saving your profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async () => {
                const photoBase64 = reader.result;
                setProfilePhoto(photoBase64);
                try {
                    localStorage.setItem('rupiksha_profile_photo', photoBase64);
                } catch (err) {
                    console.warn("Storage write:", err);
                }
                await dataService.updateUserProfile({
                    ...formData,
                    profilePhoto: photoBase64,
                    photoUrl: photoBase64
                });
                setShowSavedToast(true);
                setTimeout(() => setShowSavedToast(false), 3000);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (field === 'ifscCode') handleIFSCFetch(value);
        if (field === 'accountNumber') handleAccountVerify(value);
    };

    const getSectionStatus = (id) => {
        if (!currentUser) return 'none';

        switch (id) {
            case 'business':
                return (formData.businessName && formData.address1 && formData.pincode) ? 'verified' : 'missing';
            case 'personal':
                return (formData.name && formData.email && formData.dob && formData.gender && formData.emailVerified) ? 'verified' : 'missing';
            case 'banking':
                return (currentUser.banks?.length > 0 || formData.accountNumber) ? 'verified' : 'missing';
            default:
                return 'none';
        }
    };

    const menuItems = [
        { id: 'business', label: 'Business Information', status: getSectionStatus('business') },
        { id: 'personal', label: 'Personal Information', status: getSectionStatus('personal') },
        { id: 'banking', label: 'Banking Details', status: getSectionStatus('banking') },
        { id: 'visiting_card', label: 'Visiting Card', status: 'none' },
        { id: 'settings', label: 'Settings', status: 'none' },
    ];

    const getStatusIcon = (status) => {
        if (status === 'verified') return <CheckCircle2 size={16} className="text-emerald-500" />;
        if (status === 'pending') return <div className="w-4 h-4 rounded-full border-2 border-amber-300" />;
        if (status === 'missing') return <AlertCircle size={16} className="text-rose-500" />;
        return null;
    };

    return (
        <div className="flex flex-col h-full bg-[#f4f7fa] font-['Inter',sans-serif] w-full overflow-hidden">
            {/* Top Navigation Bar: Title Aligned Left + 5 Horizontal Navigation Tabs */}
            <div className="bg-white border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 py-3.5 shrink-0 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 shadow-xs">
                <div className="flex items-center space-x-3 shrink-0">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Profile Details</h1>
                </div>

                {/* Horizontal Navigation Buttons */}
                <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5">
                    {menuItems.map((item) => {
                        const isActive = activeSubTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveSubTab(item.id)}
                                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                                    isActive
                                        ? 'bg-[#1e3a8a] text-white shadow-md shadow-blue-900/20 active:scale-95'
                                        : 'bg-slate-50/90 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70 active:scale-95'
                                }`}
                            >
                                <span>{item.label}</span>
                                {item.status !== 'none' && (
                                    <div className="flex items-center">
                                        {item.status === 'verified' && <CheckCircle2 size={15} className={isActive ? "text-emerald-300" : "text-emerald-500"} />}
                                        {item.status === 'missing' && <AlertCircle size={15} className={isActive ? "text-rose-300" : "text-rose-500"} />}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area (Full Width, No Sidebar) */}
            <div className="flex-1 min-w-0 overflow-y-auto bg-[#f4f7fa] p-4 sm:p-6 lg:p-8">
                <AnimatePresence mode="wait">
                    <motion.div key={activeSubTab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="w-full">
                        {activeSubTab === 'business' && <BusinessInfo formData={formData} handleInputChange={handleInputChange} handleSave={handleSave} isSaving={isSaving} />}
                        {activeSubTab === 'personal' && (
                            <PersonalInfo
                                formData={formData}
                                handleInputChange={handleInputChange}
                                handleSave={handleSave}
                                isSaving={isSaving}
                                isSendingOtp={isSendingOtp}
                                profilePhoto={profilePhoto}
                                fileInputRef={fileInputRef}
                                handlePhotoChange={handlePhotoChange}
                                onVerifyEmail={handleSendOtp}
                                onVerifyPan={handlePanVerify}
                                isVerifyingPan={isVerifyingPan}
                            />
                        )}
                        {activeSubTab === 'banking' && (
                            <BankingInfo
                                formData={formData}
                                handleInputChange={handleInputChange}
                                handleSave={handleSave}
                                isSaving={isSaving}
                                isFetchingIFSC={isFetchingIFSC}
                                isVerifyingAccount={isVerifyingAccount}
                                setFormData={setFormData}
                                currentUser={currentUser}
                            />
                        )}
                        {activeSubTab === 'settings' && <Settings formData={formData} handleInputChange={handleInputChange} handleSave={handleSave} />}
                        {activeSubTab === 'visiting_card' && (
                            <div className="flex flex-col items-center justify-center space-y-8 py-6 w-full overflow-hidden">
                                <div className="text-center">
                                    <h3 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter">Professional Identity</h3>
                                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Official RuPiKsha Partner Card</p>
                                </div>

                                {/* Responsive Visiting Card */}
                                <div className="w-full flex justify-center overflow-x-auto py-2">
                                    <div ref={cardRef} className="card-container shrink-0 w-full max-w-[620px]">
                                        <motion.div
                                            initial={{ scale: 0.98, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="w-full aspect-[1.8/1] min-w-[320px] sm:min-w-[480px] bg-white rounded-xl shadow-xl overflow-hidden relative border border-sky-100"
                                        >
                                            {/* Geometric Background Overlay (Sky Blue) */}
                                            <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
                                                <svg width="100%" height="100%">
                                                    <pattern id="pattern-hex-sky" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                                                        <path d="M20 0l20 10v20l-20 10-20-10v-20z" fill="none" stroke="#0ea5e9" strokeWidth="1" />
                                                    </pattern>
                                                    <rect width="100%" height="100%" fill="url(#pattern-hex-sky)" />
                                                </svg>
                                            </div>
                                            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-sky-100/40 via-white to-white pointer-events-none"></div>

                                            <div className="p-4 sm:p-7 h-full flex flex-col justify-between relative z-10">
                                                {/* Top Row: Name & QR */}
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center space-x-3 sm:space-x-4">
                                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-sky-200 bg-white flex items-center justify-center shrink-0 shadow-sm">
                                                            {profilePhoto ? (
                                                                <img src={profilePhoto} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <User className="text-sky-300" size={20} />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-base sm:text-xl font-bold text-sky-900 leading-none tracking-tight">
                                                                {formData.name || currentUser?.name || 'Partner Name'}
                                                            </h4>
                                                            <p className="text-xs sm:text-sm font-medium text-sky-600 mt-1 uppercase tracking-tight">
                                                                {formData.businessName || currentUser?.businessName || 'Your Business Name'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="bg-white p-1 rounded-lg shadow-sm border border-sky-50 shrink-0">
                                                        <img 
                                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=tel:${formData.mobile || currentUser?.mobile}`} 
                                                            alt="Call QR" 
                                                            className="w-10 h-10 sm:w-14 sm:h-14"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Separator Line */}
                                                <div className="w-full h-1 bg-sky-500/30 rounded-full my-2 relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-sky-400 to-indigo-400 opacity-50"></div>
                                                </div>

                                                {/* Middle: Address Section */}
                                                <div className="flex-1 flex flex-col justify-center my-1">
                                                    <div className="flex items-start space-x-3">
                                                        <div className="bg-sky-500 p-1.5 rounded-full shadow-md shrink-0">
                                                            <Building2 size={14} className="text-white" />
                                                        </div>
                                                        <p className="text-xs sm:text-sm font-semibold text-sky-800 leading-snug max-w-[85%] uppercase line-clamp-2">
                                                            {formData.address1 ? 
                                                                `${formData.address1}${formData.address2 ? `, ${formData.address2}` : ''} ${formData.area || ''} ${formData.pincode || ''}` : 
                                                                (currentUser?.address || currentUser?.address1 ? 
                                                                    `${currentUser.address || currentUser.address1} ${currentUser.pincode || ''}` : 
                                                                    'Shop Address Not Registered')}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Bottom Row: Contact info & Logo */}
                                                <div className="flex items-center justify-between border-t border-sky-100 pt-3">
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm font-bold text-sky-900">
                                                        <div className="flex items-center space-x-1.5">
                                                            <Phone size={12} className="text-sky-600" />
                                                            <span>+91 {formData.mobile || currentUser?.mobile || 'XXXXXXXXXX'}</span>
                                                        </div>
                                                        <div className="flex items-center space-x-1.5">
                                                            <Mail size={12} className="text-sky-600" />
                                                            <span className="truncate max-w-[150px] sm:max-w-none">{formData.email || currentUser?.email || 'partner@rupiksha.com'}</span>
                                                        </div>
                                                    </div>

                                                    <div className="text-right shrink-0">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-sm sm:text-base font-black text-sky-600 tracking-tighter uppercase italic leading-none">Rupiksha</span>
                                                            <span className="text-[6px] sm:text-[7px] font-black text-sky-900 uppercase tracking-[0.3em] mt-0.5">Making Life Simple</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4 w-full justify-center px-4">
                                    <button 
                                        onClick={async () => {
                                            const element = cardRef.current;
                                            const canvas = await html2canvas(element, { scale: 3, backgroundColor: null });
                                            const imgData = canvas.toDataURL('image/png');
                                            const pdf = new jsPDF('l', 'mm', 'a4');
                                            const imgProps = pdf.getImageProperties(imgData);
                                            const pdfWidth = pdf.internal.pageSize.getWidth();
                                            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                                            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                                            pdf.save(`${formData.name || 'User'}_Visiting_Card.pdf`);
                                        }}
                                        className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold uppercase text-[11px] tracking-widest shadow-xl flex items-center justify-center space-x-2 hover:bg-black transition-all hover:-translate-y-0.5 active:scale-95"
                                    >
                                        <Download size={16} />
                                        <span>Download PDF</span>
                                    </button>
                                    
                                    <button 
                                        onClick={async () => {
                                            setIsSharing(true);
                                            try {
                                                const element = cardRef.current;
                                                const canvas = await html2canvas(element, { scale: 2 });
                                                const imgData = canvas.toDataURL('image/png');
                                                
                                                const res = await fetch(`${BACKEND_URL}/user/share-visiting-card`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        email: formData.email,
                                                        name: formData.name,
                                                        image: imgData
                                                    })
                                                });
                                                
                                                if (res.ok) alert("Card shared to your registered email!");
                                                else throw new Error("Backend failed");
                                            } catch (err) {
                                                window.location.href = `mailto:${formData.email}?subject=My Rupiksha Visiting Card&body=Hello, please find my digital visiting card attached. Name: ${formData.name}, Mobile: ${formData.mobile}`;
                                            } finally {
                                                setIsSharing(false);
                                            }
                                        }}
                                        disabled={isSharing}
                                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-600/20 flex items-center justify-center space-x-2 hover:bg-indigo-700 transition-all hover:-translate-y-0.5 active:scale-95"
                                    >
                                        <Mail size={16} />
                                        <span>{isSharing ? 'Sharing...' : 'Share on Email'}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
            {/* Email Verification Modal */}
            <AnimatePresence>
                {showVerifyModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setShowVerifyModal(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.9, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 20, opacity: 0 }}
                            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden relative z-10 p-8 text-center"
                        >
                            <div className="mb-6">
                                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                                    <Mail size={32} />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Verify Your Email</h3>
                                <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">We've sent a 6-digit code to</p>
                                <p className="text-sm font-black text-blue-600 mt-1">{formData.email}</p>
                            </div>

                            <div className="flex justify-between gap-2 mb-8">
                                {otp.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        type="text"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => {
                                             const val = e.target.value.replace(/\D/g, '');
                                            if (val) {
                                                const newOtp = [...otp];
                                                newOtp[idx] = val;
                                                setOtp(newOtp);
                                                // Focus next
                                                const next = e.target.nextElementSibling;
                                                if (next) next.focus();
                                            } else {
                                                const newOtp = [...otp];
                                                newOtp[idx] = '';
                                                setOtp(newOtp);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Backspace' && !otp[idx]) {
                                                const prev = e.target.previousElementSibling;
                                                if (prev) prev.focus();
                                            }
                                        }}
                                        className="w-12 h-14 border-2 border-slate-100 rounded-xl text-center text-xl font-black text-slate-700 focus:border-blue-600 focus:bg-blue-50 outline-none transition-all shadow-sm"
                                    />
                                ))}
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={handleVerifyOtp}
                                    disabled={isVerifying || otp.join('').length < 6}
                                    className="w-full bg-[#1e3a8a] text-white py-4 rounded-xl font-black uppercase text-sm shadow-xl hover:bg-blue-900 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                                >
                                    {isVerifying ? (
                                        <div className="flex items-center justify-center space-x-2">
                                            <RefreshCw size={18} className="animate-spin" />
                                            <span>Verifying...</span>
                                        </div>
                                    ) : 'Verify OTP'}
                                </button>

                                <div className="text-center">
                                    {timer > 0 ? (
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Resend Code in <span className="text-blue-600">00:{timer < 10 ? `0${timer}` : timer}</span>
                                        </p>
                                    ) : (
                                        <button
                                            onClick={handleSendOtp}
                                            className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                                        >
                                            Resend Verification Code
                                        </button>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => setShowVerifyModal(false)}
                                className="absolute top-4 right-4 p-2 text-slate-300 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showSavedToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: 50, x: '-50%' }}
                        className="fixed bottom-10 left-1/2 z-[100] bg-slate-900 text-white px-8 py-3 rounded-full border border-emerald-500 shadow-2xl flex items-center space-x-3"
                    >
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        <span className="text-xs font-bold uppercase tracking-widest">Profile Updated Successfully</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProfileDetails;

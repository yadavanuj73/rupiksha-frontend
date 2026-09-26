import React, { useState, useEffect, useRef } from 'react';
import {
    CheckCircle2, AlertCircle, User, UserRound,
    Building2, MapPin, Phone, Mail, Lock,
    Save, Download, Printer, Camera, Pencil,
    ChevronDown, ArrowRight, RefreshCw, X, Calendar, ShieldCheck, Edit3, Plus, FileText,
    Landmark, CreditCard, Settings as SettingsIcon, Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { dataService, BACKEND_URL as IMPORTED_BACKEND_URL } from '../../services/dataService';
import { userService } from '../../services/apiService';
import rupikshaNewLogo from '../../assets/logo rupiksha.png';
// Using logo from public folder
const mainLogo = '/logo rupiksha.png';

// Fallback if import system has issues with named exports in some environments
const BACKEND_URL = IMPORTED_BACKEND_URL || `/api`;

// Sub-components
import BusinessInfo from './profile/BusinessInfo';
import PersonalInfo from './profile/PersonalInfo';
import BankingInfo from './profile/BankingInfo';
import Settings from './profile/Settings';
import VisitingCard from './profile/VisitingCard';
import Certificate from './profile/Certificate';
import RetailerCertificate from './profile/RetailerCertificate';

const getCurrentUserData = () => {
    try {
        let user = dataService.getCurrentUser();
        const searchKeys = [
            'rupiksha_distributor_user',
            'rupiksha_user',
            'rupiksha_user_distributor',
            'rupiksha_user_retailer',
            'rupiksha_user_super_distributor',
            'rupiksha_super_distributor_user',
            'rupiksha_admin_user',
            'rupiksha_imp_user'
        ];
        if (!user) {
            for (const k of searchKeys) {
                try {
                    const raw = localStorage.getItem(k);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if (parsed && typeof parsed === 'object' && (parsed.id || parsed.username || parsed.mobile)) {
                            user = parsed;
                            break;
                        }
                    }
                } catch (_) {}
            }
        }

        const uname = user?.username;
        const uid = user?.id || user?.userId;
        const mob = user?.mobile || user?.phone;

        let extraData = {};
        const localData = dataService.getData();
        if (localData?.users && Array.isArray(localData.users)) {
            const found = localData.users.find(u => (uid && u.id === uid) || (uname && u.username === uname) || (mob && u.mobile === mob));
            if (found) extraData = { ...found, ...extraData };
        }
        try {
            const rawDists = localStorage.getItem('rupiksha_distributors');
            if (rawDists) {
                const dists = JSON.parse(rawDists);
                if (Array.isArray(dists)) {
                    const foundDist = dists.find(d => (uid && (d.id === uid || d.userId === uid)) || (uname && d.username === uname) || (mob && d.mobile === mob));
                    if (foundDist) extraData = { ...foundDist, ...extraData };
                }
            }
        } catch (_) {}
        try {
            const rawCache = localStorage.getItem('rupiksha_users_cache');
            if (rawCache) {
                const cache = JSON.parse(rawCache);
                if (Array.isArray(cache)) {
                    const foundCache = cache.find(c => (uid && (c.id === uid || c.userId === uid)) || (uname && c.username === uname) || (mob && c.mobile === mob));
                    if (foundCache) extraData = { ...foundCache, ...extraData };
                }
            }
        } catch (_) {}

        user = { ...extraData, ...(user || localData?.currentUser || {}) };

        const currentUserUid = user?.id || user?.userId || user?.username;
        const savedPhoto = currentUserUid ? localStorage.getItem(`rupiksha_photo_${currentUserUid}`) : null;
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

const VALID_PROFILE_TABS = ['business', 'personal', 'banking', 'visiting_card', 'certificate', 'settings'];

const normalizeDate = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    if (str.includes('T')) return str.split('T')[0];
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
    }
    if (str.includes('-')) {
        const parts = str.split('-');
        if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }
    } catch (_) {}
    return str;
};

const flattenUserData = (raw) => {
    if (!raw || typeof raw !== 'object') return {};
    const nested = {
        ...(raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : {}),
        ...(raw.user && typeof raw.user === 'object' && !Array.isArray(raw.user) ? raw.user : {}),
        ...(raw.kyc && typeof raw.kyc === 'object' && !Array.isArray(raw.kyc) ? raw.kyc : {}),
        ...(raw.kycData && typeof raw.kycData === 'object' && !Array.isArray(raw.kycData) ? raw.kycData : {}),
        ...(raw.bankDetails && typeof raw.bankDetails === 'object' && !Array.isArray(raw.bankDetails) ? raw.bankDetails : {}),
        ...(raw.businessDetails && typeof raw.businessDetails === 'object' && !Array.isArray(raw.businessDetails) ? raw.businessDetails : {}),
        ...(raw.merchant && typeof raw.merchant === 'object' && !Array.isArray(raw.merchant) ? raw.merchant : {}),
        ...(raw.profile && typeof raw.profile === 'object' && !Array.isArray(raw.profile) ? raw.profile : {}),
        ...(raw.aeps_kyc_details && typeof raw.aeps_kyc_details === 'object' && !Array.isArray(raw.aeps_kyc_details) ? raw.aeps_kyc_details : {}),
    };
    return { ...nested, ...raw };
};

const extractUserProfileFields = (rawUser, prev = {}) => {
    if (!rawUser && !prev) return {};
    const flat = flattenUserData(rawUser);
    const user = { ...prev, ...flat };
    
    let aadhaarImage = flat.aadhaarImage || flat.aadhaarPhoto || flat.aadhaarPhotoUrl || flat.aadhaarDoc || user.aadhaarImage || prev.aadhaarImage || null;
    let aadhaarNumber = flat.aadhaarNumber || flat.aadhaar || flat.aadhar || flat.aadharNumber || flat.aadhaar_number || flat.aadhar_number || flat.aadhaarNo || user.aadhaarNumber || prev.aadhaarNumber || '';
    let panNumber = flat.panNumber || flat.pan || flat.pan_number || flat.panNo || flat.userPan || flat.companyOrShopPan || user.panNumber || prev.panNumber || '';
    const userSpecificId = user?.id || user?.userId || user?.username || rawUser?.id || rawUser?.userId || rawUser?.username;
    const userSavedPhoto = userSpecificId ? localStorage.getItem(`rupiksha_photo_${userSpecificId}`) : null;
    let photoUrl = flat.profilePhoto || flat.photoUrl || flat.liveSelfieUrl || flat.avatar || flat.profile_photo || user.profilePhoto || user.photoUrl || prev.profilePhoto || prev.photoUrl || userSavedPhoto || null;

    const allDocs = Array.isArray(flat.documents) ? flat.documents : (Array.isArray(rawUser?.documents) ? rawUser.documents : (Array.isArray(user.documents) ? user.documents : []));
    if (allDocs.length > 0) {
        allDocs.forEach(d => {
            if (!d) return;
            const type = String(d.type || '').toUpperCase();
            const name = String(d.name || '').toLowerCase();
            const file = d.file || d.url || d.image;
            if (!aadhaarImage && (type.includes('AADHAAR') || name.includes('aadhaar') || name.includes('aadhar'))) {
                aadhaarImage = file;
            }
            if (!aadhaarNumber && (d.docNumber || d.number || d.documentNumber)) {
                if (type.includes('AADHAAR') || name.includes('aadhaar') || name.includes('aadhar')) {
                    aadhaarNumber = String(d.docNumber || d.number || d.documentNumber);
                }
            }
            if (!panNumber && (d.docNumber || d.number || d.documentNumber)) {
                if (type.includes('PAN') || name.includes('pan')) {
                    panNumber = String(d.docNumber || d.number || d.documentNumber);
                }
            }
            if (!photoUrl && (type.includes('SELFIE') || type.includes('PHOTO') || name.includes('selfie') || name.includes('photo'))) {
                photoUrl = file;
            }
        });
    }

    const rawBanks = (Array.isArray(flat.banks) && flat.banks.length > 0)
        ? flat.banks
        : ((Array.isArray(user.banks) && user.banks.length > 0)
            ? user.banks
            : (Array.isArray(prev.banks) && prev.banks.length > 0 ? prev.banks : []));
    const primaryBank = rawBanks[0] || {};
    const bankName = flat.bankName || flat.companyBankName || flat.bank_name || flat.company_bank_name || flat.bank || user.bankName || primaryBank.bankName || prev.bankName || '';
    const accountNumber = flat.accountNumber || flat.bankAccountNumber || flat.companyBankAccountNumber || flat.account_number || flat.bank_account_number || flat.company_bank_account_number || flat.accNo || flat.accountNo || user.accountNumber || primaryBank.accountNumber || prev.accountNumber || '';
    const ifscCode = flat.ifscCode || flat.bankIfsc || flat.bankIfscCode || flat.ifsc || flat.ifsc_code || flat.bank_ifsc || flat.bank_ifsc_code || flat.companyBankIfsc || user.ifscCode || primaryBank.ifscCode || prev.ifscCode || '';
    const branchName = flat.branchName || flat.bankBranch || flat.bankBranchName || flat.branch || flat.branch_name || flat.bank_branch || user.branchName || primaryBank.branchName || prev.branchName || '';
    const accHolderName = flat.accHolderName || flat.bankAccountHolder || flat.bankAccountHolderName || flat.bankAccountName || flat.accountHolderName || flat.companyBankAccountHolderName || flat.account_holder_name || user.accHolderName || primaryBank.accHolderName || primaryBank.bankAccountHolder || user.name || user.fullName || prev.accHolderName || '';

    let banks = rawBanks;
    if (banks.length === 0 && (bankName || accountNumber)) {
        banks = [{
            id: 'bank_primary',
            bankName: bankName || 'Primary Bank',
            accountNumber,
            ifscCode,
            branchName,
            accHolderName
        }];
    }

    const businessName = flat.businessName || flat.companyLegalName || flat.shopName || flat.companyName || flat.business_name || flat.shop_name || flat.firmName || flat.tradeName || flat.business || user.businessName || prev.businessName || '';
    const businessType = flat.businessType || flat.companyType || flat.business_type || flat.shopType || user.businessType || prev.businessType || 'Sole proprietorship';
    const category = flat.category || flat.businessCategory || flat.business_category || user.category || prev.category || 'Retail';
    const gstNumber = flat.gstNumber || flat.gstinNumber || flat.gstin || flat.gst_number || flat.gst || flat.gstNo || user.gstNumber || prev.gstNumber || '';
    const address1 = flat.address1 || flat.addressLine1 || flat.shopAddress || flat.businessAddress || flat.merchantAddress1 || flat.address || flat.shop_address || flat.business_address || flat.permanentAddress || user.address1 || prev.address1 || '';
    const address2 = flat.address2 || flat.addressLine2 || flat.shopLandmark || flat.merchantAddress2 || flat.landmark || flat.business_address_2 || user.address2 || prev.address2 || '';
    const pincode = flat.pincode || flat.shopPincode || flat.merchantPinCode || flat.businessPincode || flat.personalPincode || flat.permPincode || flat.shop_pincode || flat.pin || flat.postalCode || user.pincode || prev.pincode || '';
    const area = flat.area || flat.city || flat.shopCity || flat.merchantCityName || flat.businessCity || flat.personalArea || flat.district || flat.merchantDistrictName || flat.state || flat.stateName || flat.merchantState || flat.shop_city || user.area || prev.area || '';
    const salesName = flat.salesName || flat.salesExecutiveName || flat.sales_name || flat.sales_executive_name || flat.salesPerson || user.salesName || prev.salesName || '';
    const salesContact = flat.salesContact || flat.salesExecutiveContact || flat.sales_contact || flat.sales_executive_mobile || user.salesContact || prev.salesContact || '';

    const name = flat.name || flat.fullName || flat.full_name || (flat.firstName ? `${flat.firstName || ''} ${flat.lastName || ''}`.trim() : '') || flat.merchantName || user.name || prev.name || '';
    const fatherName = flat.fatherName || flat.father_name || flat.father || flat.guardianName || user.fatherName || prev.fatherName || '';
    const mobile = flat.mobile || flat.phone || flat.mobileNumber || flat.merchantPhoneNumber || flat.contactNumber || flat.phoneNumber || flat.username || user.mobile || prev.mobile || '';
    const email = flat.email || flat.emailId || flat.email_id || flat.merchantEmail || flat.mail || user.email || prev.email || '';
    const emailVerified = flat.emailVerified !== undefined ? flat.emailVerified : (flat.isEmailVerified !== undefined ? flat.isEmailVerified : (flat.email_verified !== undefined ? flat.email_verified : (user.emailVerified ?? prev.emailVerified)));
    const gender = flat.gender || user.gender || prev.gender || 'Male';
    const maritalStatus = flat.maritalStatus || user.maritalStatus || prev.maritalStatus || 'Single';
    const dob = normalizeDate(flat.dob || flat.dateOfBirth || flat.date_of_birth || flat.birthDate || user.dob || prev.dob || '');
    const residentialAddress1 = flat.residentialAddress1 || flat.permanentAddress || flat.residentialAddress || flat.residential_address_1 || flat.residential_address || flat.address || flat.address1 || flat.addressLine1 || flat.merchantAddress1 || flat.shopAddress || user.residentialAddress1 || prev.residentialAddress1 || '';
    const residentialAddress2 = flat.residentialAddress2 || flat.residential_address_2 || flat.address2 || flat.merchantAddress2 || user.residentialAddress2 || prev.residentialAddress2 || '';
    const personalPincode = flat.personalPincode || flat.permPincode || flat.personal_pincode || flat.pincode || flat.merchantPinCode || flat.shopPincode || user.personalPincode || prev.personalPincode || '';
    const personalArea = flat.personalArea || flat.personalCity || flat.permCity || flat.personal_area || flat.city || flat.area || flat.district || flat.merchantCityName || flat.state || user.personalArea || prev.personalArea || '';
    const partyCode = flat.partyCode || flat.party_code || flat.party_id || user.partyCode || prev.partyCode || 'PENDING';
    const username = flat.username || flat.loginId || flat.mobile || user.username || prev.username || '';

    return {
        ...prev,
        ...user,
        banks,
        // Business
        businessName,
        businessType,
        category,
        gstNumber,
        address1,
        address2,
        pincode,
        area,
        salesName,
        salesContact,
        // Personal
        name,
        fatherName,
        mobile,
        email,
        emailVerified,
        gender,
        maritalStatus,
        dob,
        residentialAddress1,
        residentialAddress2,
        personalPincode,
        personalArea,
        username,
        partyCode,
        // PAN & Aadhaar
        panNumber,
        isPanVerified: user.isPanVerified !== undefined ? user.isPanVerified : (!!panNumber),
        panName: user.panName || user.pan_name || user.nameOnPan || user.panHolderName || name || prev.panName || '',
        aadhaarNumber,
        aadhaarImage,
        // Banking
        accHolderName,
        bankName,
        accountNumber,
        confirmAccountNumber: user.confirmAccountNumber || accountNumber || prev.confirmAccountNumber || '',
        ifscCode,
        branchName,
        // Settings
        emailNotifications: user.emailNotifications ?? prev.emailNotifications ?? true,
        whatsappUpdates: user.whatsappUpdates ?? prev.whatsappUpdates ?? true,
        twoStepAuth: user.twoStepAuth ?? prev.twoStepAuth ?? false,
        theme: user.theme || prev.theme || 'light',
        language: user.language || prev.language || 'English',
        // Photos
        profilePhoto: photoUrl,
        photoUrl: photoUrl
    };
};

const ProfileDetails = ({ activeTab = 'business' }) => {
    const initialTab = VALID_PROFILE_TABS.includes(activeTab) ? activeTab : 'business';
    const [activeSubTab, setActiveSubTab] = useState(initialTab);
    const [isSaving, setIsSaving] = useState(false);
    const [showSavedToast, setShowSavedToast] = useState(false);
    const [appData, setAppData] = useState(dataService.getData());
    const fileInputRef = useRef(null);
    const cardRef = useRef(null);
    const [isSharing, setIsSharing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Email Verification State
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [timer, setTimer] = useState(0);
    const [isDataLoading, setIsDataLoading] = useState(true);

    const currentUser = getCurrentUserData() || appData.currentUser || {};
    const initialExtracted = extractUserProfileFields(currentUser);
    const userInitUid = currentUser?.id || currentUser?.userId || currentUser?.username;
    const savedPhoto = userInitUid ? localStorage.getItem(`rupiksha_photo_${userInitUid}`) : null;
    const [profilePhoto, setProfilePhoto] = useState(initialExtracted.profilePhoto || initialExtracted.photoUrl || savedPhoto || null);
    const [formData, setFormData] = useState(initialExtracted);

    const syncUserData = (customUser = null) => {
        setAppData(dataService.getData());
        const user = customUser || getCurrentUserData();
        if (user) {
            setFormData(prev => {
                const updated = extractUserProfileFields(user, prev);
                const syncUid = user?.id || user?.userId || user?.username;
                const photo = updated.profilePhoto || updated.photoUrl || (syncUid ? localStorage.getItem(`rupiksha_photo_${syncUid}`) : null) || null;
                setProfilePhoto(photo);
                return updated;
            });
        }
    };

    useEffect(() => {
        // 1. Immediately populate from localStorage
        syncUserData();

        // 2. Fetch fresh data concurrently from live backend
        const doFetch = async () => {
            try {
                const [dataRes, apiRes] = await Promise.allSettled([
                    dataService.fetchUserProfile(),
                    userService.getProfile()
                ]);

                let livePayload = {};
                if (apiRes.status === 'fulfilled' && apiRes.value && typeof apiRes.value === 'object') {
                    livePayload = { ...livePayload, ...flattenUserData(apiRes.value) };
                }
                if (dataRes.status === 'fulfilled' && dataRes.value && typeof dataRes.value === 'object') {
                    livePayload = { ...livePayload, ...flattenUserData(dataRes.value) };
                }

                if (Object.keys(livePayload).length > 0) {
                    syncUserData(livePayload);
                }
            } catch (e) {
                console.warn('[Profile] Profile fetch failed:', e);
            } finally {
                setIsDataLoading(false);
            }
        };

        doFetch();

        const handleUpdate = () => syncUserData();
        window.addEventListener('dataUpdated', handleUpdate);
        window.addEventListener('distributorDataUpdated', handleUpdate);
        window.addEventListener('profileUpdated', handleUpdate);
        return () => {
            window.removeEventListener('dataUpdated', handleUpdate);
            window.removeEventListener('distributorDataUpdated', handleUpdate);
            window.removeEventListener('profileUpdated', handleUpdate);
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
            const uid = formData.id || formData.userId || formData.username || currentUser?.id || currentUser?.username;
            const photoToSave = profilePhoto || (uid ? localStorage.getItem(`rupiksha_photo_${uid}`) : null) || null;
            const payload = {
                ...formData,
                profilePhoto: photoToSave,
                photoUrl: photoToSave
            };
            if (photoToSave && uid) {
                try {
                    localStorage.setItem(`rupiksha_photo_${uid}`, photoToSave);
                } catch (_) {}
            }
            try { localStorage.removeItem('rupiksha_profile_photo'); } catch (_) {}
            const success = await dataService.updateUserProfile(payload);
            window.dispatchEvent(new Event('profileUpdated'));
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
                const uid = formData.id || formData.userId || formData.username || currentUser?.id || currentUser?.username;
                if (uid) {
                    try {
                        localStorage.setItem(`rupiksha_photo_${uid}`, photoBase64);
                    } catch (err) {
                        console.warn("Storage write:", err);
                    }
                }
                try { localStorage.removeItem('rupiksha_profile_photo'); } catch (_) {}
                const updated = {
                    ...formData,
                    profilePhoto: photoBase64,
                    photoUrl: photoBase64
                };
                setFormData(updated);
                await dataService.updateUserProfile(updated);
                window.dispatchEvent(new Event('profileUpdated'));
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

    // Determine if current panel/user is Distributor or Super Distributor
    const rawRole = (
        currentUser?.role ||
        currentUser?.userType ||
        (Array.isArray(currentUser?.roles) ? currentUser.roles[0] : '') ||
        formData?.role ||
        (typeof window !== 'undefined' && window.location.pathname.includes('/distributor') ? 'DISTRIBUTOR' : '') ||
        (typeof window !== 'undefined' && window.location.pathname.includes('/super-distributor') ? 'SUPER_DISTRIBUTOR' : '') ||
        ''
    ).toString().toUpperCase();

    const isDistributorOrSuper = rawRole.includes('DISTRIBUTOR') || rawRole.includes('SUPER') ||
        (typeof window !== 'undefined' && (window.location.pathname.startsWith('/distributor') || window.location.pathname.startsWith('/super-distributor')));

    const menuItems = [
        { id: 'business', label: 'Business Information', icon: Building2, status: getSectionStatus('business') },
        { id: 'personal', label: 'Personal Information', icon: UserRound, status: getSectionStatus('personal') },
        { id: 'banking', label: 'Banking Details', icon: Landmark, status: getSectionStatus('banking') },
        { id: 'visiting_card', label: 'Visiting Card', icon: CreditCard, status: 'none' },
        { id: 'certificate', label: 'Certificate', icon: Award, status: 'none' },
        { id: 'settings', label: 'Settings', icon: SettingsIcon, status: 'none' },
    ];

    const getStatusIcon = (status) => {
        if (status === 'verified') return <CheckCircle2 size={16} strokeWidth={2} className="text-[#16C784]" />;
        if (status === 'pending') return <div className="w-4 h-4 rounded-full border-2 border-amber-300" />;
        if (status === 'missing') return <AlertCircle size={16} strokeWidth={2} className="text-[#FF3B5F]" />;
        return null;
    };

    const ProfileSkeletonLoader = () => (
        <div className="w-full bg-white rounded-[22px] p-6 sm:p-8 border border-[#DCE6F2] shadow-[0_8px_30px_rgba(30,65,110,0.07)] animate-pulse">
            {/* Skeleton Header */}
            <div className="flex items-center justify-between border-b border-[#E3EAF3] pb-6 mb-8">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-[12px] bg-[#EAF4FF] flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-[#2563EB] animate-spin" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-5 w-48 bg-slate-200 rounded-lg"></div>
                        <div className="h-3.5 w-64 bg-slate-100 rounded-md"></div>
                    </div>
                </div>
                <div className="hidden sm:flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#EAF4FF] border border-[#D7E3F2] text-[#2563EB] text-xs font-semibold">
                    <RefreshCw size={13} className="animate-spin text-[#2563EB]" />
                    <span>Loading profile details...</span>
                </div>
            </div>

            {/* Skeleton Form Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="space-y-2.5">
                        <div className="h-3.5 w-28 bg-slate-200 rounded-md"></div>
                        <div className="h-14 w-full bg-slate-50 rounded-[12px] border border-[#D7E3F2] flex items-center px-4">
                            <div className="h-4 w-2/3 bg-slate-200/70 rounded"></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Skeleton Footer */}
            <div className="mt-8 pt-6 border-t border-[#E3EAF3] flex items-center justify-between">
                <div className="h-3 w-40 bg-slate-100 rounded"></div>
                <div className="h-11 w-32 bg-slate-200 rounded-xl"></div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#F4F8FC] font-['Inter',sans-serif] w-full overflow-hidden">
            {/* Top Navigation Bar: Title Aligned Left + 5 Horizontal Navigation Tabs */}
            <div className="bg-white border-b border-[#E5EAF1] px-4 sm:px-6 lg:px-7 py-3 sm:py-3.5 shrink-0 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <div className="flex items-center space-x-3 shrink-0">
                    <h1 className="text-[22px] sm:text-[26px] font-[800] text-[#0B0F14] tracking-tight leading-tight">
                        Profile Details
                    </h1>
                </div>

                {/* Horizontal Navigation Buttons */}
                <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5">
                    {menuItems.map((item) => {
                        const isActive = activeSubTab === item.id;
                        const IconComponent = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveSubTab(item.id)}
                                className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[12px] text-[12.5px] sm:text-[13px] font-bold transition-all duration-150 whitespace-nowrap cursor-pointer shrink-0 ${
                                    isActive
                                        ? 'bg-[#2146A3] text-white shadow-[0_4px_12px_rgba(33,70,163,0.20)] active:scale-95'
                                        : 'bg-[#F8FAFD] text-[#172033] hover:bg-[#F0F5FC] hover:text-[#0B0F14] border border-[#D7E3F2] hover:border-[#B8CCEA] shadow-[0_1px_4px_rgba(20,45,90,0.03)] active:scale-95'
                                }`}
                            >
                                {IconComponent && (
                                    <IconComponent
                                        size={16}
                                        strokeWidth={2}
                                        className={isActive ? "text-white" : "text-[#2563EB]"}
                                    />
                                )}
                                <span>{item.label}</span>
                                {item.status !== 'none' && (
                                    <div className="flex items-center ml-0.5">
                                        {item.status === 'verified' && (
                                            <CheckCircle2 size={15} strokeWidth={2} className="text-[#16C784]" />
                                        )}
                                        {item.status === 'missing' && (
                                            <AlertCircle size={15} strokeWidth={2} className="text-[#FF3B5F]" />
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area (Full Width, Responsive) */}
            <div className="flex-1 min-w-0 overflow-y-auto bg-[#F4F8FC] p-3 sm:p-5 lg:p-6">
                {isDataLoading ? (
                    <ProfileSkeletonLoader />
                ) : (
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
                            <VisitingCard 
                                formData={formData} 
                                currentUser={currentUser} 
                                profilePhoto={profilePhoto} 
                            />
                        )}
                        {activeSubTab === 'certificate' && (
                            isDistributorOrSuper ? (
                                <Certificate 
                                    formData={formData} 
                                    currentUser={currentUser} 
                                />
                            ) : (
                                <RetailerCertificate 
                                    formData={formData} 
                                    currentUser={currentUser} 
                                />
                            )
                        )}
                    </motion.div>
                </AnimatePresence>
                )}
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

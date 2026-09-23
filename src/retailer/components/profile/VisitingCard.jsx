import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, Download, Mail, Phone, Building2, RefreshCw, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import rupikshaNewLogo from '../../../assets/logo rupiksha.png';
import { BACKEND_URL as IMPORTED_BACKEND_URL } from '../../../services/dataService';

const BACKEND_URL = IMPORTED_BACKEND_URL || `/api`;

const VisitingCard = ({ formData, currentUser, profilePhoto }) => {
    const cardRef = useRef(null);
    const printCardRef = useRef(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [safePhotoUrl, setSafePhotoUrl] = useState(null);
    const [safeLogoUrl, setSafeLogoUrl] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    // 1. Detect dynamic role
    const getPartnerRoleTitle = () => {
        const rawRole = (
            currentUser?.role ||
            currentUser?.userType ||
            (Array.isArray(currentUser?.roles) ? currentUser.roles[0] : '') ||
            ''
        ).toString().toUpperCase();

        if (rawRole.includes('SUPER')) return 'Super Distributor';
        if (rawRole.includes('DISTRIBUTOR')) return 'Distributor';
        if (rawRole.includes('ADMIN')) return 'Admin Partner';
        return 'Retailer';
    };

    const partnerRole = getPartnerRoleTitle();
    const partnerName = formData?.name || currentUser?.name || currentUser?.fullName || 'RuPiksha Partner';
    const partnerShop = formData?.businessName || currentUser?.businessName || currentUser?.shopName || 'Your Business Name';
    
    const partnerAddress = formData?.address1 ? 
        `${formData.address1}${formData.address2 ? `, ${formData.address2}` : ''} ${formData.area || ''} ${formData.city || ''} ${formData.state || ''} ${formData.pincode || ''}`.replace(/\s+/g, ' ').trim() : 
        (currentUser?.address || currentUser?.address1 ? 
            `${currentUser.address || currentUser.address1} ${currentUser.pincode || ''}`.replace(/\s+/g, ' ').trim() : 
            'Shop Address Not Registered');

    const partnerMobile = formData?.mobile || currentUser?.mobile ? `+91 ${formData.mobile || currentUser?.mobile}` : '';
    const partnerEmail = formData?.email || currentUser?.email || 'partner@rupiksha.com';

    // 2. Multiline QR text format
    const qrCardData = [
        'Rupiksha Partner',
        partnerName,
        partnerRole,
        partnerShop,
        partnerAddress,
        partnerMobile,
        partnerEmail
    ].filter(Boolean).join('\n');

    // 3. Pre-generate QR code in memory (100% local Base64, 0 CORS)
    useEffect(() => {
        let isMounted = true;
        QRCode.toDataURL(qrCardData, {
            width: 360,
            margin: 1,
            color: {
                dark: '#0B1833',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
        })
        .then((url) => {
            if (isMounted) setQrCodeDataUrl(url);
        })
        .catch((err) => {
            console.error('[VisitingCard] QR Generation Error:', err);
        });

        return () => {
            isMounted = false;
        };
    }, [qrCardData]);

    // 4. Convert logo to safe Data URL for guaranteed canvas rendering
    useEffect(() => {
        const img = new Image();
        img.src = rupikshaNewLogo;
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || 300;
                canvas.height = img.naturalHeight || 300;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                setSafeLogoUrl(canvas.toDataURL('image/png'));
            } catch {
                setSafeLogoUrl(rupikshaNewLogo);
            }
        };
        img.onerror = () => setSafeLogoUrl(rupikshaNewLogo);
    }, []);

    // 5. Convert profile photo safely
    useEffect(() => {
        if (!profilePhoto) {
            setSafePhotoUrl(null);
            return;
        }
        if (profilePhoto.startsWith('data:')) {
            setSafePhotoUrl(profilePhoto);
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || 200;
                canvas.height = img.naturalHeight || 200;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                setSafePhotoUrl(canvas.toDataURL('image/png'));
            } catch {
                setSafePhotoUrl(profilePhoto);
            }
        };
        img.onerror = () => setSafePhotoUrl(profilePhoto);
        img.src = profilePhoto;
    }, [profilePhoto]);

    // 6. Download exact 1:1 High-Res Visiting Card (Standard 85.6mm x 54mm)
    const handleDownloadCard = async () => {
        const targetElement = printCardRef.current || cardRef.current;
        if (!targetElement || isDownloading) return;
        setIsDownloading(true);

        try {
            const canvas = await html2canvas(targetElement, {
                scale: 3,
                backgroundColor: '#ffffff',
                useCORS: true,
                allowTaint: true,
                logging: false,
                windowWidth: 1011,
                windowHeight: 638,
            });

            const imgData = canvas.toDataURL('image/png', 1.0);

            // Exact standard ID-1 card size: 85.6mm x 54.0mm
            const cardWidthMM = 85.6;
            const cardHeightMM = 54.0;

            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: [cardWidthMM, cardHeightMM]
            });

            pdf.addImage(imgData, 'PNG', 0, 0, cardWidthMM, cardHeightMM, undefined, 'FAST');
            const safeName = (partnerName || 'RuPiksha_Partner').replace(/[^a-zA-Z0-9_-]/g, '_');
            pdf.save(`${safeName}_Visiting_Card.pdf`);
        } catch (err) {
            console.error('[VisitingCard] Download error:', err);
            alert("Could not generate card. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleShareEmail = async () => {
        const targetElement = printCardRef.current || cardRef.current;
        if (!targetElement) return;
        setIsSharing(true);
        try {
            const canvas = await html2canvas(targetElement, { scale: 2, useCORS: true, allowTaint: true });
            const imgData = canvas.toDataURL('image/png');

            const res = await fetch(`${BACKEND_URL}/user/share-visiting-card`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData?.email || currentUser?.email,
                    name: partnerName,
                    image: imgData
                })
            });

            if (res.ok) {
                alert("Card shared to your registered email!");
            } else {
                throw new Error("Backend failed");
            }
        } catch (err) {
            window.location.href = `mailto:${formData?.email || currentUser?.email || ''}?subject=My Rupiksha Visiting Card&body=Hello, please find my digital visiting card attached. Name: ${partnerName}, Mobile: ${partnerMobile}`;
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div className="w-full">
            <div className="bg-white rounded-[20px] border border-[#DCE6F2] shadow-[0_4px_20px_rgba(30,65,110,0.06)] p-4 sm:p-6 lg:p-7 relative overflow-hidden w-full">
                {/* Subtle Ambient Blue Accent */}
                <div className="absolute top-0 right-0 w-80 sm:w-96 h-40 bg-gradient-to-bl from-[#EAF4FF] via-[#EAF4FF]/40 to-transparent pointer-events-none rounded-tr-[20px]" />

                {/* Header Area */}
                <div className="flex items-center gap-3 relative z-10 w-full mb-4">
                    <div className="w-10 h-10 rounded-[10px] bg-[#EAF4FF] border border-[#D7E3F2]/60 flex items-center justify-center shrink-0">
                        <CreditCard size={20} strokeWidth={2} className="text-[#1457E6]" />
                    </div>
                    <div>
                        <h2 className="text-[17px] sm:text-[18px] font-[800] text-[#0B1833] tracking-tight leading-tight">
                            Professional Identity
                        </h2>
                        <p className="text-[12px] sm:text-[13px] font-[500] text-[#64748B] mt-0.5">
                            Official RuPiKsha Partner Business Card
                        </p>
                    </div>
                </div>

                {/* Subtle Horizontal Divider */}
                <div className="w-full h-px bg-[#E3EAF3] mb-5 relative z-10" />

                {/* 2-Part Grid: Card Preview (Left) & Actions (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 items-center relative z-10">
                    {/* Part 1 (Left 7 cols): Responsive Visiting Card UI Display */}
                    <div className="lg:col-span-7 flex justify-center w-full">
                        <div ref={cardRef} className="card-container shrink-0 w-full max-w-[540px]">
                            <motion.div
                                initial={{ scale: 0.98, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-full aspect-[1.586/1] bg-gradient-to-br from-[#F8FBFF] via-[#FFFFFF] to-[#FFFFFF] rounded-2xl shadow-[0_10px_30px_rgba(11,24,51,0.1)] overflow-hidden relative border border-[#BFD7FF]"
                            >
                                {/* ── Top-Left Layered Geometric Curves ── */}
                                <svg 
                                    className="absolute top-0 left-0 w-[46%] h-[52%] pointer-events-none z-0" 
                                    viewBox="0 0 240 160" 
                                    preserveAspectRatio="none" 
                                    fill="none"
                                >
                                    <path d="M0 0 L170 0 C125 45 75 100 0 145 Z" fill="#EEF6FF" />
                                    <path d="M0 0 L125 0 C95 40 55 85 0 115 Z" fill="#DCEBFF" />
                                    <path d="M0 0 L88 0 C62 30 35 65 0 90 Z" fill="#60A5FA" opacity="0.45" />
                                    <path d="M0 0 L55 0 C35 22 20 48 0 70 Z" fill="#1457E6" />
                                </svg>

                                {/* ── Bottom-Right Layered Wave Curves ── */}
                                <svg 
                                    className="absolute bottom-0 right-0 w-[72%] h-[65%] pointer-events-none z-0" 
                                    viewBox="0 0 400 200" 
                                    preserveAspectRatio="none" 
                                    fill="none"
                                >
                                    <path d="M0 200 C110 180 210 135 310 75 C355 48 380 25 400 0 L400 200 Z" fill="#EEF6FF" />
                                    <path d="M50 200 C150 185 240 140 330 90 C370 68 388 45 400 20 L400 200 Z" fill="#DCEBFF" />
                                    <path d="M130 200 C210 190 280 150 350 105 C380 85 392 65 400 45 L400 200 Z" fill="#60A5FA" opacity="0.45" />
                                    <path d="M210 200 C270 200 320 168 368 125 C388 108 396 90 400 75 L400 200 Z" fill="#1457E6" />
                                </svg>

                                {/* ── Central Subtle Watermark ── */}
                                <div 
                                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0"
                                    style={{ opacity: 0.08 }}
                                >
                                    <svg width="150" height="150" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="100" cy="100" r="85" stroke="#1457E6" strokeWidth="6" strokeDasharray="14 8" />
                                        <circle cx="100" cy="100" r="65" stroke="#1457E6" strokeWidth="5" strokeDasharray="10 6" />
                                        <circle cx="100" cy="100" r="45" stroke="#1457E6" strokeWidth="4" />
                                        <path d="M80 68 H120 M80 82 H120 M80 68 V110 C80 125 105 125 105 125 L125 145 M105 110 H80" stroke="#1457E6" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <span className="text-[34px] font-[900] text-[#1457E6] tracking-tight -mt-4">
                                        Rupiksha
                                    </span>
                                    <span className="text-[9px] font-bold text-[#1457E6] tracking-[0.2em] uppercase">
                                        Making Life Digital
                                    </span>
                                </div>

                                {/* ── Card Foreground Content ── */}
                                <div className="p-4 sm:p-5 h-full flex flex-col justify-between relative z-10">
                                    {/* Top Section: Avatar, Name, Business, Role Badge & QR Code */}
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            {/* Circular Profile Photo with Blue Ring */}
                                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full p-0.5 bg-white border-[2.5px] border-[#1457E6] shadow-[0_2px_8px_rgba(20,87,230,0.18)] flex items-center justify-center shrink-0 overflow-hidden">
                                                {safePhotoUrl ? (
                                                    <img src={safePhotoUrl} alt={partnerName} className="w-full h-full object-cover rounded-full" />
                                                ) : (
                                                    <div className="w-full h-full bg-[#EEF6FF] rounded-full flex items-center justify-center text-[#1457E6] font-bold text-lg">
                                                        <User size={22} className="text-[#1457E6]" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Name & Business Info */}
                                            <div className="flex flex-col">
                                                <h3 className="text-[15px] sm:text-[17px] font-[900] text-[#0B1833] uppercase tracking-tight leading-snug">
                                                    {partnerName}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                    <span className="text-[12px] sm:text-[13px] font-[800] text-[#1457E6] uppercase tracking-tight">
                                                        {partnerShop}
                                                    </span>
                                                    <span className="text-[9.5px] sm:text-[10.5px] font-[800] text-[#1457E6] bg-[#E0EDFF] border border-[#BFD7FF] px-2 py-0.5 rounded-[6px] uppercase tracking-wide">
                                                        {partnerRole}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Top-Right QR Code Container */}
                                        <div className="bg-white p-1 rounded-xl shadow-[0_2px_10px_rgba(11,24,51,0.06)] border border-[#BFD7FF] shrink-0">
                                            {qrCodeDataUrl ? (
                                                <img 
                                                    src={qrCodeDataUrl} 
                                                    alt="QR" 
                                                    className="w-10 h-10 sm:w-11 sm:h-11 object-contain"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-100 animate-pulse rounded-lg" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Horizontal Divider Line */}
                                    <div className="w-full h-[2px] bg-gradient-to-r from-[#1457E6] via-[#60A5FA] to-[#DCEBFF] my-2 rounded-full" />

                                    {/* Middle: Address Section */}
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#1457E6] flex items-center justify-center shrink-0 shadow-xs">
                                            <Building2 size={13} className="text-white" />
                                        </div>
                                        <p className="text-[10px] sm:text-[11.5px] font-[700] text-[#0B1833] uppercase leading-snug line-clamp-2">
                                            {partnerAddress}
                                        </p>
                                    </div>

                                    {/* Bottom: Contact Info (Left) | Separator | Company Name (Right) */}
                                    <div className="flex items-center justify-between pt-1">
                                        {/* Phone & Email Stack */}
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#1457E6] flex items-center justify-center shrink-0 shadow-xs">
                                                    <Phone size={11} className="text-white" />
                                                </div>
                                                <span className="text-[10.5px] sm:text-[12px] font-[800] text-[#0B1833] tracking-tight">
                                                    {partnerMobile || '+91 7292987918'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#1457E6] flex items-center justify-center shrink-0 shadow-xs">
                                                    <Mail size={11} className="text-white" />
                                                </div>
                                                <span className="text-[10px] sm:text-[11.5px] font-[800] text-[#0B1833] truncate max-w-[150px] sm:max-w-[210px]">
                                                    {partnerEmail}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Vertical Separator */}
                                        <div className="w-px h-8 bg-[#CBD5E1] hidden sm:block mx-2" />

                                        {/* Company Name Right */}
                                        <div className="text-right shrink-0">
                                            <h4 className="text-[12px] sm:text-[14.5px] font-[900] text-[#1457E6] tracking-tight leading-tight">
                                                Rupiksha Services Private Limited
                                            </h4>
                                            <p className="text-[7.5px] sm:text-[8.5px] font-[800] text-[#64748B] uppercase tracking-[0.22em] mt-0.5">
                                                Making Life Simple
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    {/* Part 2 (Right 5 cols): Actions & Partner Info */}
                    <div className="lg:col-span-5 flex flex-col space-y-3.5">
                        <div className="p-4 bg-[#F8FAFD] rounded-[14px] border border-[#D7E3F2]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#526987]">Partner Status</span>
                                <span className="text-[10px] font-bold text-[#16C784] bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">KYC Verified</span>
                            </div>
                            <h4 className="text-[14px] font-bold text-[#0B1833]">{partnerName || 'Verified Merchant Partner'}</h4>
                            <p className="text-[11px] text-[#64748B] mt-1">Download or share your official digital visiting card with customers & partners.</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2.5 w-full">
                            <button 
                                onClick={handleDownloadCard}
                                disabled={isDownloading}
                                className="w-full bg-[#1457E6] hover:bg-[#1044B8] text-white py-3 rounded-[11px] font-bold uppercase text-[12px] tracking-wider shadow-md shadow-blue-600/20 flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                            >
                                {isDownloading ? (
                                    <>
                                        <RefreshCw size={15} className="animate-spin" />
                                        <span>Generating Card...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download size={15} />
                                        <span>Download Visiting Card</span>
                                    </>
                                )}
                            </button>
                            
                            <button 
                                onClick={handleShareEmail}
                                disabled={isSharing}
                                className="w-full bg-[#0B1833] hover:bg-black text-white py-3 rounded-[11px] font-bold uppercase text-[12px] tracking-wider shadow-md flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                            >
                                <Mail size={15} />
                                <span>{isSharing ? 'Sharing...' : 'Share on Email'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ══ HIDDEN 1:1 HIGH-DEFINITION PRINT TEMPLATE (1011px x 638px) FOR EXACT MATCH PDF ══ */}
            <div style={{ position: 'absolute', top: -99999, left: -99999, overflow: 'hidden' }}>
                <div 
                    ref={printCardRef}
                    style={{
                        width: '1011px',
                        height: '638px',
                        background: 'linear-gradient(135deg, #F8FBFF 0%, #FFFFFF 50%, #FFFFFF 100%)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '38px 46px',
                        boxSizing: 'border-box',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        overflow: 'hidden'
                    }}
                >
                    {/* Top-Left Waves */}
                    <svg 
                        style={{ position: 'absolute', top: 0, left: 0, width: '460px', height: '330px', pointerEvents: 'none', zIndex: 1 }} 
                        viewBox="0 0 460 330" 
                        fill="none"
                    >
                        <path d="M0 0 L330 0 C240 90 140 200 0 290 Z" fill="#EEF6FF" />
                        <path d="M0 0 L240 0 C180 80 105 170 0 230 Z" fill="#DCEBFF" />
                        <path d="M0 0 L170 0 C120 60 70 130 0 180 Z" fill="#60A5FA" opacity="0.45" />
                        <path d="M0 0 L110 0 C70 45 40 95 0 140 Z" fill="#1457E6" />
                    </svg>

                    {/* Bottom-Right Waves */}
                    <svg 
                        style={{ position: 'absolute', bottom: 0, right: 0, width: '720px', height: '420px', pointerEvents: 'none', zIndex: 1 }} 
                        viewBox="0 0 720 420" 
                        fill="none"
                    >
                        <path d="M0 420 C200 380 380 290 560 160 C640 100 685 50 720 0 L720 420 Z" fill="#EEF6FF" />
                        <path d="M90 420 C270 390 435 300 595 190 C665 145 700 95 720 40 L720 420 Z" fill="#DCEBFF" />
                        <path d="M235 420 C380 400 505 320 630 220 C685 180 705 140 720 90 L720 420 Z" fill="#60A5FA" opacity="0.45" />
                        <path d="M380 420 C485 420 575 355 660 265 C698 230 712 190 720 160 L720 420 Z" fill="#1457E6" />
                    </svg>

                    {/* Central Watermark */}
                    <div 
                        style={{ 
                            position: 'absolute', 
                            inset: 0, 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            opacity: 0.08, 
                            pointerEvents: 'none', 
                            zIndex: 2 
                        }}
                    >
                        <svg width="280" height="280" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="100" cy="100" r="85" stroke="#1457E6" strokeWidth="6" strokeDasharray="14 8" />
                            <circle cx="100" cy="100" r="65" stroke="#1457E6" strokeWidth="5" strokeDasharray="10 6" />
                            <circle cx="100" cy="100" r="45" stroke="#1457E6" strokeWidth="4" />
                            <path d="M80 68 H120 M80 82 H120 M80 68 V110 C80 125 105 125 105 125 L125 145 M105 110 H80" stroke="#1457E6" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span style={{ fontSize: '62px', fontWeight: 900, color: '#1457E6', letterSpacing: '-1px', marginTop: '-24px' }}>
                            Rupiksha
                        </span>
                        <span style={{ fontSize: '17px', fontWeight: 800, color: '#1457E6', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                            Making Life Digital
                        </span>
                    </div>

                    {/* Top Row: Avatar, Name, Business, Role Badge & QR Code */}
                    <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
                            {/* Photo with double border */}
                            <div 
                                style={{
                                    width: '100px',
                                    height: '100px',
                                    borderRadius: '50%',
                                    padding: '3px',
                                    backgroundColor: '#ffffff',
                                    border: '4px solid #1457E6',
                                    boxShadow: '0 4px 14px rgba(20,87,230,0.22)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    flexShrink: 0
                                }}
                            >
                                {safePhotoUrl ? (
                                    <img src={safePhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', backgroundColor: '#EEF6FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1457E6', fontWeight: 'bold', fontSize: '38px' }}>
                                        {partnerName?.charAt(0) || 'P'}
                                    </div>
                                )}
                            </div>

                            {/* Name & Business Name & Role */}
                            <div>
                                <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: '#0B1833', letterSpacing: '-0.5px', textTransform: 'uppercase' }}>
                                    {partnerName}
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
                                    <span style={{ fontSize: '22px', fontWeight: 900, color: '#1457E6', textTransform: 'uppercase' }}>
                                        {partnerShop}
                                    </span>
                                    <span style={{ fontSize: '15px', fontWeight: 900, color: '#1457E6', backgroundColor: '#E0EDFF', border: '1.5px solid #BFD7FF', padding: '3px 12px', borderRadius: '8px', textTransform: 'uppercase' }}>
                                        {partnerRole}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Top-Right QR Code */}
                        <div 
                            style={{
                                backgroundColor: '#ffffff',
                                padding: '8px',
                                borderRadius: '16px',
                                border: '2px solid #BFD7FF',
                                boxShadow: '0 4px 14px rgba(11,24,51,0.08)'
                            }}
                        >
                            {qrCodeDataUrl && (
                                <img 
                                    src={qrCodeDataUrl} 
                                    alt="QR" 
                                    style={{ width: '100px', height: '100px', display: 'block' }} 
                                />
                            )}
                        </div>
                    </div>

                    {/* Horizontal Divider */}
                    <div 
                        style={{
                            position: 'relative',
                            zIndex: 10,
                            width: '100%',
                            height: '3.5px',
                            borderRadius: '4px',
                            background: 'linear-gradient(to right, #1457E6, #60A5FA, #DCEBFF)',
                            margin: '12px 0 16px 0'
                        }}
                    />

                    {/* Middle: Address Section */}
                    <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: '18px' }}>
                        <div 
                            style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '50%',
                                backgroundColor: '#1457E6',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
                                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
                                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
                                <path d="M10 6h4"/>
                                <path d="M10 10h4"/>
                                <path d="M10 14h4"/>
                                <path d="M10 18h4"/>
                            </svg>
                        </div>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0B1833', textTransform: 'uppercase', lineHeight: 1.35, maxWidth: '90%' }}>
                            {partnerAddress}
                        </p>
                    </div>

                    {/* Bottom Row: Phone, Email, Separator & Company Name */}
                    <div 
                        style={{
                            position: 'relative',
                            zIndex: 10,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingTop: '10px'
                        }}
                    >
                        {/* Contacts */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div 
                                    style={{
                                        width: '38px',
                                        height: '38px',
                                        borderRadius: '50%',
                                        backgroundColor: '#1457E6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                    </svg>
                                </div>
                                <span style={{ fontSize: '21px', fontWeight: 900, color: '#0B1833', letterSpacing: '-0.3px' }}>
                                    {partnerMobile || '+91 7292987918'}
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div 
                                    style={{
                                        width: '38px',
                                        height: '38px',
                                        borderRadius: '50%',
                                        backgroundColor: '#1457E6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <rect width="20" height="16" x="2" y="4" rx="2"/>
                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                                    </svg>
                                </div>
                                <span style={{ fontSize: '20px', fontWeight: 900, color: '#0B1833' }}>
                                    {partnerEmail}
                                </span>
                            </div>
                        </div>

                        {/* Vertical Separator */}
                        <div style={{ width: '2px', height: '56px', backgroundColor: '#CBD5E1', margin: '0 20px' }} />

                        {/* Company Name & Tagline */}
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '24px', fontWeight: 900, color: '#1457E6', letterSpacing: '-0.4px', lineHeight: 1.1 }}>
                                Rupiksha Services Private Limited
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#64748B', letterSpacing: '0.24em', textTransform: 'uppercase', marginTop: '4px' }}>
                                Making Life Simple
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VisitingCard;

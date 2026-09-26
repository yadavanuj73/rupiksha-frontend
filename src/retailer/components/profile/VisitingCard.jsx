import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, Download, Mail, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import rupikshaNewLogo from '../../../assets/logo rupiksha.png';
import { BACKEND_URL as IMPORTED_BACKEND_URL } from '../../../services/dataService';

const BACKEND_URL = IMPORTED_BACKEND_URL || `/api`;

// Canonical Card Dimensions (Standard ID-1 / 85.6mm x 54.0mm Aspect Ratio ~1.586)
const CARD_WIDTH = 1050;
const CARD_HEIGHT = 662;

const formatAddressLines = (addr) => {
    if (!addr) return ['ADDRESS NOT REGISTERED', ''];
    const trimmed = addr.trim();
    if (trimmed.length <= 38) return [trimmed, ''];
    
    // Split near 35-38 chars at word boundary
    const words = trimmed.split(' ');
    let line1 = '';
    let line2 = '';
    for (let i = 0; i < words.length; i++) {
        if ((line1 + (line1 ? ' ' : '') + words[i]).length <= 40) {
            line1 += (line1 ? ' ' : '') + words[i];
        } else {
            line2 = words.slice(i).join(' ');
            break;
        }
    }
    return [line1, line2];
};

const VisitingCard = ({ formData, currentUser, profilePhoto }) => {
    const cardRef = useRef(null);
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
    const partnerShop = formData?.businessName || currentUser?.businessName || currentUser?.shopName || 'AJ Enterprises';
    
    const rawAddress = formData?.address1 ? 
        `${formData.address1}${formData.address2 ? `, ${formData.address2}` : ''} ${formData.area || ''} ${formData.city || ''} ${formData.state || ''} ${formData.pincode || ''}`.replace(/\s+/g, ' ').trim() : 
        (currentUser?.address || currentUser?.address1 ? 
            `${currentUser.address || currentUser.address1} ${currentUser.pincode || ''}`.replace(/\s+/g, ' ').trim() : 
            'Shop Address Not Registered');

    const [addressLine1, addressLine2] = formatAddressLines(rawAddress);

    const partnerMobile = formData?.mobile || currentUser?.mobile ? `+91 ${formData.mobile || currentUser?.mobile}` : '+91 7292987918';
    const partnerEmail = formData?.email || currentUser?.email || 'partner@rupiksha.com';

    // 2. Multiline QR text format
    const qrCardData = [
        'Rupiksha Partner',
        partnerName,
        partnerRole,
        partnerShop,
        rawAddress,
        partnerMobile,
        partnerEmail
    ].filter(Boolean).join('\n');

    // 3. Pre-generate QR code in memory (100% local Base64 Data URL)
    useEffect(() => {
        let isMounted = true;
        QRCode.toDataURL(qrCardData, {
            width: 640,
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

    // 4. Convert logo to safe Data URL for guaranteed canvas & SVG rendering
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = '/logo rupiksha.png';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || 300;
                canvas.height = img.naturalHeight || 300;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                setSafeLogoUrl(canvas.toDataURL('image/png'));
            } catch {
                setSafeLogoUrl(rupikshaNewLogo || '/logo rupiksha.png');
            }
        };
        img.onerror = () => setSafeLogoUrl(rupikshaNewLogo || '/logo rupiksha.png');
    }, []);

    // 5. Convert profile photo safely to Base64 Data URL
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

    // 6. Download exact 1:1 High-Res Visiting Card PDF from Master SVG
    const handleDownloadCard = async () => {
        const svgElement = document.getElementById('rupiksha-visiting-card-svg');
        if (!svgElement || isDownloading) return;
        setIsDownloading(true);

        try {
            await document.fonts.ready;

            const exportScale = 3; // 3150 x 1986 px (ultra high DPI vector rendering)
            const canvas = document.createElement('canvas');
            canvas.width = CARD_WIDTH * exportScale;
            canvas.height = CARD_HEIGHT * exportScale;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Serialize SVG
            const svgXml = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);

            const img = new Image();
            let imgLoaded = false;
            await new Promise((resolve) => {
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(svgUrl);
                    imgLoaded = true;
                    resolve();
                };
                img.onerror = () => {
                    URL.revokeObjectURL(svgUrl);
                    resolve();
                };
                img.src = svgUrl;
            });

            let imgData;
            if (imgLoaded) {
                imgData = canvas.toDataURL('image/png', 1.0);
            } else {
                const h2cCanvas = await html2canvas(svgElement, {
                    scale: 3,
                    backgroundColor: '#ffffff',
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                });
                imgData = h2cCanvas.toDataURL('image/png', 1.0);
            }

            // Exact standard ID-1 card size: 85.6mm x 54.0mm (landscape)
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
        const svgElement = document.getElementById('rupiksha-visiting-card-svg');
        if (!svgElement || isSharing) return;
        setIsSharing(true);
        try {
            await document.fonts.ready;
            const h2cCanvas = await html2canvas(svgElement, { scale: 3, useCORS: true, allowTaint: true });
            const imgData = h2cCanvas.toDataURL('image/png');

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

    const badgeWidth = Math.max(105, partnerRole.length * 11 + 24);

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
                        <p className="text-[12px] sm:text-[13px] font-[600] text-[#0B1833] mt-0.5">
                            Official Rupiksha Partner Business Card
                        </p>
                    </div>
                </div>

                {/* Subtle Horizontal Divider */}
                <div className="w-full h-px bg-[#E3EAF3] mb-5 relative z-10" />

                {/* 2-Part Grid: Card Preview (Left) & Actions (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 items-center relative z-10">
                    {/* Part 1 (Left 7 cols): Single Source of Truth SVG Visiting Card */}
                    <div className="lg:col-span-7 flex justify-center w-full">
                        <div ref={cardRef} className="card-container shrink-0 w-full max-w-[540px]">
                            <motion.div
                                initial={{ scale: 0.98, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-full flex justify-center"
                            >
                                <svg
                                    id="rupiksha-visiting-card-svg"
                                    viewBox="0 0 1050 662"
                                    className="w-full h-auto rounded-2xl shadow-[0_10px_30px_rgba(11,24,51,0.1)] border border-[#BFD7FF] bg-white select-none block"
                                    style={{ fontFamily: 'Montserrat, Inter, system-ui, sans-serif' }}
                                >
                                    <defs>
                                        {/* Card Outer Clip */}
                                        <clipPath id="cardOuterClip">
                                            <rect x="0" y="0" width="1050" height="662" rx="24" />
                                        </clipPath>
                                        {/* Avatar Clip */}
                                        <clipPath id="visitingAvatarClip">
                                            <circle cx="102" cy="102" r="54" />
                                        </clipPath>
                                        {/* Card Gradient */}
                                        <linearGradient id="visitingBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#F8FBFF" />
                                            <stop offset="50%" stopColor="#FFFFFF" />
                                            <stop offset="100%" stopColor="#FFFFFF" />
                                        </linearGradient>
                                    </defs>

                                    {/* Outer Container with Rounded Clip */}
                                    <g clipPath="url(#cardOuterClip)">
                                        {/* Background Fill */}
                                        <rect x="0" y="0" width="1050" height="662" fill="url(#visitingBgGrad)" />

                                        {/* ── Top-Left Layered Geometric Curves (Reduced by 60%) ── */}
                                        <g>
                                            <path d="M0,0 L300,0 C220,75 130,165 0,240 Z" fill="#EEF6FF" />
                                            <path d="M0,0 L220,0 C165,65 95,140 0,190 Z" fill="#DCEBFF" />
                                            <path d="M0,0 L155,0 C110,50 60,110 0,150 Z" fill="#60A5FA" fillOpacity="0.45" />
                                            <path d="M0,0 L96,0 C60,35 35,80 0,116 Z" fill="#1457E6" />
                                        </g>

                                        {/* ── Bottom-Right Layered Wave Curves (Reduced by 60%) ── */}
                                        <g>
                                            <path d="M630,662 C740,632 850,572 960,490 C1010,450 1040,420 1050,395 L1050,662 Z" fill="#EEF6FF" />
                                            <path d="M690,662 C790,640 885,580 980,515 C1020,480 1040,450 1050,420 L1050,662 Z" fill="#DCEBFF" />
                                            <path d="M775,662 C860,647 930,595 1005,535 C1035,505 1045,475 1050,450 L1050,662 Z" fill="#60A5FA" fillOpacity="0.45" />
                                            <path d="M860,662 C925,662 980,618 1025,560 C1043,538 1048,515 1050,490 L1050,662 Z" fill="#1457E6" />
                                        </g>

                                        {/* ── Central Watermark Logo (+80% Enlarge, 360x360 centered) ── */}
                                        {safeLogoUrl && (
                                            <image
                                                href={safeLogoUrl}
                                                x="345"
                                                y="151"
                                                width="360"
                                                height="360"
                                                opacity="0.10"
                                                preserveAspectRatio="xMidYMid meet"
                                            />
                                        )}

                                        {/* ── TOP SECTION: AVATAR, NAME, SHOP, ROLE & QR CODE ── */}
                                        
                                        {/* Avatar Ring & Photo */}
                                        <circle cx="102" cy="102" r="58" fill="#FFFFFF" stroke="#1457E6" strokeWidth="4" />
                                        {safePhotoUrl ? (
                                            <image
                                                href={safePhotoUrl}
                                                x="48"
                                                y="48"
                                                width="108"
                                                height="108"
                                                preserveAspectRatio="xMidYMid slice"
                                                clipPath="url(#visitingAvatarClip)"
                                            />
                                        ) : (
                                            <g clipPath="url(#visitingAvatarClip)">
                                                <circle cx="102" cy="102" r="54" fill="#EEF6FF" />
                                                <text x="102" y="112" textAnchor="middle" fill="#1457E6" fontSize="36" fontWeight="bold">
                                                    {partnerName?.charAt(0) || 'R'}
                                                </text>
                                            </g>
                                        )}

                                        {/* Name (Line 1) */}
                                        <text
                                            x="180"
                                            y="80"
                                            fill="#0B1833"
                                            fontSize="28"
                                            fontWeight="900"
                                            letterSpacing="0.5px"
                                            style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}
                                        >
                                            {partnerName.toUpperCase()}
                                        </text>

                                        {/* Shop Name (Line 2) */}
                                        <text
                                            x="180"
                                            y="114"
                                            fill="#1457E6"
                                            fontSize="21"
                                            fontWeight="800"
                                            letterSpacing="0.5px"
                                            style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}
                                        >
                                            {partnerShop.toUpperCase()}
                                        </text>

                                        {/* Role Badge (Line 3) */}
                                        <rect
                                            x="180"
                                            y="126"
                                            width={badgeWidth}
                                            height="28"
                                            rx="6"
                                            fill="#E0EDFF"
                                            stroke="#BFD7FF"
                                            strokeWidth="1.5"
                                        />
                                        <text
                                            x={180 + badgeWidth / 2}
                                            y="144"
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fill="#1457E6"
                                            fontSize="13"
                                            fontWeight="800"
                                            letterSpacing="0.8px"
                                            style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}
                                        >
                                            {partnerRole.toUpperCase()}
                                        </text>

                                        {/* Top-Right QR Code (+30% Enlarge: 192x192 box, 162x162 QR) */}
                                        <rect
                                            x="830"
                                            y="28"
                                            width="192"
                                            height="192"
                                            rx="18"
                                            fill="#FFFFFF"
                                            stroke="#BFD7FF"
                                            strokeWidth="2"
                                        />
                                        {qrCodeDataUrl && (
                                            <image
                                                href={qrCodeDataUrl}
                                                x="845"
                                                y="43"
                                                width="162"
                                                height="162"
                                                preserveAspectRatio="xMidYMid meet"
                                            />
                                        )}

                                        {/* ── BOTTOM SECTION: CONTACT INFO (MOBILE, EMAIL, ADDRESS) ── */}

                                        {/* 1. Mobile Number */}
                                        <g>
                                            <circle cx="58" cy="486" r="18" fill="#1457E6" />
                                            <path
                                                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                                                fill="none"
                                                stroke="#FFFFFF"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                transform="translate(47, 475) scale(0.9)"
                                            />
                                            <text
                                                x="90"
                                                y="493"
                                                fill="#0B1833"
                                                fontSize="20"
                                                fontWeight="800"
                                                letterSpacing="0.2px"
                                                style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}
                                            >
                                                {partnerMobile}
                                            </text>
                                        </g>

                                        {/* 2. Email */}
                                        <g>
                                            <circle cx="58" cy="540" r="18" fill="#1457E6" />
                                            <g transform="translate(47, 529) scale(0.9)">
                                                <rect width="20" height="16" x="2" y="4" rx="2" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </g>
                                            <text
                                                x="90"
                                                y="547"
                                                fill="#0B1833"
                                                fontSize="18.5"
                                                fontWeight="800"
                                                letterSpacing="0.2px"
                                                style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}
                                            >
                                                {partnerEmail}
                                            </text>
                                        </g>

                                        {/* 3. Address (Clean 2-line rendering) */}
                                        <g>
                                            <circle cx="58" cy="600" r="18" fill="#1457E6" />
                                            <g transform="translate(47, 589) scale(0.9)">
                                                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                                                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                                                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                                                <path d="M10 6h4" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                                                <path d="M10 10h4" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                                                <path d="M10 14h4" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                                                <path d="M10 18h4" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                                            </g>
                                            <text
                                                x="90"
                                                y={addressLine2 ? "592" : "607"}
                                                fill="#0B1833"
                                                fontSize="17"
                                                fontWeight="800"
                                                letterSpacing="0.2px"
                                                style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}
                                            >
                                                {addressLine1.toUpperCase()}
                                            </text>
                                            {addressLine2 && (
                                                <text
                                                    x="90"
                                                    y="616"
                                                    fill="#0B1833"
                                                    fontSize="17"
                                                    fontWeight="800"
                                                    letterSpacing="0.2px"
                                                    style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}
                                                >
                                                    {addressLine2.toUpperCase()}
                                                </text>
                                            )}
                                        </g>

                                        {/* Outer Card Stroke */}
                                        <rect
                                            x="1"
                                            y="1"
                                            width="1048"
                                            height="660"
                                            rx="24"
                                            fill="none"
                                            stroke="#BFD7FF"
                                            strokeWidth="2.5"
                                        />
                                    </g>
                                </svg>
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
        </div>
    );
};

export default VisitingCard;

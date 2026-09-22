import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, Download, Mail, Phone, Building2, RefreshCw, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import rupikshaNewLogo from '../../../assets/rupiksha_new_logo.png';
import { BACKEND_URL as IMPORTED_BACKEND_URL } from '../../../services/dataService';

const BACKEND_URL = IMPORTED_BACKEND_URL || `/api`;

const VisitingCard = ({ formData, currentUser, profilePhoto }) => {
    const cardRef = useRef(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    // 1. Role detection
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
    const partnerName = formData?.name || currentUser?.name || 'RuPiksha Partner';
    const partnerShop = formData?.businessName || currentUser?.businessName || currentUser?.shopName || 'Your Business Name';
    
    const partnerAddress = formData?.address1 ? 
        `${formData.address1}${formData.address2 ? `, ${formData.address2}` : ''} ${formData.area || ''} ${formData.city || ''} ${formData.state || ''} ${formData.pincode || ''}`.replace(/\s+/g, ' ').trim() : 
        (currentUser?.address || currentUser?.address1 ? 
            `${currentUser.address || currentUser.address1} ${currentUser.pincode || ''}`.replace(/\s+/g, ' ').trim() : 
            'Shop Address Not Registered');

    const partnerMobile = formData?.mobile || currentUser?.mobile ? `+91 ${formData.mobile || currentUser?.mobile}` : '';
    const partnerEmail = formData?.email || currentUser?.email || 'partner@rupiksha.com';

    // 2. Multiline QR data string
    const qrCardData = [
        'Rupiksha Partner',
        partnerName,
        partnerRole,
        partnerShop,
        partnerAddress,
        partnerMobile,
        partnerEmail
    ].filter(Boolean).join('\n');

    // 3. Generate QR Code locally as Data URL (0 CORS risk, 0 external network calls)
    useEffect(() => {
        let isMounted = true;
        QRCode.toDataURL(qrCardData, {
            width: 320,
            margin: 1,
            color: {
                dark: '#0B0F14',
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

    // 4. Robust Download Handler with standard visiting card sizing
    const handleDownloadCard = async () => {
        if (!cardRef.current || isDownloading) return;
        setIsDownloading(true);

        try {
            const element = cardRef.current;
            const canvas = await html2canvas(element, {
                scale: 3,
                backgroundColor: '#ffffff',
                useCORS: true,
                allowTaint: true,
                logging: false,
                imageTimeout: 5000,
            });

            const imgData = canvas.toDataURL('image/png', 1.0);

            // Standard Business Card Size (85.6mm x 54mm - ISO 7810 ID-1 standard)
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
            console.error('[VisitingCard] Primary PDF render failed, falling back:', err);
            try {
                // Fallback: Programmatic Canvas Render
                const fallbackCanvas = document.createElement('canvas');
                fallbackCanvas.width = 1011; // 85.6mm at 300 DPI
                fallbackCanvas.height = 638; // 54mm at 300 DPI
                const ctx = fallbackCanvas.getContext('2d');
                
                // Background
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
                
                // Top Header Gradient Bar
                const grad = ctx.createLinearGradient(0, 0, fallbackCanvas.width, 0);
                grad.addColorStop(0, '#2563EB');
                grad.addColorStop(1, '#2146A3');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, fallbackCanvas.width, 10);

                // Text details
                ctx.fillStyle = '#0B0F14';
                ctx.font = 'bold 36px sans-serif';
                ctx.fillText(partnerName, 50, 100);

                ctx.fillStyle = '#2563EB';
                ctx.font = 'bold 24px sans-serif';
                ctx.fillText((partnerShop + ' (' + partnerRole + ')').toUpperCase(), 50, 145);

                // Divider
                ctx.strokeStyle = '#E3EAF3';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(50, 180);
                ctx.lineTo(fallbackCanvas.width - 50, 180);
                ctx.stroke();

                // Address
                ctx.fillStyle = '#334155';
                ctx.font = '22px sans-serif';
                ctx.fillText(partnerAddress.slice(0, 60), 50, 240);
                if (partnerAddress.length > 60) {
                    ctx.fillText(partnerAddress.slice(60, 120), 50, 275);
                }

                // Phone & Email
                ctx.fillStyle = '#0B0F14';
                ctx.font = 'bold 24px sans-serif';
                ctx.fillText(partnerMobile, 50, 480);
                ctx.fillText(partnerEmail, 50, 525);

                // Company brand
                ctx.fillStyle = '#2146A3';
                ctx.font = 'bold 26px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText('Rupiksha Services Private Limited', fallbackCanvas.width - 50, 480);
                ctx.fillStyle = '#64748B';
                ctx.font = 'bold 16px sans-serif';
                ctx.fillText('MAKING LIFE SIMPLE', fallbackCanvas.width - 50, 515);

                // Draw QR if available
                if (qrCodeDataUrl) {
                    const qrImg = new Image();
                    qrImg.src = qrCodeDataUrl;
                    await new Promise((resolve) => {
                        qrImg.onload = () => {
                            ctx.drawImage(qrImg, fallbackCanvas.width - 230, 40, 180, 180);
                            resolve();
                        };
                        qrImg.onerror = resolve;
                    });
                }

                const fallbackData = fallbackCanvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: [85.6, 54.0]
                });
                pdf.addImage(fallbackData, 'PNG', 0, 0, 85.6, 54.0);
                pdf.save(`${(partnerName || 'RuPiksha_Partner').replace(/[^a-zA-Z0-9_-]/g, '_')}_Visiting_Card.pdf`);
            } catch (fallbackErr) {
                console.error('[VisitingCard] Fallback also failed:', fallbackErr);
                alert("Failed to download visiting card. Please check your browser permissions.");
            }
        } finally {
            setIsDownloading(false);
        }
    };

    const handleShareEmail = async () => {
        setIsSharing(true);
        try {
            const element = cardRef.current;
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, allowTaint: true });
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
                        <CreditCard size={20} strokeWidth={2} className="text-[#2563EB]" />
                    </div>
                    <div>
                        <h2 className="text-[17px] sm:text-[18px] font-[800] text-[#0B0F14] tracking-tight leading-tight">
                            Professional Identity
                        </h2>
                        <p className="text-[12px] sm:text-[13px] font-[500] text-[#64748B] mt-0.5">
                            Official RuPiKsha Partner Card
                        </p>
                    </div>
                </div>

                {/* Subtle Horizontal Divider */}
                <div className="w-full h-px bg-[#E3EAF3] mb-5 relative z-10" />

                {/* 2-Part Grid: Card (Left) & Actions (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 items-center relative z-10">
                    {/* Part 1 (Left 7 cols): Responsive Visiting Card */}
                    <div className="lg:col-span-7 flex justify-center w-full">
                        <div ref={cardRef} className="card-container shrink-0 w-full max-w-[500px]">
                            <motion.div
                                initial={{ scale: 0.98, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-full aspect-[1.8/1] bg-white rounded-2xl shadow-xl overflow-hidden relative border border-[#D7E3F2]"
                            >
                                {/* Geometric Background Pattern Overlay */}
                                <div 
                                    className="absolute inset-0 opacity-[0.035] pointer-events-none"
                                    style={{
                                        backgroundImage: 'radial-gradient(#0ea5e9 1.5px, transparent 1.5px)',
                                        backgroundSize: '18px 18px'
                                    }}
                                />
                                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-[#EAF4FF]/60 via-white to-white pointer-events-none"></div>

                                {/* Watermark Background Logo */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.07] overflow-hidden">
                                    <img src={rupikshaNewLogo} alt="" className="w-[45%] max-w-[210px] object-contain select-none" />
                                </div>

                                <div className="p-4 sm:p-5 h-full flex flex-col justify-between relative z-10">
                                    {/* Top Row: Name & QR */}
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 border-[#D7E3F2] bg-white flex items-center justify-center shrink-0 shadow-sm">
                                                {profilePhoto ? (
                                                    <img src={profilePhoto} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                                                ) : (
                                                    <User className="text-[#2563EB]" size={18} />
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="text-[14px] sm:text-[16px] font-[800] text-[#0B0F14] leading-none tracking-tight">
                                                    {partnerName}
                                                </h4>
                                                <p className="text-[11px] sm:text-[12px] font-bold text-[#2563EB] mt-1 uppercase tracking-tight">
                                                    {partnerShop}
                                                </p>
                                            </div>
                                        </div>

                                        {/* QR Code Container */}
                                        <div className="bg-white p-1 rounded-lg shadow-xs border border-[#D7E3F2] shrink-0">
                                            {qrCodeDataUrl ? (
                                                <img 
                                                    src={qrCodeDataUrl} 
                                                    alt="Partner QR Code" 
                                                    className="w-9 h-9 sm:w-10 sm:h-10 object-contain"
                                                />
                                            ) : (
                                                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 animate-pulse rounded" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Separator Line */}
                                    <div className="w-full h-0.5 bg-[#2563EB]/20 rounded-full my-1.5 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-r from-[#2563EB] to-[#2146A3] opacity-60"></div>
                                    </div>

                                    {/* Middle: Address Section */}
                                    <div className="flex-1 flex flex-col justify-center my-0.5">
                                        <div className="flex items-start space-x-2">
                                            <div className="bg-[#2563EB] p-1 rounded-full shadow-xs shrink-0 mt-0.5">
                                                <Building2 size={11} className="text-white" />
                                            </div>
                                            <p className="text-[10.5px] sm:text-[11.5px] font-semibold text-[#1A2433] leading-tight max-w-[90%] uppercase line-clamp-2">
                                                {partnerAddress}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Bottom Row: Contact info & Logo */}
                                    <div className="flex items-center justify-between border-t border-[#E3EAF3] pt-2">
                                        {/* Phone above & Email below */}
                                        <div className="flex flex-col gap-0.5 text-[10.5px] sm:text-[11px] font-bold text-[#0B0F14]">
                                            <div className="flex items-center space-x-1">
                                                <Phone size={11} className="text-[#2563EB] shrink-0" />
                                                <span>{partnerMobile || '+91 XXXXXXXXXX'}</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <Mail size={11} className="text-[#2563EB] shrink-0" />
                                                <span className="truncate max-w-[150px] sm:max-w-[200px]">{partnerEmail}</span>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[11px] sm:text-[12px] font-black text-[#2146A3] tracking-tight leading-tight">
                                                    Rupiksha Services Private Limited
                                                </span>
                                                <span className="text-[6.5px] font-bold text-[#64748B] uppercase tracking-[0.25em] mt-0.5">
                                                    Making Life Simple
                                                </span>
                                            </div>
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
                            <h4 className="text-[14px] font-bold text-[#0B0F14]">{partnerName || 'Verified Merchant Partner'}</h4>
                            <p className="text-[11px] text-[#64748B] mt-1">Download or share your official digital visiting card with customers & partners.</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2.5 w-full">
                            <button 
                                onClick={handleDownloadCard}
                                disabled={isDownloading}
                                className="w-full bg-[#0B0F14] hover:bg-black text-white py-3 rounded-[11px] font-bold uppercase text-[12px] tracking-wider shadow-md flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60"
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
                                className="w-full bg-[#2146A3] hover:bg-[#1B3A88] text-white py-3 rounded-[11px] font-bold uppercase text-[12px] tracking-wider shadow-md shadow-blue-900/20 flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60"
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

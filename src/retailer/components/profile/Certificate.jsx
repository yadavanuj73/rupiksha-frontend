import React, { useState, useEffect, useRef } from 'react';
import { Award, Download, Printer, CheckCircle2, Shield, Calendar, MapPin, User, ExternalLink, RefreshCw, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import rupikshaNewLogo from '../../../assets/logo rupiksha.png';
import { certificateService } from '../../../services/apiService';

const Certificate = ({ formData = {}, currentUser = {} }) => {
    const certificateRef = useRef(null);
    const [certData, setCertData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [safeLogoUrl, setSafeLogoUrl] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Determine fallback dynamic details from currentUser / formData if backend API isn't reached
    const rawRole = (
        currentUser?.role ||
        currentUser?.userType ||
        (Array.isArray(currentUser?.roles) ? currentUser.roles[0] : '') ||
        formData?.role ||
        ''
    ).toString().toUpperCase();

    const isSuperDistributor = rawRole.includes('SUPER') || rawRole === 'SUPER_DISTRIBUTOR';
    const isDistributor = !isSuperDistributor && (rawRole.includes('DISTRIBUTOR') || rawRole === 'DISTRIBUTOR');

    // Parse creation date
    const resolveCreatedDate = () => {
        const rawDate = currentUser?.createdAt || currentUser?.created_at || currentUser?.registrationDate || formData?.createdAt;
        if (!rawDate) return new Date();
        try {
            const d = new Date(rawDate);
            return isNaN(d.getTime()) ? new Date() : d;
        } catch {
            return new Date();
        }
    };

    const formatDate = (d) => {
        const date = d instanceof Date ? d : new Date(d);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const formatValidTill = (createdDate) => {
        const d = new Date(createdDate);
        d.setFullYear(d.getFullYear() + 1);
        return formatDate(d);
    };

    const createdD = resolveCreatedDate();
    const fallbackPartyCode = formData?.partyCode || currentUser?.partyCode || (isSuperDistributor ? 'RD0002' : 'RD0003');
    const fallbackName = (formData?.name || currentUser?.name || currentUser?.fullName || 'MANISH KUMAR').toUpperCase();
    const fallbackLocation = (formData?.area || formData?.city || currentUser?.shopCity || currentUser?.city || currentUser?.stateName || (isSuperDistributor ? 'NALANDA' : 'PATNA')).toUpperCase();
    const fallbackCertNumber = `${isSuperDistributor ? 'RUP-SD-' : 'RUP-D-'}${fallbackPartyCode}`;

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        certificateService.getMyCertificate()
            .then(res => {
                if (!isMounted) return;
                if (res && res.success && res.certificate) {
                    setCertData(res.certificate);
                } else {
                    // Use dynamic fallback based on current profile
                    setCertData({
                        certificateNumber: fallbackCertNumber,
                        partyCode: fallbackPartyCode,
                        certificateRole: isSuperDistributor ? 'SUPER_DISTRIBUTOR' : 'DISTRIBUTOR',
                        roleDisplayName: isSuperDistributor ? 'Super Distributor' : 'Distributor',
                        certificateTitle: isSuperDistributor ? 'AUTHORISED SUPER DISTRIBUTOR' : 'AUTHORISED DISTRIBUTOR',
                        certificateType: isSuperDistributor ? 'SUPER DISTRIBUTOR CERTIFICATE' : 'DISTRIBUTOR CERTIFICATE',
                        idLabel: isSuperDistributor ? 'SUPER DISTRIBUTOR ID' : 'DISTRIBUTOR ID',
                        recipientName: fallbackName,
                        issuedOn: formatDate(createdD),
                        validTill: formatValidTill(createdD),
                        location: fallbackLocation,
                        certificationStatement: `is an Authorised ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} for delivering Rupiksha Services Pvt. Ltd. digital financial services.`,
                        authorizationClause: `This ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} is hereby authorised for providing the services offered by Rupiksha Services Pvt. Ltd. and shall not act as our representative in any capacity for any other purpose whatsoever.`,
                        bottomRole: isSuperDistributor ? 'SUPER DISTRIBUTOR' : 'DISTRIBUTOR',
                        disclaimerNote: `NOTE: If you will not perform up to the mark, then your ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} location will be allocated to some other person.`,
                        status: 'VALID',
                        verificationUrl: `https://rupiksha.in/certificate/verify/${fallbackCertNumber}`
                    });
                }
            })
            .catch(err => {
                if (!isMounted) return;
                console.warn('[Certificate] API fallback active:', err);
                setCertData({
                    certificateNumber: fallbackCertNumber,
                    partyCode: fallbackPartyCode,
                    certificateRole: isSuperDistributor ? 'SUPER_DISTRIBUTOR' : 'DISTRIBUTOR',
                    roleDisplayName: isSuperDistributor ? 'Super Distributor' : 'Distributor',
                    certificateTitle: isSuperDistributor ? 'AUTHORISED SUPER DISTRIBUTOR' : 'AUTHORISED DISTRIBUTOR',
                    certificateType: isSuperDistributor ? 'SUPER DISTRIBUTOR CERTIFICATE' : 'DISTRIBUTOR CERTIFICATE',
                    idLabel: isSuperDistributor ? 'SUPER DISTRIBUTOR ID' : 'DISTRIBUTOR ID',
                    recipientName: fallbackName,
                    issuedOn: formatDate(createdD),
                    validTill: formatValidTill(createdD),
                    location: fallbackLocation,
                    certificationStatement: `is an Authorised ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} for delivering Rupiksha Services Pvt. Ltd. digital financial services.`,
                    authorizationClause: `This ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} is hereby authorised for providing the services offered by Rupiksha Services Pvt. Ltd. and shall not act as our representative in any capacity for any other purpose whatsoever.`,
                    bottomRole: isSuperDistributor ? 'SUPER DISTRIBUTOR' : 'DISTRIBUTOR',
                    disclaimerNote: `NOTE: If you will not perform up to the mark, then your ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} location will be allocated to some other person.`,
                    status: 'VALID',
                    verificationUrl: `https://rupiksha.in/certificate/verify/${fallbackCertNumber}`
                });
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [currentUser, formData]);

    // Generate Verification QR Code
    useEffect(() => {
        const vUrl = certData?.verificationUrl || `https://rupiksha.in/certificate/verify/${fallbackCertNumber}`;
        QRCode.toDataURL(vUrl, {
            width: 320,
            margin: 1,
            color: {
                dark: '#0A1A3A',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'H'
        })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error('[Certificate] QR Error:', err));
    }, [certData]);

    // Convert logo to safe Data URL for canvas rendering
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

    // Download High-Res A4 Landscape PDF
    const handleDownloadPDF = async () => {
        const element = certificateRef.current ? (certificateRef.current.querySelector('.rupiksha-certificate-inner') || certificateRef.current) : null;
        if (!element || isDownloading) return;
        setIsDownloading(true);

        try {
            const canvas = await html2canvas(element, {
                scale: 3.5, // 300+ DPI Equivalent
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#FAF9F6',
                logging: false,
            });

            const imgData = canvas.toDataURL('image/png', 1.0);

            // A4 Landscape: 297mm x 210mm
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            pdf.addImage(imgData, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
            const safeName = (certData?.recipientName || 'Rupiksha_Partner').replace(/[^a-zA-Z0-9_-]/g, '_');
            const certCode = (certData?.partyCode || 'CERT').replace(/[^a-zA-Z0-9_-]/g, '_');
            pdf.save(`Rupiksha_Certificate_${certCode}_${safeName}.pdf`);
        } catch (err) {
            console.error('[Certificate] PDF Export Error:', err);
            alert('Could not export certificate PDF. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleCopyVerifyUrl = () => {
        if (certData?.verificationUrl) {
            navigator.clipboard.writeText(certData.verificationUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (loading) {
        return (
            <div className="w-full bg-white rounded-[22px] p-12 border border-[#DCE6F2] shadow-sm flex flex-col items-center justify-center space-y-4 min-h-[400px]">
                <RefreshCw className="w-8 h-8 text-[#2563EB] animate-spin" />
                <p className="text-slate-600 font-semibold text-sm">Generating authorized certificate...</p>
            </div>
        );
    }

    const d = certData || {};

    return (
        <div className="w-full flex flex-col items-center space-y-6">
            {/* Top Toolbar */}
            <div className="w-full max-w-[1050px] flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20 text-white">
                        <Award size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-[#0B1B3D] flex items-center gap-2">
                            {d.certificateTitle || 'AUTHORISED CERTIFICATE'}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                                {d.status || 'VALID'}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">Official Corporate Certificate &bull; ID: <strong className="text-slate-700">{d.partyCode}</strong></p>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleCopyVerifyUrl}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center space-x-1.5 transition-all cursor-pointer"
                        title="Copy Public Verification Link"
                    >
                        {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        <span>{copied ? 'Link Copied' : 'Verify Link'}</span>
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center space-x-1.5 transition-all cursor-pointer hidden sm:flex"
                    >
                        <Printer size={14} />
                        <span>Print</span>
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0B1B3D] hover:bg-[#152B5A] text-white flex items-center space-x-2 shadow-lg shadow-navy-900/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                        {isDownloading ? (
                            <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Generating PDF...</span>
                            </>
                        ) : (
                            <>
                                <Download size={14} />
                                <span>Download PDF (A4)</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Certificate Canvas / Render Frame (A4 Landscape 297mm x 210mm Aspect Ratio) */}
            <div className="w-full flex justify-center overflow-x-auto pb-4" ref={certificateRef}>
                <div 
                    className="rupiksha-certificate-inner relative w-[1000px] h-[707px] shrink-0 bg-[#FAF9F6] text-[#0B1B3D] select-none shadow-2xl rounded-none overflow-hidden font-['Inter',sans-serif] border-[6px] border-[#07132B]"
                    style={{
                        boxShadow: '0 25px 60px -15px rgba(11, 27, 61, 0.25)',
                    }}
                >
                    {/* Inner Metallic Gold Border with Inset Corner Cuts */}
                    <div className="absolute inset-[10px] border-[2px] border-[#C89B3C] pointer-events-none z-10">
                        {/* Decorative Gold Corner Squares */}
                        <div className="absolute -top-[5px] -left-[5px] w-[10px] h-[10px] bg-[#C89B3C] rotate-45" />
                        <div className="absolute -top-[5px] -right-[5px] w-[10px] h-[10px] bg-[#C89B3C] rotate-45" />
                        <div className="absolute -bottom-[5px] -left-[5px] w-[10px] h-[10px] bg-[#C89B3C] rotate-45" />
                        <div className="absolute -bottom-[5px] -right-[5px] w-[10px] h-[10px] bg-[#C89B3C] rotate-45" />
                    </div>

                    {/* Luxury Corner Navy-Gold Wings / Ribbons (Top-Right, Top-Left, Bottom-Right, Bottom-Left) */}
                    {/* Top Right Geometric Ribbons */}
                    <svg className="absolute top-0 right-0 w-[420px] h-[180px] pointer-events-none z-0" viewBox="0 0 420 180" fill="none">
                        <path d="M70 0L420 0L420 180L330 180L0 0L70 0Z" fill="url(#navyGradTop)" />
                        <path d="M0 0L20 0L350 180L330 180Z" fill="url(#goldGrad)" />
                        <path d="M370 0L420 0L420 50Z" fill="url(#goldGrad)" />
                        <defs>
                            <linearGradient id="navyGradTop" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#0B1B3D" />
                                <stop offset="50%" stopColor="#07132B" />
                                <stop offset="100%" stopColor="#040A18" />
                            </linearGradient>
                            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#F5D77F" />
                                <stop offset="35%" stopColor="#C89B3C" />
                                <stop offset="70%" stopColor="#ECC867" />
                                <stop offset="100%" stopColor="#9E741D" />
                            </linearGradient>
                        </defs>
                    </svg>

                    {/* Bottom Left Geometric Ribbons */}
                    <svg className="absolute bottom-0 left-0 w-[380px] h-[180px] pointer-events-none z-0" viewBox="0 0 380 180" fill="none">
                        <path d="M0 0L0 180L350 180L380 180L120 0L0 0Z" fill="url(#navyGradBottom)" />
                        <path d="M120 0L140 0L380 160L360 180Z" fill="url(#goldGrad)" />
                        <defs>
                            <linearGradient id="navyGradBottom" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#040A18" />
                                <stop offset="50%" stopColor="#07132B" />
                                <stop offset="100%" stopColor="#0B1B3D" />
                            </linearGradient>
                        </defs>
                    </svg>

                    {/* Top Left Subtle Gold Accent */}
                    <svg className="absolute top-0 left-0 w-[120px] h-[120px] pointer-events-none z-0" viewBox="0 0 120 120" fill="none">
                        <path d="M0 0L120 0L0 120Z" fill="url(#goldGrad)" opacity="0.15" />
                        <path d="M0 0L40 0L0 40Z" fill="url(#navyGradTop)" />
                    </svg>

                    {/* Bottom Right Subtle Gold Wing */}
                    <svg className="absolute bottom-0 right-0 w-[160px] h-[120px] pointer-events-none z-0" viewBox="0 0 160 120" fill="none">
                        <path d="M40 120L160 120L160 0Z" fill="url(#goldGrad)" opacity="0.85" />
                        <path d="M80 120L160 120L160 40Z" fill="url(#navyGradTop)" />
                    </svg>

                    {/* Background Luxury Subtle Grid / Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
                        <img src={safeLogoUrl || rupikshaNewLogo} alt="" className="w-[450px] h-auto object-contain" />
                    </div>

                    {/* MAIN CONTENT LAYER */}
                    <div className="relative z-20 h-full flex flex-col justify-between p-[36px_46px_28px_46px]">
                        
                        {/* 1. TOP HEADER SECTION */}
                        <div className="flex items-start justify-between">
                            {/* Left: Official Brand Logo & Tagline */}
                            <div className="flex flex-col items-start pt-1">
                                <div className="flex items-center space-x-2.5">
                                    <img 
                                        src={safeLogoUrl || rupikshaNewLogo} 
                                        alt="Rupiksha" 
                                        className="h-[74px] w-auto object-contain drop-shadow-sm" 
                                    />
                                </div>
                                <span className="text-[12px] font-bold text-[#16A34A] tracking-wide mt-1 ml-1 font-sans">
                                    Making Life Digital
                                </span>
                            </div>

                            {/* Right: Angled Official Certificate Banner */}
                            <div className="relative pt-2 pr-6 text-right">
                                <div className="text-[19px] font-[800] tracking-[0.14em] uppercase text-[#F5D77F] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] font-serif">
                                    {d.certificateTitle || (isSuperDistributor ? 'AUTHORISED SUPER DISTRIBUTOR' : 'AUTHORISED DISTRIBUTOR')}
                                </div>
                                <div className="flex items-center justify-end space-x-1.5 my-1 text-[#F5D77F]">
                                    <span className="text-[11px]">★</span>
                                    <span className="text-[14px]">★</span>
                                    <span className="text-[11px]">★</span>
                                </div>
                                <div className="text-[36px] font-[900] tracking-[0.24em] text-white uppercase font-serif drop-shadow-[0_3px_8px_rgba(0,0,0,0.6)]">
                                    CERTIFICATE
                                </div>
                            </div>
                        </div>

                        {/* 2. RECIPIENT & CERTIFICATION STATEMENT */}
                        <div className="flex flex-col items-center text-center -mt-2">
                            {/* Gold Filigree Ornament Top */}
                            <div className="flex items-center space-x-3 text-[#C89B3C] mb-1">
                                <span className="w-12 h-[1px] bg-gradient-to-r from-transparent to-[#C89B3C]" />
                                <span className="text-[14px]">❖</span>
                                <span className="w-12 h-[1px] bg-gradient-to-l from-transparent to-[#C89B3C]" />
                            </div>

                            <p className="text-[16px] italic font-serif text-[#334155] tracking-wide mb-1">
                                This is to certify that
                            </p>

                            {/* Large Recipient Name */}
                            <h1 
                                className="font-[900] text-[#07132B] font-serif uppercase tracking-[0.06em] leading-tight my-1 drop-shadow-sm"
                                style={{
                                    fontSize: (d.recipientName || '').length > 25 ? '28px' : '38px',
                                }}
                            >
                                {d.recipientName || fallbackName}
                            </h1>

                            {/* Gold Filigree Ornament Bottom */}
                            <div className="flex items-center space-x-3 text-[#C89B3C] my-1">
                                <span className="w-16 h-[1.5px] bg-gradient-to-r from-transparent to-[#C89B3C]" />
                                <span className="text-[12px]">✦</span>
                                <span className="w-16 h-[1.5px] bg-gradient-to-l from-transparent to-[#C89B3C]" />
                            </div>

                            {/* Role Authorization Summary */}
                            <p className="text-[14.5px] font-[500] text-[#1E293B] max-w-[760px] leading-relaxed mt-1 font-sans">
                                {d.certificationStatement || `is an Authorised ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} for delivering Rupiksha Services Pvt. Ltd. digital financial services.`}
                            </p>
                        </div>

                        {/* 3. FOUR CIRCULAR INFO BADGES */}
                        <div className="grid grid-cols-4 gap-4 px-8 my-1">
                            {/* Badge 1: Official ID */}
                            <div className="flex items-center space-x-3 bg-white/70 backdrop-blur-sm p-2 rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                                <div className="w-10 h-10 rounded-full bg-[#FAF3E0] border border-[#C89B3C]/40 flex items-center justify-center shrink-0 text-[#C89B3C]">
                                    <User size={18} strokeWidth={2.2} />
                                </div>
                                <div className="text-left overflow-hidden">
                                    <p className="text-[9px] font-[800] tracking-wider text-slate-500 uppercase">{d.idLabel || (isSuperDistributor ? 'SUPER DISTRIBUTOR ID' : 'DISTRIBUTOR ID')}</p>
                                    <p className="text-[13.5px] font-[900] text-[#07132B] font-mono tracking-tight truncate">{d.partyCode || fallbackPartyCode}</p>
                                </div>
                            </div>

                            {/* Badge 2: Issued On */}
                            <div className="flex items-center space-x-3 bg-white/70 backdrop-blur-sm p-2 rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                                <div className="w-10 h-10 rounded-full bg-[#FAF3E0] border border-[#C89B3C]/40 flex items-center justify-center shrink-0 text-[#C89B3C]">
                                    <Calendar size={18} strokeWidth={2.2} />
                                </div>
                                <div className="text-left overflow-hidden">
                                    <p className="text-[9px] font-[800] tracking-wider text-slate-500 uppercase">ISSUED ON</p>
                                    <p className="text-[13.5px] font-[900] text-[#07132B] font-mono tracking-tight">{d.issuedOn || formatDate(createdD)}</p>
                                </div>
                            </div>

                            {/* Badge 3: Valid Till */}
                            <div className="flex items-center space-x-3 bg-white/70 backdrop-blur-sm p-2 rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                                <div className="w-10 h-10 rounded-full bg-[#FAF3E0] border border-[#C89B3C]/40 flex items-center justify-center shrink-0 text-[#C89B3C]">
                                    <Calendar size={18} strokeWidth={2.2} />
                                </div>
                                <div className="text-left overflow-hidden">
                                    <p className="text-[9px] font-[800] tracking-wider text-slate-500 uppercase">VALID TILL</p>
                                    <p className="text-[13.5px] font-[900] text-[#07132B] font-mono tracking-tight">{d.validTill || formatValidTill(createdD)}</p>
                                </div>
                            </div>

                            {/* Badge 4: Location */}
                            <div className="flex items-center space-x-3 bg-white/70 backdrop-blur-sm p-2 rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                                <div className="w-10 h-10 rounded-full bg-[#FAF3E0] border border-[#C89B3C]/40 flex items-center justify-center shrink-0 text-[#C89B3C]">
                                    <MapPin size={18} strokeWidth={2.2} />
                                </div>
                                <div className="text-left overflow-hidden">
                                    <p className="text-[9px] font-[800] tracking-wider text-slate-500 uppercase">LOCATION</p>
                                    <p className="text-[13.5px] font-[900] text-[#07132B] font-sans tracking-tight truncate">{d.location || fallbackLocation}</p>
                                </div>
                            </div>
                        </div>

                        {/* 4. PARTY CODE OVAL BADGE WITH STARS */}
                        <div className="flex items-center justify-center -my-1">
                            <div className="flex items-center space-x-2">
                                <span className="w-20 h-[1.5px] bg-[#C89B3C]" />
                                <span className="text-[#C89B3C] text-xs">✦</span>
                                <div className="px-6 py-1 rounded-full bg-[#07132B] border-[1.5px] border-[#C89B3C] text-[#F5D77F] font-mono font-[900] text-[15px] tracking-widest shadow-md flex items-center space-x-2">
                                    <span className="text-[10px] text-[#C89B3C]">✦</span>
                                    <span>{d.partyCode || fallbackPartyCode}</span>
                                    <span className="text-[10px] text-[#C89B3C]">✦</span>
                                </div>
                                <span className="text-[#C89B3C] text-xs">✦</span>
                                <span className="w-20 h-[1.5px] bg-[#C89B3C]" />
                            </div>
                        </div>

                        {/* 5. LEGAL AUTHORIZATION CLAUSE */}
                        <div className="text-center px-12">
                            <p className="text-[11.5px] text-[#334155] leading-relaxed max-w-[820px] mx-auto font-sans font-[500]">
                                {d.authorizationClause || `This ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} is hereby authorised for providing the services offered by Rupiksha Services Pvt. Ltd. and shall not act as our representative in any capacity for any other purpose whatsoever.`}
                            </p>
                        </div>

                        {/* 6. BOTTOM FOOTER SECTION (Role Title, Disclaimer Note, QR & Signatory) */}
                        <div className="border-t border-[#E2E8F0] pt-2.5 flex items-end justify-between">
                            {/* Left / Center Note & Official Disclaimer */}
                            <div className="flex flex-col items-start space-y-1 max-w-[620px]">
                                <div className="text-[13px] font-[900] uppercase tracking-wider text-[#07132B]">
                                    {d.bottomRole || (isSuperDistributor ? 'SUPER DISTRIBUTOR' : 'DISTRIBUTOR')}
                                </div>
                                <p className="text-[9.5px] text-[#475569] font-medium leading-normal">
                                    {d.disclaimerNote || `NOTE: If you will not perform up to the mark, then your ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} location will be allocated to some other person.`}
                                </p>
                                <div className="text-[8.5px] text-slate-400 font-mono tracking-wider pt-1">
                                    Certificate No: <strong>{d.certificateNumber || fallbackCertNumber}</strong> &bull; Rupiksha Services Pvt. Ltd.
                                </div>
                            </div>

                            {/* Right: Dynamic QR Code & Authorised Signatory */}
                            <div className="flex items-center space-x-6 shrink-0">
                                {/* Verification QR */}
                                <div className="flex flex-col items-center text-center">
                                    <div className="p-1 bg-white rounded-lg border border-[#C89B3C]/50 shadow-sm">
                                        {qrCodeDataUrl ? (
                                            <img src={qrCodeDataUrl} alt="Verify QR" className="w-[58px] h-[58px]" />
                                        ) : (
                                            <div className="w-[58px] h-[58px] bg-slate-100 flex items-center justify-center text-[8px]">QR</div>
                                        )}
                                    </div>
                                    <span className="text-[7.5px] font-[800] uppercase text-[#0B1B3D] tracking-wider mt-1">SCAN TO VERIFY</span>
                                </div>

                                {/* Authorised Signatory */}
                                <div className="flex flex-col items-center text-center pl-2">
                                    <div className="w-32 h-[32px] flex items-end justify-center border-b border-slate-700 pb-1">
                                        <span className="font-serif italic text-slate-800 text-[13px] font-bold tracking-wider">Rupiksha</span>
                                    </div>
                                    <span className="text-[9.5px] font-[800] text-[#07132B] uppercase tracking-wider mt-1">Authorised Signatory</span>
                                    <span className="text-[8px] text-slate-500 font-medium">Rupiksha Services Pvt. Ltd.</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Certificate;

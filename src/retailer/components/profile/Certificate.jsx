import React, { useState, useEffect, useRef } from 'react';
import { Award, Download, Printer, Copy, Check, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import rupikshaLogo from '../../../assets/logo rupiksha.png';
import { certificateService } from '../../../services/apiService';

const Certificate = ({ formData = {}, currentUser = {} }) => {
    const certificateRef = useRef(null);
    const [certData, setCertData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Determine role dynamically
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

    // Download High-Res A4 Landscape PDF (297mm x 210mm)
    const handleDownloadPDF = async () => {
        const element = certificateRef.current ? (certificateRef.current.querySelector('.rupiksha-certificate-target') || certificateRef.current) : null;
        if (!element || isDownloading) return;
        setIsDownloading(true);

        try {
            const canvas = await html2canvas(element, {
                scale: 3.5, // 300+ DPI razor sharp output
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
            });

            const imgData = canvas.toDataURL('image/png', 1.0);

            // Exact standard A4 landscape dimensions
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
            alert('Could not generate PDF. Please try again.');
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
                <p className="text-slate-600 font-semibold text-sm">Loading authorized certificate...</p>
            </div>
        );
    }

    const d = certData || {};
    const recipientName = d.recipientName || fallbackName;
    const titleText = d.certificateTitle || (isSuperDistributor ? 'AUTHORISED SUPER DISTRIBUTOR' : 'AUTHORISED DISTRIBUTOR');
    const idLabelText = d.idLabel || (isSuperDistributor ? 'SUPER DISTRIBUTOR ID' : 'DISTRIBUTOR ID');
    const partyCodeText = d.partyCode || fallbackPartyCode;
    const issuedOnText = d.issuedOn || formatDate(createdD);
    const validTillText = d.validTill || formatValidTill(createdD);
    const locationText = d.location || fallbackLocation;
    const certStatement = d.certificationStatement || `is an Authorised ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} for delivering Rupiksha Services Pvt. Ltd. digital financial services.`;
    const authClause = d.authorizationClause || `This ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} is hereby authorised for providing the services offered by Rupiksha Services Pvt. Ltd. and shall not act as our representative in any capacity for any other purpose whatsoever.`;
    const bottomRoleText = d.bottomRole || (isSuperDistributor ? 'SUPER DISTRIBUTOR' : 'DISTRIBUTOR');
    const disclaimerText = d.disclaimerNote || `NOTE: If you will not perform up to the mark, then your ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} location will be allocated to some other person.`;

    return (
        <div className="w-full flex flex-col items-center space-y-6 font-['Inter',sans-serif]">
            {/* Control Toolbar */}
            <div className="w-full max-w-[1000px] flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20 text-white">
                        <Award size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-[#08142c] flex items-center gap-2">
                            {titleText}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                                {d.status || 'VALID'}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">Official Digital Certificate &bull; Party Code: <strong className="text-slate-700 font-mono">{partyCodeText}</strong></p>
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
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-[#08142c] hover:bg-[#10244c] text-white flex items-center space-x-2 shadow-lg shadow-slate-900/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
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

            {/* Certificate Preview Frame (A4 Landscape: 1000px x 707px) */}
            <div className="w-full flex justify-center overflow-x-auto pb-6" ref={certificateRef}>
                <div
                    className="rupiksha-certificate-target relative w-[1000px] h-[707px] shrink-0 bg-[#ffffff] text-[#08142c] select-none shadow-2xl overflow-hidden"
                    style={{
                        boxSizing: 'border-box',
                    }}
                >
                    {/* ══════════════════════════════════════════════════════════════
                        1. OUTER NAVY FRAME + INNER METALLIC GOLD BORDER + CORNERS
                       ══════════════════════════════════════════════════════════════ */}
                    {/* Navy Outer Border (10px) */}
                    <div className="absolute inset-0 border-[10px] border-[#08142c] pointer-events-none z-10" />

                    {/* Fine Gold Inset Border (1.5px) */}
                    <div className="absolute inset-[16px] border-[1.5px] border-[#c69a3d] pointer-events-none z-10" />

                    {/* Gold Corner Triangle Accents */}
                    <div className="absolute top-[16px] left-[16px] w-0 h-0 border-t-[14px] border-t-[#c69a3d] border-r-[14px] border-r-transparent pointer-events-none z-10" />
                    <div className="absolute top-[16px] right-[16px] w-0 h-0 border-t-[14px] border-t-[#c69a3d] border-l-[14px] border-l-transparent pointer-events-none z-10" />
                    <div className="absolute bottom-[16px] left-[16px] w-0 h-0 border-b-[14px] border-b-[#c69a3d] border-r-[14px] border-r-transparent pointer-events-none z-10" />
                    <div className="absolute bottom-[16px] right-[16px] w-0 h-0 border-b-[14px] border-b-[#c69a3d] border-l-[14px] border-l-transparent pointer-events-none z-10" />

                    {/* ══════════════════════════════════════════════════════════════
                        2. LUXURY CORNER RIBBONS & WAVES (SVG VECTORS)
                       ══════════════════════════════════════════════════════════════ */}
                    {/* Top Right Corner Gold & Navy Geometric Bands */}
                    <svg className="absolute top-0 right-0 w-[300px] h-[260px] pointer-events-none z-10" viewBox="0 0 300 260" fill="none">
                        {/* Gold outer diagonal strip */}
                        <polygon points="120,0 150,0 300,150 300,120" fill="url(#goldGrad1)" />
                        {/* Navy diagonal strip */}
                        <polygon points="150,0 220,0 300,80 300,150" fill="url(#navyGrad1)" />
                        {/* Top gold triangle accent */}
                        <polygon points="220,0 300,0 300,80" fill="url(#goldGrad1)" />
                        <defs>
                            <linearGradient id="goldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#f7e199" />
                                <stop offset="40%" stopColor="#c69a3d" />
                                <stop offset="70%" stopColor="#e8c973" />
                                <stop offset="100%" stopColor="#966d18" />
                            </linearGradient>
                            <linearGradient id="navyGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#08142c" />
                                <stop offset="100%" stopColor="#030814" />
                            </linearGradient>
                        </defs>
                    </svg>

                    {/* Bottom Left Corner Luxury Navy-Gold Flowing Waves */}
                    <svg className="absolute bottom-0 left-0 w-[360px] h-[220px] pointer-events-none z-10" viewBox="0 0 360 220" fill="none">
                        {/* Dark Navy Wave 1 */}
                        <path d="M0,70 C100,60 180,130 360,220 L0,220 Z" fill="url(#navyGradBottom1)" />
                        {/* Gold Edge Wave */}
                        <path d="M0,62 C100,52 180,122 360,212 L360,220 C180,130 100,60 0,70 Z" fill="url(#goldGrad1)" />
                        {/* Secondary Navy Wave */}
                        <path d="M0,110 C90,105 160,165 310,220 L0,220 Z" fill="url(#navyGradBottom2)" />
                        {/* Thin Gold accent line */}
                        <path d="M0,105 C90,100 160,160 310,215 L310,220 C160,165 90,105 0,110 Z" fill="url(#goldGrad1)" />
                        <defs>
                            <linearGradient id="navyGradBottom1" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#08142c" />
                                <stop offset="50%" stopColor="#0d2046" />
                                <stop offset="100%" stopColor="#050d1d" />
                            </linearGradient>
                            <linearGradient id="navyGradBottom2" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#040a17" />
                                <stop offset="100%" stopColor="#091835" />
                            </linearGradient>
                        </defs>
                    </svg>

                    {/* ══════════════════════════════════════════════════════════════
                        3. TOP-RIGHT ANGLED BANNER (THE EXACT SHAPE FROM IMAGE 1)
                       ══════════════════════════════════════════════════════════════ */}
                    <div 
                        className="absolute top-0 right-[40px] w-[630px] h-[160px] pointer-events-none z-10"
                        style={{
                            clipPath: 'polygon(14% 0%, 100% 0%, 100% 100%, 0% 100%)',
                            background: 'linear-gradient(135deg, #091a38 0%, #08142c 50%, #040a17 100%)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        }}
                    >
                        {/* Gold Top Border */}
                        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c69a3d] via-[#f5db8b] to-[#c69a3d]" />
                        
                        {/* Gold Slanted Left Border Accent */}
                        <div 
                            className="absolute top-0 left-0 w-[4px] h-full"
                            style={{
                                background: 'linear-gradient(to bottom, #f5db8b, #c69a3d, #966d18)',
                                transform: 'skewX(-26deg)',
                                transformOrigin: 'top left',
                            }}
                        />

                        {/* Gold Bottom Border */}
                        <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c69a3d] via-[#f5db8b] to-[#c69a3d]" />

                        {/* Banner Typography */}
                        <div className="w-full h-full flex flex-col items-center justify-center pl-[60px] pr-[30px] pt-1">
                            {/* Title: AUTHORISED SUPER DISTRIBUTOR / AUTHORISED DISTRIBUTOR */}
                            <span 
                                className="font-serif font-[800] uppercase text-[#e9c565] tracking-[0.14em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] text-center"
                                style={{
                                    fontSize: titleText.length > 25 ? '18px' : '20px',
                                    fontFamily: 'Cinzel, Georgia, "Times New Roman", serif',
                                }}
                            >
                                {titleText}
                            </span>

                            {/* 3 Gold Stars */}
                            <div className="flex items-center space-x-2 my-1 text-[#f5db8b] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                <span className="text-[12px]">★</span>
                                <span className="text-[16px]">★</span>
                                <span className="text-[12px]">★</span>
                            </div>

                            {/* CERTIFICATE */}
                            <span 
                                className="font-serif font-[900] text-white tracking-[0.26em] uppercase drop-shadow-[0_3px_8px_rgba(0,0,0,0.7)] text-[32px] leading-none"
                                style={{
                                    fontFamily: 'Cinzel, Georgia, "Times New Roman", serif',
                                }}
                            >
                                C E R T I F I C A T E
                            </span>
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════════
                        4. STRUCTURED CONTENT CONTAINER (FLEX COLUMN)
                       ══════════════════════════════════════════════════════════════ */}
                    <div className="relative z-20 w-full h-full flex flex-col justify-between px-[50px] py-[32px] box-border">
                        
                        {/* 4.1 TOP ROW: LOGO (STRICTLY CONTAINED, NO OVERFLOW) */}
                        <div className="flex items-start justify-between w-full h-[140px]">
                            {/* Left: Strictly Sized Logo */}
                            <div className="flex flex-col items-start pt-2 pl-4">
                                <img
                                    src={rupikshaLogo}
                                    alt="Rupiksha"
                                    className="w-[155px] h-[115px] object-contain block drop-shadow-sm"
                                    style={{
                                        maxWidth: '155px',
                                        maxHeight: '115px',
                                    }}
                                />
                            </div>
                            {/* Right empty space reserved for the top-right banner */}
                            <div className="w-[500px] h-[140px]" />
                        </div>

                        {/* 4.2 MAIN RECIPIENT & CERTIFICATION STATEMENT */}
                        <div className="flex flex-col items-center text-center -mt-2">
                            {/* Gold Filigree Ornament */}
                            <div className="flex items-center space-x-3 text-[#c69a3d] mb-1">
                                <span className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#c69a3d]" />
                                <span className="text-[13px]">❖</span>
                                <span className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#c69a3d]" />
                            </div>

                            {/* Italic Certification Intro */}
                            <p 
                                className="italic font-serif text-[#2b3952] text-[16px] tracking-wide mb-1"
                                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                            >
                                This is to certify that
                            </p>

                            {/* Large Recipient Name */}
                            <h1 
                                className="font-serif font-[900] text-[#08142c] uppercase tracking-[0.06em] leading-tight my-1 drop-shadow-sm"
                                style={{
                                    fontFamily: 'Cinzel, Georgia, "Times New Roman", serif',
                                    fontSize: recipientName.length > 24 ? '28px' : '36px',
                                }}
                            >
                                {recipientName}
                            </h1>

                            {/* Gold Filigree Ornament */}
                            <div className="flex items-center space-x-3 text-[#c69a3d] my-1">
                                <span className="w-20 h-[1.5px] bg-gradient-to-r from-transparent to-[#c69a3d]" />
                                <span className="text-[11px]">✦</span>
                                <span className="w-20 h-[1.5px] bg-gradient-to-l from-transparent to-[#c69a3d]" />
                            </div>

                            {/* Certification Description */}
                            <p className="text-[13.5px] font-[500] text-[#1e293b] max-w-[780px] leading-relaxed mt-0.5">
                                {certStatement}
                            </p>
                        </div>

                        {/* 4.3 FOUR INFORMATION BADGES (EXACT 1:1 TO IMAGE 1) */}
                        <div className="flex items-center justify-center space-x-6 px-4 my-1">
                            {/* 1. ID */}
                            <div className="flex items-center space-x-2.5">
                                <div className="w-9 h-9 rounded-full bg-[#fbf5e6] border border-[#c69a3d]/50 flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4 text-[#c69a3d]" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <p className="text-[8.5px] font-[800] tracking-wider text-slate-500 uppercase">{idLabelText}</p>
                                    <p className="text-[14px] font-[900] text-[#08142c] font-mono tracking-tight">{partyCodeText}</p>
                                </div>
                            </div>

                            <span className="h-7 w-[1px] bg-slate-300" />

                            {/* 2. ISSUED ON */}
                            <div className="flex items-center space-x-2.5">
                                <div className="w-9 h-9 rounded-full bg-[#fbf5e6] border border-[#c69a3d]/50 flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4 text-[#c69a3d]" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <p className="text-[8.5px] font-[800] tracking-wider text-slate-500 uppercase">ISSUED ON</p>
                                    <p className="text-[14px] font-[900] text-[#08142c] font-mono tracking-tight">{issuedOnText}</p>
                                </div>
                            </div>

                            <span className="h-7 w-[1px] bg-slate-300" />

                            {/* 3. VALID TILL */}
                            <div className="flex items-center space-x-2.5">
                                <div className="w-9 h-9 rounded-full bg-[#fbf5e6] border border-[#c69a3d]/50 flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4 text-[#c69a3d]" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <p className="text-[8.5px] font-[800] tracking-wider text-slate-500 uppercase">VALID TILL</p>
                                    <p className="text-[14px] font-[900] text-[#08142c] font-mono tracking-tight">{validTillText}</p>
                                </div>
                            </div>

                            <span className="h-7 w-[1px] bg-slate-300" />

                            {/* 4. LOCATION */}
                            <div className="flex items-center space-x-2.5">
                                <div className="w-9 h-9 rounded-full bg-[#fbf5e6] border border-[#c69a3d]/50 flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4 text-[#c69a3d]" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <p className="text-[8.5px] font-[800] tracking-wider text-slate-500 uppercase">LOCATION</p>
                                    <p className="text-[14px] font-[900] text-[#08142c] uppercase tracking-tight">{locationText}</p>
                                </div>
                            </div>
                        </div>

                        {/* 4.4 CENTER PARTY CODE OVAL BADGE */}
                        <div className="flex items-center justify-center my-0.5">
                            <div className="flex items-center space-x-2">
                                <span className="w-20 h-[1.5px] bg-[#c69a3d]" />
                                <span className="text-[#c69a3d] text-xs">✦</span>
                                <div className="px-7 py-1 rounded-full bg-[#08142c] border-[1.5px] border-[#c69a3d] text-[#f5db8b] font-mono font-[900] text-[15px] tracking-widest shadow-md flex items-center space-x-2.5">
                                    <span className="text-[11px] text-[#c69a3d]">✦</span>
                                    <span>{partyCodeText}</span>
                                    <span className="text-[11px] text-[#c69a3d]">✦</span>
                                </div>
                                <span className="text-[#c69a3d] text-xs">✦</span>
                                <span className="w-20 h-[1.5px] bg-[#c69a3d]" />
                            </div>
                        </div>

                        {/* 4.5 AUTHORIZATION CLAUSE */}
                        <div className="text-center px-10 -mt-1">
                            <p className="text-[11px] text-[#334155] leading-relaxed max-w-[800px] mx-auto font-medium">
                                {authClause}
                            </p>
                        </div>

                        {/* 4.6 BOTTOM FOOTER SECTION (ROLE + PERFORMANCE DISCLAIMER NOTE) */}
                        <div className="flex flex-col items-start pl-8 pr-4 pb-1">
                            <div className="text-[12px] font-[900] uppercase tracking-wider text-[#08142c]">
                                {bottomRoleText}
                            </div>
                            <p className="text-[9.5px] text-[#334155] font-medium leading-normal mt-0.5">
                                {disclaimerText}
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Certificate;

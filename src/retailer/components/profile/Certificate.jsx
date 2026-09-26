import React, { useState, useEffect, useRef } from 'react';
import { Award, Download, Printer, Copy, Check, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import rupikshaLogo from '../../../assets/logo rupiksha.png';
import { certificateService } from '../../../services/apiService';

const Certificate = ({ formData = {}, currentUser = {} }) => {
    const certificateSvgRef = useRef(null);
    const containerRef = useRef(null);
    const [certData, setCertData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [safeLogoUrl, setSafeLogoUrl] = useState(rupikshaLogo);

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

    // Convert logo to data URL for clean Canvas/PDF rendering
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = rupikshaLogo;
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || 600;
                canvas.height = img.naturalHeight || 600;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                setSafeLogoUrl(canvas.toDataURL('image/png'));
            } catch {
                setSafeLogoUrl(rupikshaLogo);
            }
        };
        img.onerror = () => setSafeLogoUrl(rupikshaLogo);
    }, []);

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
        const element = containerRef.current;
        if (!element || isDownloading) return;
        setIsDownloading(true);

        try {
            const canvas = await html2canvas(element, {
                scale: 3.5, // 300+ DPI Equivalent
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#FAF8F2',
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
            alert('Could not export PDF. Please try again.');
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
                <p className="text-slate-600 font-semibold text-sm">Generating master certificate...</p>
            </div>
        );
    }

    const d = certData || {};
    const recipientName = (d.recipientName || fallbackName).toUpperCase();
    const titleText = d.certificateTitle || (isSuperDistributor ? 'AUTHORISED SUPER DISTRIBUTOR' : 'AUTHORISED DISTRIBUTOR');
    const idLabelText = d.idLabel || (isSuperDistributor ? 'SUPER DISTRIBUTOR ID' : 'DISTRIBUTOR ID');
    const partyCodeText = d.partyCode || fallbackPartyCode;
    const issuedOnText = d.issuedOn || formatDate(createdD);
    const validTillText = d.validTill || formatValidTill(createdD);
    const locationText = (d.location || fallbackLocation).toUpperCase();
    const certStatement = d.certificationStatement || `is an Authorised ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} for delivering Rupiksha Services Pvt. Ltd. digital financial services.`;
    const bottomRoleText = d.bottomRole || (isSuperDistributor ? 'SUPER DISTRIBUTOR' : 'DISTRIBUTOR');
    const disclaimerText = d.disclaimerNote || `NOTE: If you will not perform up to the mark, then your ${isSuperDistributor ? 'Super Distributor' : 'Distributor'} location will be allocated to some other person.`;

    // Dynamic recipient name font scaling
    const nameFontSize = recipientName.length > 28 ? 72 : (recipientName.length > 20 ? 84 : 96);

    return (
        <div className="w-full flex flex-col items-center space-y-6 font-['Inter',sans-serif]">
            {/* Control Toolbar */}
            <div className="w-full max-w-[1050px] flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20 text-white">
                        <Award size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-[#071A3A] flex items-center gap-2">
                            {titleText}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                                {d.status || 'VALID'}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">Master Digital Certificate &bull; Party Code: <strong className="text-slate-700 font-mono">{partyCodeText}</strong></p>
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
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-[#071A3A] hover:bg-[#0D2A55] text-white flex items-center space-x-2 shadow-lg shadow-slate-900/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
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

            {/* Master Scalable Certificate Frame (viewBox 0 0 2970 2100: Exact A4 Landscape Proportion) */}
            <div className="w-full flex justify-center overflow-x-auto pb-6">
                <div 
                    ref={containerRef}
                    className="w-full max-w-[1050px] aspect-[297/210] shadow-2xl rounded-none overflow-hidden bg-[#FAF8F2]"
                >
                    <svg
                        ref={certificateSvgRef}
                        viewBox="0 0 2970 2100"
                        width="100%"
                        height="100%"
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-full h-full block select-none"
                    >
                        <defs>
                            {/* Rich Metallic Champagne Gold Gradient */}
                            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#F5DB8B" />
                                <stop offset="25%" stopColor="#C89A3D" />
                                <stop offset="50%" stopColor="#E2C16B" />
                                <stop offset="75%" stopColor="#966D18" />
                                <stop offset="100%" stopColor="#F5DB8B" />
                            </linearGradient>

                            {/* Deep Midnight Navy Gradient */}
                            <linearGradient id="navyMainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#0B2145" />
                                <stop offset="40%" stopColor="#071A3A" />
                                <stop offset="100%" stopColor="#030A17" />
                            </linearGradient>

                            {/* Top Right Header Banner Navy Gradient */}
                            <linearGradient id="bannerNavyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#0D2A55" />
                                <stop offset="30%" stopColor="#071A3A" />
                                <stop offset="100%" stopColor="#030814" />
                            </linearGradient>

                            {/* Subtle Wave Gradient */}
                            <linearGradient id="waveGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#C89A3D" stopOpacity="0.12" />
                                <stop offset="50%" stopColor="#E2C16B" stopOpacity="0.08" />
                                <stop offset="100%" stopColor="#966D18" stopOpacity="0.04" />
                            </linearGradient>

                            {/* Drop Shadow for Title & Banner */}
                            <filter id="bannerShadow" x="-5%" y="-5%" width="110%" height="120%">
                                <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#000000" floodOpacity="0.25" />
                            </filter>
                        </defs>

                        {/* 1. SOLID IVORY BACKGROUND */}
                        <rect x="0" y="0" width="2970" height="2100" fill="#FAF8F2" />

                        {/* 2. SUBTLE LUXURY BACKGROUND WAVES */}
                        <g opacity="0.8">
                            <path d="M-50,600 C400,500 800,750 1400,600 C2000,450 2400,700 3050,550" fill="none" stroke="#D9C8A3" strokeWidth="2.5" opacity="0.12" />
                            <path d="M-50,640 C400,540 800,790 1400,640 C2000,490 2400,740 3050,590" fill="none" stroke="#D9C8A3" strokeWidth="2.5" opacity="0.10" />
                            <path d="M-50,680 C400,580 800,830 1400,680 C2000,530 2400,780 3050,630" fill="none" stroke="#D9C8A3" strokeWidth="2" opacity="0.08" />
                            <path d="M-50,1500 C500,1400 1000,1650 1600,1500 C2200,1350 2600,1600 3050,1450" fill="none" stroke="#D9C8A3" strokeWidth="2.5" opacity="0.12" />
                            <path d="M-50,1540 C500,1440 1000,1690 1600,1540 C2200,1390 2600,1640 3050,1490" fill="none" stroke="#D9C8A3" strokeWidth="2" opacity="0.09" />
                        </g>

                        {/* 3. MULTI-LAYER OUTER FRAME & BORDERS */}
                        {/* Outer Deep Navy Frame (36px) */}
                        <rect x="18" y="18" width="2934" height="2064" fill="none" stroke="#071A3A" strokeWidth="36" />

                        {/* Fine Gold Inset Line (6px) */}
                        <rect x="54" y="54" width="2862" height="1992" fill="none" stroke="url(#goldGrad)" strokeWidth="6" />

                        {/* Fine Inner Navy Line (2.5px) */}
                        <rect x="68" y="68" width="2834" height="1964" fill="none" stroke="#071A3A" strokeWidth="2.5" />

                        {/* Four Corner Gold Diagonal Accents */}
                        <polygon points="54,54 110,54 54,110" fill="url(#goldGrad)" />
                        <polygon points="2916,54 2860,54 2916,110" fill="url(#goldGrad)" />
                        <polygon points="54,2046 110,2046 54,1990" fill="url(#goldGrad)" />
                        <polygon points="2916,2046 2860,2046 2916,1990" fill="url(#goldGrad)" />

                        {/* 4. TOP-RIGHT CORNER LUXURY GEOMETRIC RIBBONS */}
                        <g>
                            <polygon points="2300,54 2420,54 2916,550 2916,430" fill="url(#goldGrad)" opacity="0.9" />
                            <polygon points="2420,54 2650,54 2916,320 2916,550" fill="url(#navyMainGrad)" />
                            <polygon points="2650,54 2916,54 2916,320" fill="url(#goldGrad)" />
                        </g>

                        {/* 5. TOP-RIGHT ANGLED NAVY/GOLD BANNER (EXACT MASTER PROPORTION) */}
                        <g filter="url(#bannerShadow)">
                            {/* Main Navy Polygon Banner */}
                            <polygon 
                                points="1020,54 2916,54 2916,510 880,510" 
                                fill="url(#bannerNavyGrad)" 
                            />

                            {/* Top Gold Border */}
                            <line x1="1020" y1="56" x2="2916" y2="56" stroke="url(#goldGrad)" strokeWidth="8" />

                            {/* Slanted Left Gold Edge */}
                            <line x1="1020" y1="54" x2="880" y2="510" stroke="url(#goldGrad)" strokeWidth="12" />

                            {/* Bottom Gold Border */}
                            <line x1="880" y1="506" x2="2916" y2="506" stroke="url(#goldGrad)" strokeWidth="8" />

                            {/* Inner Gold Pinstripe Accents */}
                            <line x1="1040" y1="72" x2="2900" y2="72" stroke="url(#goldGrad)" strokeWidth="2" opacity="0.6" />
                            <line x1="900" y1="490" x2="2900" y2="490" stroke="url(#goldGrad)" strokeWidth="2" opacity="0.6" />

                            {/* Header Text 1: AUTHORISED SUPER DISTRIBUTOR / AUTHORISED DISTRIBUTOR */}
                            <text
                                x="1950"
                                y="195"
                                textAnchor="middle"
                                fill="#E2C16B"
                                fontSize="58"
                                fontWeight="800"
                                letterSpacing="6"
                                style={{ fontFamily: 'Cinzel, Playfair Display, "Times New Roman", serif', textTransform: 'uppercase' }}
                            >
                                {titleText}
                            </text>

                            {/* 3 Gold Stars with Horizontal Accent Lines */}
                            <g>
                                <line x1="1650" y1="260" x2="1830" y2="260" stroke="url(#goldGrad)" strokeWidth="3" />
                                <text x="1890" y="272" fill="#E2C16B" fontSize="34" textAnchor="middle">★</text>
                                <text x="1950" y="275" fill="#F5DB8B" fontSize="48" textAnchor="middle">★</text>
                                <text x="2010" y="272" fill="#E2C16B" fontSize="34" textAnchor="middle">★</text>
                                <line x1="2070" y1="260" x2="2250" y2="260" stroke="url(#goldGrad)" strokeWidth="3" />
                            </g>

                            {/* Header Text 2: C E R T I F I C A T E */}
                            <text
                                x="1950"
                                y="425"
                                textAnchor="middle"
                                fill="#FFFFFF"
                                fontSize="118"
                                fontWeight="900"
                                letterSpacing="26"
                                style={{ fontFamily: 'Cinzel, Playfair Display, "Times New Roman", serif' }}
                            >
                                C E R T I F I C A T E
                            </text>
                        </g>

                        {/* 6. TOP-LEFT LOGO & TAGLINE */}
                        <g>
                            <image
                                href={safeLogoUrl || rupikshaLogo}
                                x="160"
                                y="110"
                                width="490"
                                height="370"
                                preserveAspectRatio="xMidYMid meet"
                            />
                        </g>

                        {/* 7. MAIN BODY: "This is to certify that" */}
                        <g>
                            {/* Top Gold Filigree Ornament */}
                            <line x1="1240" y1="630" x2="1420" y2="630" stroke="url(#goldGrad)" strokeWidth="3" />
                            <polygon points="1485,618 1497,630 1485,642 1473,630" fill="url(#goldGrad)" />
                            <line x1="1550" y1="630" x2="1730" y2="630" stroke="url(#goldGrad)" strokeWidth="3" />

                            {/* Italic Intro */}
                            <text
                                x="1485"
                                y="715"
                                textAnchor="middle"
                                fill="#0B2145"
                                fontSize="52"
                                fontStyle="italic"
                                fontWeight="500"
                                style={{ fontFamily: 'Playfair Display, "Times New Roman", Georgia, serif' }}
                            >
                                This is to certify that
                            </text>

                            {/* RECIPIENT NAME (THE MAIN CONTENT FOCAL POINT) */}
                            <text
                                x="1485"
                                y="845"
                                textAnchor="middle"
                                fill="#071A3A"
                                fontSize={nameFontSize}
                                fontWeight="900"
                                letterSpacing="3"
                                style={{ fontFamily: 'Cinzel, Playfair Display, "Times New Roman", serif', textTransform: 'uppercase' }}
                            >
                                {recipientName}
                            </text>

                            {/* Bottom Gold Filigree Ornament */}
                            <line x1="1180" y1="920" x2="1420" y2="920" stroke="url(#goldGrad)" strokeWidth="3" />
                            <polygon points="1485,908 1497,920 1485,932 1473,920" fill="url(#goldGrad)" />
                            <line x1="1550" y1="920" x2="1790" y2="920" stroke="url(#goldGrad)" strokeWidth="3" />

                            {/* Description Statement */}
                            <text
                                x="1485"
                                y="1005"
                                textAnchor="middle"
                                fill="#0B2145"
                                fontSize="38"
                                fontWeight="500"
                                style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}
                            >
                                {certStatement}
                            </text>
                        </g>

                        {/* 8. FOUR INFORMATION BADGES (COLUMNS) */}
                        <g>
                            {/* Column 1: ID */}
                            <g transform="translate(480, 1170)">
                                <circle cx="0" cy="0" r="54" fill="#FAF3E0" stroke="url(#goldGrad)" strokeWidth="4" />
                                <path d="M-18,18 C-18,2 -6,-8 0,-8 C6,-8 18,2 18,18 Z M0,-14 C-10,-14 -10,-28 0,-28 C10,-28 10,-14 0,-14 Z" fill="#C89A3D" />
                                <text x="75" y="-12" fill="#596273" fontSize="28" fontWeight="800" letterSpacing="1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                    {idLabelText}
                                </text>
                                <text x="75" y="32" fill="#071A3A" fontSize="48" fontWeight="900" style={{ fontFamily: 'Montserrat, monospace, sans-serif' }}>
                                    {partyCodeText}
                                </text>
                            </g>

                            {/* Divider 1 */}
                            <line x1="880" y1="1120" x2="880" y2="1220" stroke="#C89A3D" strokeWidth="2.5" opacity="0.6" />

                            {/* Column 2: ISSUED ON */}
                            <g transform="translate(1160, 1170)">
                                <circle cx="0" cy="0" r="54" fill="#FAF3E0" stroke="url(#goldGrad)" strokeWidth="4" />
                                <path d="M-16,-20 L-16,20 L16,20 L16,-20 Z M-10,-24 L-10,-18 M10,-24 L10,-18 M-16,-8 L16,-8" fill="none" stroke="#C89A3D" strokeWidth="4" strokeLinecap="round" />
                                <text x="75" y="-12" fill="#596273" fontSize="28" fontWeight="800" letterSpacing="1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                    ISSUED ON
                                </text>
                                <text x="75" y="32" fill="#071A3A" fontSize="48" fontWeight="900" style={{ fontFamily: 'Montserrat, monospace, sans-serif' }}>
                                    {issuedOnText}
                                </text>
                            </g>

                            {/* Divider 2 */}
                            <line x1="1540" y1="1120" x2="1540" y2="1220" stroke="#C89A3D" strokeWidth="2.5" opacity="0.6" />

                            {/* Column 3: VALID TILL */}
                            <g transform="translate(1820, 1170)">
                                <circle cx="0" cy="0" r="54" fill="#FAF3E0" stroke="url(#goldGrad)" strokeWidth="4" />
                                <path d="M-16,-20 L-16,20 L16,20 L16,-20 Z M-10,-24 L-10,-18 M10,-24 L10,-18 M-16,-8 L16,-8" fill="none" stroke="#C89A3D" strokeWidth="4" strokeLinecap="round" />
                                <text x="75" y="-12" fill="#596273" fontSize="28" fontWeight="800" letterSpacing="1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                    VALID TILL
                                </text>
                                <text x="75" y="32" fill="#071A3A" fontSize="48" fontWeight="900" style={{ fontFamily: 'Montserrat, monospace, sans-serif' }}>
                                    {validTillText}
                                </text>
                            </g>

                            {/* Divider 3 */}
                            <line x1="2200" y1="1120" x2="2200" y2="1220" stroke="#C89A3D" strokeWidth="2.5" opacity="0.6" />

                            {/* Column 4: LOCATION */}
                            <g transform="translate(2480, 1170)">
                                <circle cx="0" cy="0" r="54" fill="#FAF3E0" stroke="url(#goldGrad)" strokeWidth="4" />
                                <path d="M0,22 C0,22 -18,2 -18,-10 C-18,-20 -10,-28 0,-28 C10,-28 18,-20 18,-10 C18,2 0,22 0,22 Z M0,-4 C-3.5,-4 -6.5,-7 -6.5,-10.5 C-6.5,-14 -3.5,-17 0,-17 C3.5,-17 6.5,-14 6.5,-10.5 C6.5,-7 3.5,-4 0,-4 Z" fill="#C89A3D" />
                                <text x="75" y="-12" fill="#596273" fontSize="28" fontWeight="800" letterSpacing="1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                    LOCATION
                                </text>
                                <text x="75" y="32" fill="#071A3A" fontSize="48" fontWeight="900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                    {locationText}
                                </text>
                            </g>
                        </g>

                        {/* 9. CENTER PARTY CODE OVAL BADGE (✦ RD0002 ✦) */}
                        <g>
                            {/* Left Gold Extension Line */}
                            <line x1="680" y1="1350" x2="1240" y2="1350" stroke="url(#goldGrad)" strokeWidth="3.5" />
                            <polygon points="680,1350 690,1342 700,1350 690,1358" fill="url(#goldGrad)" />
                            <polygon points="1230,1350 1240,1342 1250,1350 1240,1358" fill="url(#goldGrad)" />

                            {/* Center Dark Navy Pill Badge */}
                            <rect
                                x="1275"
                                y="1308"
                                width="420"
                                height="84"
                                rx="42"
                                fill="#071A3A"
                                stroke="url(#goldGrad)"
                                strokeWidth="4"
                            />

                            {/* Badge Text: ✦ RD0002 ✦ */}
                            <text
                                x="1485"
                                y="1364"
                                textAnchor="middle"
                                fill="#E2C16B"
                                fontSize="44"
                                fontWeight="900"
                                letterSpacing="4"
                                style={{ fontFamily: 'Montserrat, monospace, sans-serif' }}
                            >
                                ✦  {partyCodeText}  ✦
                            </text>

                            {/* Right Gold Extension Line */}
                            <line x1="1730" y1="1350" x2="2290" y2="1350" stroke="url(#goldGrad)" strokeWidth="3.5" />
                            <polygon points="1720,1350 1730,1342 1740,1350 1730,1358" fill="url(#goldGrad)" />
                            <polygon points="2280,1350 2290,1342 2300,1350 2290,1358" fill="url(#goldGrad)" />
                        </g>

                        {/* 10. LEGAL AUTHORIZATION CLAUSE */}
                        <g>
                            <text
                                x="1485"
                                y="1480"
                                textAnchor="middle"
                                fill="#0B2145"
                                fontSize="33"
                                fontWeight="500"
                                style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}
                            >
                                This {isSuperDistributor ? 'Super Distributor' : 'Distributor'} is hereby authorised for providing the services offered by Rupiksha Services Pvt. Ltd.
                            </text>
                            <text
                                x="1485"
                                y="1530"
                                textAnchor="middle"
                                fill="#0B2145"
                                fontSize="33"
                                fontWeight="500"
                                style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}
                            >
                                and shall not act as our representative in any capacity for any other purpose whatsoever.
                            </text>
                        </g>

                        {/* 11. BOTTOM-LEFT LUXURY FLOWING NAVY/GOLD WAVES (BEHIND TEXT) */}
                        <g>
                            {/* Deep Navy Curved Wave */}
                            <path
                                d="M54,1650 C220,1650 380,1850 780,2046 L54,2046 Z"
                                fill="url(#navyMainGrad)"
                            />
                            {/* Gold Edge Line */}
                            <path
                                d="M54,1644 C220,1644 380,1844 780,2040 L780,2046 C380,1850 220,1650 54,1650 Z"
                                fill="url(#goldGrad)"
                            />
                            {/* Inner Accent Wave */}
                            <path
                                d="M54,1780 C180,1780 320,1920 620,2046 L54,2046 Z"
                                fill="#040A17"
                            />
                            <path
                                d="M54,1776 C180,1776 320,1916 620,2042 L620,2046 C320,1920 180,1780 54,1780 Z"
                                fill="url(#goldGrad)"
                            />
                        </g>

                        {/* 12. BOTTOM SECTION: ROLE & DISCLAIMER NOTE (ON CLEAN IVORY) */}
                        <g transform="translate(680, 1690)">
                            {/* Role Label */}
                            <text
                                x="0"
                                y="0"
                                fill="#071A3A"
                                fontSize="38"
                                fontWeight="900"
                                letterSpacing="2"
                                style={{ fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase' }}
                            >
                                {bottomRoleText}
                            </text>
                            <line x1="0" y1="12" x2="360" y2="12" stroke="url(#goldGrad)" strokeWidth="3" />

                            {/* Disclaimer Note */}
                            <text
                                x="0"
                                y="60"
                                fill="#0B2145"
                                fontSize="27"
                                fontWeight="600"
                                style={{ fontFamily: 'Montserrat, sans-serif' }}
                            >
                                {disclaimerText}
                            </text>
                        </g>

                    </svg>
                </div>
            </div>
        </div>
    );
};

export default Certificate;

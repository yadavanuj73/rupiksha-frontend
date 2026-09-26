import React, { useState, useEffect, useRef } from 'react';
import { Award, Download, Printer, Copy, Check, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import rupikshaLogo from '/logo rupiksha transprent.png';
import { certificateService } from '../../../services/apiService';

const RetailerCertificate = ({ formData = {}, currentUser = {} }) => {
    const certificateSvgRef = useRef(null);
    const containerRef = useRef(null);
    const [certData, setCertData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [safeLogoUrl, setSafeLogoUrl] = useState('/logo rupiksha transprent.png');

    // Parse creation date into dd-MMM-yyyy (e.g. 15-May-2026)
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

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const formatDisplayDate = (d) => {
        const date = d instanceof Date ? d : new Date(d);
        const day = String(date.getDate()).padStart(2, '0');
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const formatValidTill = (createdDate) => {
        const d = new Date(createdDate);
        d.setFullYear(d.getFullYear() + 1);
        return formatDisplayDate(d);
    };

    const buildFullAddress = () => {
        const parts = [];
        const addr1 = formData?.address1 || formData?.shopAddress || formData?.residentialAddress1 || currentUser?.shopAddress || currentUser?.addressLine1 || currentUser?.permanentAddress || '';
        if (addr1) parts.push(addr1.trim());

        const area = formData?.area || formData?.personalArea || currentUser?.area || '';
        if (area && !parts.some(p => p.toLowerCase().includes(area.toLowerCase()))) parts.push(area.trim());

        const city = formData?.city || formData?.shopCity || currentUser?.city || currentUser?.shopCity || currentUser?.permCity || '';
        if (city && !parts.some(p => p.toLowerCase().includes(city.toLowerCase()))) parts.push(city.trim());

        const state = formData?.state || formData?.stateName || currentUser?.stateName || currentUser?.shopState || currentUser?.permState || '';
        if (state && !parts.some(p => p.toLowerCase().includes(state.toLowerCase()))) parts.push(state.trim());

        const pincode = formData?.pincode || formData?.shopPincode || formData?.personalPincode || currentUser?.pincode || currentUser?.shopPincode || currentUser?.permPincode || '';
        
        let formatted = parts.join(', ');
        if (pincode) {
            formatted = formatted ? `${formatted} - ${pincode}` : pincode;
        }
        return formatted || 'Ward No. 12, Main Road, Nalanda, Bihar - 803101';
    };

    const createdD = resolveCreatedDate();
    const fallbackPartyCode = formData?.partyCode || currentUser?.partyCode || 'RT000123';
    const fallbackName = (formData?.name || currentUser?.name || currentUser?.fullName || 'Rakesh Kumar');
    const fallbackFullAddress = buildFullAddress();
    const fallbackCertNumber = `RUP-R-${fallbackPartyCode}`;
    const fallbackIssuedOn = formatDisplayDate(createdD);
    const fallbackValidTill = formatValidTill(createdD);
    const fallbackDownloadDate = formatDisplayDate(new Date());

    // Convert logo to safe Data URL for canvas/pdf exports
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
                        certificateRole: 'RETAILER',
                        roleDisplayName: 'Retailer',
                        certificateTitle: 'RETAILER CERTIFICATE',
                        certificateType: 'RETAILER CERTIFICATE',
                        idLabel: 'RETAILER ID',
                        recipientName: fallbackName,
                        issuedOn: fallbackIssuedOn,
                        validTill: fallbackValidTill,
                        fullAddress: fallbackFullAddress,
                        downloadDate: fallbackDownloadDate,
                        certificationStatement: 'has been onboarded as a Retailer of Rupiksha Services Private Limited',
                        authorizationClause: 'w.e.f. the Retailer ID creation date. The retailer is authorized to provide and distribute the banking and financial technology services offered by Rupiksha Services Private Limited through its Web Portal and Mobile Application, subject to the terms & conditions accepted by the retailer and the applicable company policies.',
                        bottomRole: 'RETAILER',
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
                    certificateRole: 'RETAILER',
                    roleDisplayName: 'Retailer',
                    certificateTitle: 'RETAILER CERTIFICATE',
                    certificateType: 'RETAILER CERTIFICATE',
                    idLabel: 'RETAILER ID',
                    recipientName: fallbackName,
                    issuedOn: fallbackIssuedOn,
                    validTill: fallbackValidTill,
                    fullAddress: fallbackFullAddress,
                    downloadDate: fallbackDownloadDate,
                    certificationStatement: 'has been onboarded as a Retailer of Rupiksha Services Private Limited',
                    authorizationClause: 'w.e.f. the Retailer ID creation date. The retailer is authorized to provide and distribute the banking and financial technology services offered by Rupiksha Services Private Limited through its Web Portal and Mobile Application, subject to the terms & conditions accepted by the retailer and the applicable company policies.',
                    bottomRole: 'RETAILER',
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
                scale: 3.5, // 300+ DPI razor sharp output
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
            const safeName = (certData?.recipientName || 'Rupiksha_Retailer').replace(/[^a-zA-Z0-9_-]/g, '_');
            const certCode = (certData?.partyCode || 'RT').replace(/[^a-zA-Z0-9_-]/g, '_');
            pdf.save(`Rupiksha_Retailer_Certificate_${certCode}_${safeName}.pdf`);
        } catch (err) {
            console.error('[RetailerCertificate] PDF Export Error:', err);
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
                <p className="text-slate-600 font-semibold text-sm">Generating Retailer Certificate...</p>
            </div>
        );
    }

    const d = certData || {};
    const recipientName = d.recipientName || fallbackName;
    const partyCodeText = d.partyCode || fallbackPartyCode;
    const issuedOnText = d.issuedOn || fallbackIssuedOn;
    const validTillText = d.validTill || fallbackValidTill;
    const fullAddressText = d.fullAddress || fallbackFullAddress;
    const downloadDateText = d.downloadDate || fallbackDownloadDate;

    return (
        <div className="w-full flex flex-col items-center space-y-6 font-['Inter',sans-serif]">
            {/* Control Toolbar */}
            <div className="w-full max-w-[1050px] flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
                        <Award size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-[#071A3A] flex items-center gap-2">
                            RETAILER CERTIFICATE
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                                {d.status || 'VALID'}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">Official Digital Authorization &bull; Retailer ID: <strong className="text-slate-700 font-mono">{partyCodeText}</strong></p>
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
                            <linearGradient id="goldGradRetailer" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#F5DB8B" />
                                <stop offset="25%" stopColor="#C89A3D" />
                                <stop offset="50%" stopColor="#E2C16B" />
                                <stop offset="75%" stopColor="#966D18" />
                                <stop offset="100%" stopColor="#F5DB8B" />
                            </linearGradient>

                            {/* Deep Midnight Navy Gradient */}
                            <linearGradient id="navyMainGradRetailer" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#0B2145" />
                                <stop offset="40%" stopColor="#071A3A" />
                                <stop offset="100%" stopColor="#030A17" />
                            </linearGradient>

                            {/* Top Right Header Banner Navy Gradient */}
                            <linearGradient id="bannerNavyGradRetailer" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#0D2A55" />
                                <stop offset="30%" stopColor="#071A3A" />
                                <stop offset="100%" stopColor="#030814" />
                            </linearGradient>

                            {/* Drop Shadow for Banner */}
                            <filter id="bannerShadowRetailer" x="-5%" y="-5%" width="110%" height="120%">
                                <feDropShadow dx="0" dy="16" stdDeviation="20" floodColor="#000000" floodOpacity="0.3" />
                            </filter>
                        </defs>

                        {/* 1. SOLID IVORY BACKGROUND */}
                        <rect x="0" y="0" width="2970" height="2100" fill="#FAF8F2" />

                        {/* 2. SUBTLE LUXURY BACKGROUND WAVES */}
                        <g opacity="0.8">
                            <path d="M-50,600 C400,500 800,750 1400,600 C2000,450 2400,700 3050,550" fill="none" stroke="#D9C8A3" strokeWidth="2.5" opacity="0.14" />
                            <path d="M-50,640 C400,540 800,790 1400,640 C2000,490 2400,740 3050,590" fill="none" stroke="#D9C8A3" strokeWidth="2.5" opacity="0.11" />
                            <path d="M-50,1500 C500,1400 1000,1650 1600,1500 C2200,1350 2600,1600 3050,1450" fill="none" stroke="#D9C8A3" strokeWidth="2.5" opacity="0.14" />
                        </g>

                        {/* 3. MULTI-LAYER OUTER FRAME & BORDERS */}
                        {/* Outer Deep Navy Frame */}
                        <rect x="18" y="18" width="2934" height="2064" fill="none" stroke="#071A3A" strokeWidth="36" />

                        {/* Fine Gold Inset Line */}
                        <rect x="54" y="54" width="2862" height="1992" fill="none" stroke="url(#goldGradRetailer)" strokeWidth="8" />

                        {/* Fine Inner Navy Line */}
                        <rect x="70" y="70" width="2830" height="1960" fill="none" stroke="#071A3A" strokeWidth="3" />

                        {/* Four Corner Gold Diagonal Accents */}
                        <polygon points="54,54 120,54 54,120" fill="url(#goldGradRetailer)" />
                        <polygon points="2916,54 2850,54 2916,120" fill="url(#goldGradRetailer)" />
                        <polygon points="54,2046 120,2046 54,1980" fill="url(#goldGradRetailer)" />
                        <polygon points="2916,2046 2850,2046 2916,1980" fill="url(#goldGradRetailer)" />

                        {/* 4. TOP-RIGHT CORNER LUXURY GEOMETRIC RIBBONS */}
                        <g>
                            <polygon points="2250,54 2400,54 2916,570 2916,420" fill="url(#goldGradRetailer)" opacity="0.95" />
                            <polygon points="2400,54 2680,54 2916,290 2916,570" fill="url(#navyMainGradRetailer)" />
                            <polygon points="2680,54 2916,54 2916,290" fill="url(#goldGradRetailer)" />
                        </g>

                        {/* 5. TOP-RIGHT ANGLED NAVY/GOLD BANNER WITH "Retailer Certificate" */}
                        <g filter="url(#bannerShadowRetailer)">
                            {/* Main Navy Polygon Banner */}
                            <polygon 
                                points="1050,54 2916,54 2916,580 880,580" 
                                fill="url(#bannerNavyGradRetailer)" 
                            />

                            {/* Top Gold Border */}
                            <line x1="1050" y1="56" x2="2916" y2="56" stroke="url(#goldGradRetailer)" strokeWidth="10" />

                            {/* Slanted Left Gold Edge */}
                            <line x1="1050" y1="54" x2="880" y2="580" stroke="url(#goldGradRetailer)" strokeWidth="14" />

                            {/* Bottom Gold Border */}
                            <line x1="880" y1="575" x2="2916" y2="575" stroke="url(#goldGradRetailer)" strokeWidth="10" />

                            {/* Inner Gold Pinstripe Accents */}
                            <line x1="1075" y1="76" x2="2900" y2="76" stroke="url(#goldGradRetailer)" strokeWidth="2.5" opacity="0.7" />
                            <line x1="905" y1="555" x2="2900" y2="555" stroke="url(#goldGradRetailer)" strokeWidth="2.5" opacity="0.7" />

                            {/* Header Title: Retailer Certificate */}
                            <text
                                x="1930"
                                y="325"
                                textAnchor="middle"
                                fill="#FFFFFF"
                                fontSize="118"
                                fontWeight="700"
                                letterSpacing="1"
                                style={{ fontFamily: 'Playfair Display, Cormorant Garamond, "Times New Roman", serif' }}
                            >
                                Retailer Certificate
                            </text>

                            {/* 3 Gold Stars with Horizontal Accent Lines */}
                            <g>
                                <line x1="1560" y1="410" x2="1780" y2="410" stroke="url(#goldGradRetailer)" strokeWidth="3.5" />
                                <text x="1850" y="423" fill="#E2C16B" fontSize="38" textAnchor="middle">★</text>
                                <text x="1930" y="427" fill="#F5DB8B" fontSize="54" textAnchor="middle">★</text>
                                <text x="2010" y="423" fill="#E2C16B" fontSize="38" textAnchor="middle">★</text>
                                <line x1="2080" y1="410" x2="2300" y2="410" stroke="url(#goldGradRetailer)" strokeWidth="3.5" />
                            </g>
                        </g>

                        {/* 6. TOP-LEFT RUPIKSHA LOGO */}
                        <g>
                            <image
                                href={safeLogoUrl || rupikshaLogo}
                                x="110"
                                y="85"
                                width="580"
                                height="480"
                                preserveAspectRatio="xMidYMid meet"
                            />
                        </g>

                        {/* 7. GOLD FILIGREE SEPARATOR 1 */}
                        <g>
                            <line x1="1100" y1="670" x2="1420" y2="670" stroke="url(#goldGradRetailer)" strokeWidth="3.5" />
                            <polygon points="1485,656 1500,670 1485,684 1470,670" fill="url(#goldGradRetailer)" />
                            <line x1="1550" y1="670" x2="1870" y2="670" stroke="url(#goldGradRetailer)" strokeWidth="3.5" />
                        </g>

                        {/* 8. TOP INFORMATION LINE: Retailer ID & Retailer ID Creation Date */}
                        <g>
                            {/* Left: Retailer ID */}
                            <text x="210" y="785" fill="#0B2145" fontSize="40" fontWeight="800" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                                Retailer ID:
                            </text>
                            <text x="470" y="785" fill="#173B7A" fontSize="48" fontWeight="800" style={{ fontFamily: 'Playfair Display, Montserrat, serif' }}>
                                {partyCodeText}
                            </text>
                            {/* Underline below Retailer ID */}
                            <line x1="460" y1="805" x2="960" y2="805" stroke="#254B8C" strokeWidth="2.5" />

                            {/* Right: Retailer ID Creation Date */}
                            <text x="1650" y="785" fill="#0B2145" fontSize="40" fontWeight="800" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                                Retailer ID Creation Date:
                            </text>
                            <text x="2280" y="785" fill="#173B7A" fontSize="48" fontWeight="800" style={{ fontFamily: 'Playfair Display, Montserrat, serif' }}>
                                {issuedOnText}
                            </text>
                            {/* Underline below Creation Date */}
                            <line x1="2270" y1="805" x2="2760" y2="805" stroke="#254B8C" strokeWidth="2.5" />
                        </g>

                        {/* 9. MAIN CERTIFICATION STATEMENT WITH RECIPIENT NAME */}
                        <g>
                            <text x="210" y="930" fill="#0B2145" fontSize="42" fontWeight="500" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                                This is to certify that Mr./Mrs.
                            </text>
                            <text x="890" y="930" fill="#173B7A" fontSize="58" fontWeight="800" style={{ fontFamily: 'Playfair Display, "Times New Roman", serif' }}>
                                {recipientName}
                            </text>
                            {/* Long Underline */}
                            <line x1="860" y1="950" x2="2760" y2="950" stroke="#254B8C" strokeWidth="2.5" />
                        </g>

                        {/* 10. RESIDING AT WITH FULL ADDRESS */}
                        <g>
                            <text x="210" y="1070" fill="#0B2145" fontSize="42" fontWeight="500" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                                residing at
                            </text>
                            <text x="475" y="1070" fill="#173B7A" fontSize="46" fontWeight="700" style={{ fontFamily: 'Playfair Display, "Times New Roman", serif' }}>
                                {fullAddressText}
                            </text>
                            {/* Long Underline */}
                            <line x1="450" y1="1090" x2="2760" y2="1090" stroke="#254B8C" strokeWidth="2.5" />
                        </g>

                        {/* 11. BEARING PARTY CODE LINE */}
                        <g>
                            <text x="210" y="1210" fill="#0B2145" fontSize="42" fontWeight="500" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                                bearing
                            </text>
                            <text x="400" y="1210" fill="#173B7A" fontSize="48" fontWeight="800" style={{ fontFamily: 'Playfair Display, monospace, serif' }}>
                                {partyCodeText}
                            </text>
                            {/* Underline */}
                            <line x1="385" y1="1230" x2="1280" y2="1230" stroke="#254B8C" strokeWidth="2.5" />
                            
                            <text x="1300" y="1210" fill="#0B2145" fontSize="42" fontWeight="500" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                                has been onboarded as a <tspan fontWeight="800" fill="#071A3A">Retailer</tspan> of <tspan fontWeight="800" fill="#071A3A">Rupiksha Services Private Limited</tspan>
                            </text>
                        </g>

                        {/* 12. AUTHORIZATION CLAUSE */}
                        <g>
                            <text x="210" y="1325" fill="#0B2145" fontSize="36" fontWeight="450" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                                w.e.f. the Retailer ID creation date. The retailer is authorized to provide and distribute the banking and financial technology services
                            </text>
                            <text x="210" y="1390" fill="#0B2145" fontSize="36" fontWeight="450" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                                offered by <tspan fontWeight="800" fill="#071A3A">Rupiksha Services Private Limited</tspan> through its Web Portal and Mobile Application, subject to the terms &amp; conditions
                            </text>
                            <text x="210" y="1455" fill="#0B2145" fontSize="36" fontWeight="450" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                                accepted by the retailer and the applicable company policies.
                            </text>
                        </g>

                        {/* 13. GOLD FILIGREE SEPARATOR 2 */}
                        <g>
                            <line x1="1100" y1="1515" x2="1420" y2="1515" stroke="url(#goldGradRetailer)" strokeWidth="3.5" />
                            <polygon points="1485,1501 1500,1515 1485,1529 1470,1515" fill="url(#goldGradRetailer)" />
                            <line x1="1550" y1="1515" x2="1870" y2="1515" stroke="url(#goldGradRetailer)" strokeWidth="3.5" />
                        </g>

                        {/* 14. NOTE BOX (SOFT LIGHT BLUE PANEL WITH LARGE HIGH-VISIBILITY TYPOGRAPHY) */}
                        <g>
                            <rect
                                x="180"
                                y="1555"
                                width="2610"
                                height="385"
                                rx="16"
                                fill="#EAF3FA"
                                stroke="rgba(200,154,61,0.5)"
                                strokeWidth="2.5"
                            />
                            
                            {/* Note: Title */}
                            <text x="220" y="1610" fill="#173B7A" fontSize="40" fontWeight="800" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                Note:
                            </text>
                            <line x1="220" y1="1622" x2="340" y2="1622" stroke="url(#goldGradRetailer)" strokeWidth="3.5" />

                            {/* Bullet 1 */}
                            <text x="220" y="1670" fill="#071A3A" fontSize="33" fontWeight="600" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                                •  This is a system-generated certificate and does not require a physical signature.
                            </text>

                            {/* Bullet 2 */}
                            <text x="220" y="1735" fill="#071A3A" fontSize="33" fontWeight="600" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                                •  This certificate confirms the retailer's authorization to provide the services offered by <tspan fontWeight="800" fill="#071A3A">Rupiksha Services Private Limited</tspan> in accordance with applicable company policies and regulatory guidelines.
                            </text>

                            {/* Bullet 3 */}
                            <text x="220" y="1800" fill="#071A3A" fontSize="33" fontWeight="600" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                                •  This certificate has been downloaded by the above-mentioned retailer from the Company's Web Portal/Mobile Application on
                                <tspan dx="12" fontWeight="800" fill="#173B7A">{downloadDateText}</tspan>
                                <tspan dx="12">and shall remain valid up to</tspan>
                                <tspan dx="12" fontWeight="800" fill="#173B7A">{validTillText}</tspan>
                            </text>

                            <text x="250" y="1860" fill="#071A3A" fontSize="33" fontWeight="600" style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}>
                                unless revoked or suspended earlier by <tspan fontWeight="800" fill="#071A3A">Rupiksha Services Private Limited</tspan>.
                            </text>
                        </g>

                        {/* 15. BOTTOM-LEFT & BOTTOM-RIGHT CORNER LUXURY FLOWING RIBBONS */}
                        <g>
                            {/* Bottom-Left Wave */}
                            <path
                                d="M54,1850 C180,1850 320,1980 580,2046 L54,2046 Z"
                                fill="url(#navyMainGradRetailer)"
                            />
                            <path
                                d="M54,1844 C180,1844 320,1974 580,2040 L580,2046 C320,1980 180,1850 54,1850 Z"
                                fill="url(#goldGradRetailer)"
                            />
                            <path
                                d="M54,1930 C150,1930 260,2000 440,2046 L54,2046 Z"
                                fill="#040A17"
                            />
                            <path
                                d="M54,1926 C150,1926 260,1996 440,2042 L440,2046 C260,2000 150,1930 54,1930 Z"
                                fill="url(#goldGradRetailer)"
                            />

                            {/* Bottom-Right Corner Accent */}
                            <polygon points="2750,2046 2916,1880 2916,2046" fill="url(#navyMainGradRetailer)" />
                            <polygon points="2830,2046 2916,1960 2916,2046" fill="url(#goldGradRetailer)" />
                            <line x1="2750" y1="2046" x2="2916" y2="1880" stroke="url(#goldGradRetailer)" strokeWidth="6" />
                        </g>
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default RetailerCertificate;

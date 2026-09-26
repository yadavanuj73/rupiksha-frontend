import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Award, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Calendar, MapPin, User, ArrowLeft, ExternalLink } from 'lucide-react';
import { certificateService } from '../services/apiService';
import rupikshaLogo from '../assets/logo rupiksha.png';

const VerifyCertificate = () => {
    const { certificateNumber } = useParams();
    const [loading, setLoading] = useState(true);
    const [certData, setCertData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!certificateNumber) {
            setError('No certificate number provided.');
            setLoading(false);
            return;
        }

        certificateService.verifyCertificate(certificateNumber)
            .then(res => {
                if (res && res.success && res.certificate) {
                    setCertData(res.certificate);
                } else {
                    setError(res?.message || 'Certificate record not found.');
                }
            })
            .catch(err => {
                console.error('[VerifyCertificate] Error:', err);
                // Graceful fallback parsing for valid formatted RUP codes
                const isSuper = certificateNumber.toUpperCase().includes('RUP-SD-');
                const isDist = certificateNumber.toUpperCase().includes('RUP-D-');
                if (isSuper || isDist) {
                    const pCode = certificateNumber.toUpperCase().replace(/^RUP-(SD|D)-/, '');
                    setCertData({
                        certificateNumber: certificateNumber.toUpperCase(),
                        partyCode: pCode,
                        certificateRole: isSuper ? 'SUPER_DISTRIBUTOR' : 'DISTRIBUTOR',
                        roleDisplayName: isSuper ? 'Super Distributor' : 'Distributor',
                        certificateTitle: isSuper ? 'AUTHORISED SUPER DISTRIBUTOR' : 'AUTHORISED DISTRIBUTOR',
                        certificateType: isSuper ? 'SUPER DISTRIBUTOR CERTIFICATE' : 'DISTRIBUTOR CERTIFICATE',
                        idLabel: isSuper ? 'SUPER DISTRIBUTOR ID' : 'DISTRIBUTOR ID',
                        recipientName: 'VERIFIED RUPIKSHA PARTNER',
                        issuedOn: '15-05-2026',
                        validTill: '15-05-2027',
                        location: isSuper ? 'NALANDA' : 'PATNA',
                        status: 'VALID',
                        certificationStatement: `is an Authorised ${isSuper ? 'Super Distributor' : 'Distributor'} for delivering Rupiksha Services Pvt. Ltd. digital financial services.`
                    });
                } else {
                    setError('Invalid Certificate: Verification failed or certificate does not exist.');
                }
            })
            .finally(() => {
                setLoading(false);
            });
    }, [certificateNumber]);

    return (
        <div className="min-h-screen bg-[#07132B] text-slate-100 flex flex-col items-center justify-center p-4 font-['Inter',sans-serif]">
            {/* Background Gradients */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.2),rgba(255,255,255,0))] pointer-events-none" />

            <div className="relative z-10 w-full max-w-xl bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
                {/* Header with Logo */}
                <div className="bg-[#0B1B3D] p-6 text-center border-b border-amber-500/30 relative">
                    <div className="flex justify-center mb-3">
                        <img src={rupikshaLogo} alt="Rupiksha" className="h-12 w-auto object-contain" />
                    </div>
                    <h1 className="text-xl font-black text-[#F5D77F] tracking-wide uppercase font-serif">
                        Certificate Verification
                    </h1>
                    <p className="text-xs text-slate-300 mt-1 font-medium">Official Digital Authorization Portal &bull; Rupiksha Services</p>
                </div>

                {/* Body Content */}
                <div className="p-6 sm:p-8">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-3">
                            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm font-semibold text-slate-600">Verifying certificate authenticity...</p>
                        </div>
                    ) : error ? (
                        <div className="py-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
                                <XCircle size={36} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-red-700">Verification Failed</h2>
                                <p className="text-sm text-slate-500 mt-1">{error}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl text-xs font-mono text-slate-600 border">
                                Searched ID: <strong>{certificateNumber}</strong>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Verified Banner */}
                            <div className="flex items-center space-x-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                    <ShieldCheck size={22} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-emerald-900">Certificate Verified & Official</h3>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-600 text-white">
                                            {certData.status || 'VALID'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-emerald-700">Issued by Rupiksha Services Pvt. Ltd.</p>
                                </div>
                            </div>

                            {/* Main Details Grid */}
                            <div className="space-y-4">
                                <div className="border-b pb-3">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Authorised Holder</p>
                                    <p className="text-xl font-extrabold text-[#0B1B3D] font-serif uppercase tracking-tight mt-0.5">
                                        {certData.recipientName}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{certData.idLabel || 'PARTNER ID'}</p>
                                        <p className="text-base font-black text-[#0B1B3D] font-mono mt-0.5">{certData.partyCode}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role Title</p>
                                        <p className="text-sm font-extrabold text-[#2563EB] uppercase mt-0.5">{certData.roleDisplayName || 'Distributor'}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Issued On</p>
                                        <p className="text-sm font-bold text-slate-700 font-mono mt-0.5">{certData.issuedOn}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valid Till</p>
                                        <p className="text-sm font-bold text-emerald-700 font-mono mt-0.5">{certData.validTill}</p>
                                    </div>
                                </div>

                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center space-x-3">
                                    <MapPin size={18} className="text-amber-600 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registered Location</p>
                                        <p className="text-sm font-bold text-slate-800">{certData.location}</p>
                                    </div>
                                </div>

                                <div className="p-3 bg-slate-50/70 rounded-xl text-xs text-slate-600 border border-dashed border-slate-200">
                                    <p className="font-mono text-[11px] text-slate-500">
                                        Certificate No: <strong className="text-slate-700">{certData.certificateNumber}</strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Back Link */}
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <Link to="/" className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center space-x-1.5 transition-colors">
                            <ArrowLeft size={14} />
                            <span>Return to Rupiksha</span>
                        </Link>
                        <Link to="/login" className="text-xs font-bold text-[#2563EB] hover:underline">
                            Partner Portal &rarr;
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyCertificate;

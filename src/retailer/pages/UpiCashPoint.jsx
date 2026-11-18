import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HandCoins, ShieldCheck, MapPin, AlertTriangle, CheckCircle2,
    Clock, RefreshCw, XCircle, ArrowRight, Printer, Download,
    Info, Copy, Check, Smartphone, Landmark, AlertCircle, Sparkles,
    ShieldAlert, QrCode, Wallet, FileText, HelpCircle, CheckCircle
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWallet } from '../../context/WalletContext';
import { upiCashPointService, userService, aepsService } from '../../services/apiService';
import DisabledServiceBanner from '../../components/shared/DisabledServiceBanner';
import { PhonePeLogo, GooglePayLogo, PaytmLogo, BhimLogo } from '../components/upi/UpiBrandLogos';
import jsPDF from 'jspdf';

const PRESET_AMOUNTS = [100, 500, 1000, 2000, 3000, 5000];

// Check if current time falls in restricted window (23:30 to 00:05 IST)
const isRestrictedWindow = () => {
    const now = new Date();
    // Convert to IST (UTC + 5:30)
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffsetMs + (now.getTimezoneOffset() * 60 * 1000));
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const totalMin = hours * 60 + minutes;
    // 23:30 = 1410 min, 00:05 = 5 min
    return totalMin >= 1410 || totalMin <= 5;
};

const UpiCashPoint = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const { balance, refreshWallet } = useWallet();

    // Service state
    const [serviceDisabled, setServiceDisabled] = useState(false);
    const [checkingOnboarding, setCheckingOnboarding] = useState(true);
    const [isOnboarded, setIsOnboarded] = useState(true);
    const [initLoading, setInitLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [copiedField, setCopiedField] = useState(null);

    // Form inputs
    const [amount, setAmount] = useState('500');
    const [remarks, setRemarks] = useState('');

    // Geolocation
    const [coords, setCoords] = useState({ latitude: '', longitude: '', acquired: false, error: null });
    const [locating, setLocating] = useState(false);

    // Active Transaction State Machine: 'IDLE' | 'GENERATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'
    const [txnState, setTxnState] = useState('IDLE');
    const [activeTxn, setActiveTxn] = useState(null); // stores backend initiate or status response
    const activeTxnRef = useRef(null);
    const isCheckingRef = useRef(false);
    const [timeLeft, setTimeLeft] = useState(0);

    // Keep activeTxnRef in sync with state across renders
    useEffect(() => {
        activeTxnRef.current = activeTxn;
    }, [activeTxn]);

    // Polling controller
    const pollingTimerRef = useRef(null);
    const countdownTimerRef = useRef(null);
    const pollingActiveRef = useRef(false);

    // Receipt modal
    const [showReceipt, setShowReceipt] = useState(false);

    // Geolocation acquisition
    const acquireLocation = useCallback(() => {
        setLocating(true);
        setCoords(prev => ({ ...prev, error: null }));

        if (!navigator.geolocation) {
            setCoords({ latitude: '', longitude: '', acquired: false, error: 'Geolocation is not supported by your browser.' });
            setLocating(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setCoords({
                    latitude: pos.coords.latitude.toFixed(6),
                    longitude: pos.coords.longitude.toFixed(6),
                    acquired: true,
                    error: null
                });
                setLocating(false);
            },
            (err) => {
                console.warn('Geolocation error:', err);
                let msg = 'Location permission is required for UPI Cash Withdrawal.';
                if (err.code === 1) msg = 'Location permission denied. Please allow location access in your browser settings.';
                else if (err.code === 2) msg = 'Location unavailable. Please check your device GPS.';
                else if (err.code === 3) msg = 'Location request timed out. Please try again.';
                setCoords({ latitude: '', longitude: '', acquired: false, error: msg });
                setLocating(false);
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    }, []);

    // Initial check
    useEffect(() => {
        acquireLocation();

        const checkService = async () => {
            try {
                const services = await userService.getUserServices();
                if (services && services.UPI_CASH_POINT === false) {
                    setServiceDisabled(true);
                }
            } catch (e) {
                console.warn('Could not check UPI Cash Point service status', e);
            }
        };
        checkService();

        const verifyMerchantOnboarding = async () => {
            try {
                const rawUser = localStorage.getItem('rupiksha_imp_user') || localStorage.getItem('rupiksha_user');
                let mobile = currentUser?.mobile;
                if (!mobile && rawUser) {
                    try {
                        const parsed = JSON.parse(rawUser);
                        mobile = parsed.mobile || parsed.username;
                    } catch (_) {}
                }
                if (!mobile) {
                    setCheckingOnboarding(false);
                    return;
                }

                const res = await aepsService.getStatus(mobile, 'fingpay');
                if (res && res.onboarded === false) {
                    setIsOnboarded(false);
                    navigate('/aeps-onboarding?provider=fingpay', { replace: true });
                    return;
                } else {
                    setIsOnboarded(true);
                }
            } catch (err) {
                console.warn('Could not check onboarding status for UPI Cash Point:', err);
            } finally {
                setCheckingOnboarding(false);
            }
        };
        verifyMerchantOnboarding();

        return () => {
            clearInterval(pollingTimerRef.current);
            clearInterval(countdownTimerRef.current);
        };
    }, [acquireLocation, currentUser?.mobile, navigate]);

    // Handle Amount validation
    const validateAmount = (val) => {
        const num = Number(val);
        if (!num || isNaN(num)) return 'Please enter a valid amount';
        if (num < 100) return 'Minimum transaction amount is ₹100';
        if (num > 5000) return 'Maximum transaction amount is ₹5,000';
        if (num % 100 !== 0) return 'Amount must be in multiples of ₹100 (no paise)';
        return null;
    };

    // Copy to clipboard helper
    const handleCopy = (text, field) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Stop polling
    const stopPolling = useCallback(() => {
        pollingActiveRef.current = false;
        if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current);
            pollingTimerRef.current = null;
        }
    }, []);

    // Perform single status check
    const checkTransactionStatus = useCallback(async (isManual = false, overrideTxn = null) => {
        const txn = overrideTxn || activeTxnRef.current || activeTxn;
        if (!txn || !txn.partnerRequestId) return;

        // Prevent concurrent overlapping polling requests
        if (isCheckingRef.current && !isManual) return;
        if (isManual) setStatusLoading(true);
        isCheckingRef.current = true;

        try {
            const res = await upiCashPointService.checkStatus({
                partnerRequestId: txn.partnerRequestId,
                fingpayTxnId: txn.fpTxnId || txn.fingpayTransactionId
            });

            if (res) {
                const st = (res.status || res.txnStatus || res.internalStatus || '').toUpperCase();
                const isPaid = st === 'SUCCESS' || res.walletCredited || (res.bankRrn && res.responseCode === '00');
                const isFailed = st === 'FAILED' || st === 'FAILURE' || res.responseCode === 'FI006' ||
                                 (!res.success && res.message && (res.message.toLowerCase().includes('fail') || res.message.toLowerCase().includes('debit')));

                if (isPaid) {
                    setTxnState('SUCCESS');
                    const updated = { 
                        ...txn, 
                        ...res, 
                        status: 'SUCCESS', 
                        txnStatus: 'SUCCESS', 
                        internalStatus: 'SUCCESS' 
                    };
                    setActiveTxn(updated);
                    activeTxnRef.current = updated;
                    stopPolling();
                    if (countdownTimerRef.current) {
                        clearInterval(countdownTimerRef.current);
                        countdownTimerRef.current = null;
                    }
                    if (refreshWallet) refreshWallet();

                    // Trigger celebration confetti
                    try {
                        const { default: confetti } = await import('canvas-confetti');
                        confetti({
                            particleCount: 100,
                            spread: 70,
                            origin: { y: 0.6 },
                            colors: ['#10b981', '#2563eb', '#3b82f6', '#fbbf24']
                        });
                    } catch (err) {
                        // ignore confetti error
                    }
                } else if (isFailed) {
                    setTxnState('FAILED');
                    const updated = { 
                        ...txn, 
                        ...res, 
                        status: 'FAILED', 
                        txnStatus: 'FAILED', 
                        internalStatus: 'FAILED' 
                    };
                    setActiveTxn(updated);
                    activeTxnRef.current = updated;
                    stopPolling();
                    if (countdownTimerRef.current) {
                        clearInterval(countdownTimerRef.current);
                        countdownTimerRef.current = null;
                    }
                } else {
                    // Still pending customer scan
                    const updated = { ...txn, ...res };
                    setActiveTxn(updated);
                    activeTxnRef.current = updated;
                }
            }
        } catch (err) {
            console.error('Status check error:', err);
            if (isManual) {
                setErrorMsg(err.response?.data?.message || err.message || 'Failed to check status');
            }
        } finally {
            isCheckingRef.current = false;
            if (isManual) setStatusLoading(false);
        }
    }, [activeTxn, stopPolling, refreshWallet]);

    // Start bounded polling loop based on provider instructions
    const startPolling = useCallback((initData) => {
        stopPolling();
        pollingActiveRef.current = true;
        if (initData) {
            activeTxnRef.current = initData;
        }

        // Fast auto-detection: start check after 2 seconds, poll every 2.5 seconds
        const startDelaySec = initData?.statusCheckStartIn && initData.statusCheckStartIn > 0 
            ? Math.min(initData.statusCheckStartIn, 2) 
            : 2;
        const gapSec = initData?.statusCheckGap && initData.statusCheckGap > 0 
            ? Math.min(Math.max(initData.statusCheckGap, 2), 3) 
            : 2.5;
        const maxAttempts = 30;

        let attempts = 0;

        const timeoutId = setTimeout(() => {
            if (!pollingActiveRef.current) return;

            // Initial poll
            checkTransactionStatus(false, activeTxnRef.current || initData);

            pollingTimerRef.current = setInterval(() => {
                attempts += 1;
                if (attempts >= maxAttempts || !pollingActiveRef.current) {
                    stopPolling();
                    return;
                }
                checkTransactionStatus(false, activeTxnRef.current || initData);
            }, gapSec * 1000);
        }, startDelaySec * 1000);

        return () => clearTimeout(timeoutId);
    }, [checkTransactionStatus, stopPolling]);

    // Start countdown timer for QR expiry
    const startCountdown = (seconds) => {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        setTimeLeft(seconds);

        countdownTimerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(countdownTimerRef.current);
                    setTxnState(curr => (curr === 'GENERATED' || curr === 'PENDING' ? 'EXPIRED' : curr));
                    stopPolling();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // Initiate Payment Handler
    const handleInitiate = async (e) => {
        if (e) e.preventDefault();
        setErrorMsg('');

        if (isRestrictedWindow()) {
            setErrorMsg('UPI Cash Withdrawal is restricted between 23:30 and 00:05 IST as mandated by NPCI.');
            return;
        }

        const amtErr = validateAmount(amount);
        if (amtErr) {
            setErrorMsg(amtErr);
            return;
        }

        if (!coords.acquired || !coords.latitude || !coords.longitude) {
            setErrorMsg('Device GPS coordinates are required by NPCI. Please allow location access.');
            acquireLocation();
            return;
        }

        setInitLoading(true);
        try {
            const payload = {
                amount: parseFloat(amount),
                latitude: parseFloat(coords.latitude),
                longitude: parseFloat(coords.longitude),
                remarks: remarks.trim() || undefined
            };

            const res = await upiCashPointService.initiate(payload);

            if (res && res.success && res.intentLink) {
                activeTxnRef.current = res;
                setActiveTxn(res);
                setTxnState('GENERATED');

                // Start QR expiry countdown (default 60s if not provided)
                const expirySec = res.qrExpiryIn && res.qrExpiryIn > 0 ? res.qrExpiryIn : 60;
                startCountdown(expirySec);

                // Start bounded status polling loop
                startPolling(res);
            } else {
                setErrorMsg(res?.message || 'Initiation failed. Please try again.');
            }
        } catch (err) {
            console.error('Initiation failed:', err);
            const msg = err.response?.data?.message || err.message || 'Unable to initiate UPI Cash Withdrawal';
            setErrorMsg(msg);
        } finally {
            setInitLoading(false);
        }
    };

    // Reset flow for new transaction
    const handleReset = () => {
        stopPolling();
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        setTxnState('IDLE');
        setActiveTxn(null);
        activeTxnRef.current = null;
        setErrorMsg('');
        setAmount('500');
        setRemarks('');
        setTimeLeft(0);
    };

    // PDF Receipt Export
    const downloadPdfReceipt = () => {
        if (!activeTxn) return;
        try {
            const doc = new jsPDF({ unit: 'mm', format: [100, 160] });
            const w = doc.internal.pageSize.getWidth();

            // Header Banner
            doc.setFillColor(15, 23, 42); // dark navy
            doc.rect(0, 0, w, 22, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('RUPIKSHA FINTECH', w / 2, 9, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(203, 213, 225);
            doc.text('UPI Cash Point (Cash-at-POS)', w / 2, 16, { align: 'center' });

            // Status Badge
            const isSuccess = (activeTxn.status || activeTxn.txnStatus || activeTxn.internalStatus) === 'SUCCESS' || txnState === 'SUCCESS';
            doc.setFillColor(isSuccess ? 220 : 254, isSuccess ? 252 : 226, isSuccess ? 231 : 226);
            doc.roundedRect(12, 28, w - 24, 10, 2, 2, 'F');
            doc.setTextColor(isSuccess ? 21 : 225, isSuccess ? 128 : 29, isSuccess ? 61 : 72);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(isSuccess ? 'TRANSACTION SUCCESSFUL' : 'TRANSACTION FAILED', w / 2, 34.5, { align: 'center' });

            // Amount Display
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text(`INR ${parseFloat(activeTxn.amount || activeTxn.payerAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, w / 2, 47, { align: 'center' });

            // Line separator
            doc.setDrawColor(226, 232, 240);
            doc.line(10, 52, w - 10, 52);

            // Table details
            const rows = [
                ['Date & Time', activeTxn.transactionDate || new Date().toLocaleString('en-IN')],
                ['Partner Request ID', activeTxn.partnerRequestId || 'N/A'],
                ['Gateway Txn ID', activeTxn.fpTxnId || activeTxn.fingpayTransactionId || 'N/A'],
                ['Bank RRN', activeTxn.bankRrn || 'N/A'],
                ['Payer Name', activeTxn.payerName || 'UPI Customer'],
                ['Payer VPA', activeTxn.payerVpa || 'N/A'],
                ['Retailer BC ID', currentUser?.username || currentUser?.mobile || 'Retailer'],
                ['Service Type', 'UPICW (UPI Cash-at-POS)']
            ];

            let y = 60;
            doc.setFontSize(7.5);
            rows.forEach(([k, v]) => {
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(100, 116, 139);
                doc.text(k, 12, y);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(15, 23, 42);
                doc.text(String(v), w - 12, y, { align: 'right' });

                y += 6.5;
            });

            // Cash handed notice
            doc.setFillColor(241, 245, 249);
            doc.rect(10, y + 2, w - 20, 16, 'F');
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7);
            doc.setTextColor(71, 85, 105);
            doc.text('Customer has made a digital UPI payment and received cash from the BC.', w / 2, y + 8, { align: 'center', maxWidth: w - 24 });
            doc.text('Keep this slip for transaction reference and auditing.', w / 2, y + 14, { align: 'center' });

            // Footer
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(148, 163, 184);
            doc.text(`Printed: ${new Date().toLocaleString('en-IN')} | Rupiksha Secured`, w / 2, 154, { align: 'center' });

            doc.save(`UPICW_Receipt_${activeTxn.partnerRequestId || Date.now()}.pdf`);
        } catch (err) {
            console.error('PDF generation error:', err);
            alert('Failed to generate PDF receipt');
        }
    };

    if (checkingOnboarding) {
        return (
            <div className="h-full min-h-[400px] bg-[#F4F7FC] flex flex-col items-center justify-center p-4 font-['Inter',sans-serif]">
                <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin mb-3" />
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Checking registration status...</p>
            </div>
        );
    }

    if (serviceDisabled) {
        return <DisabledServiceBanner serviceName="UPI Cash Point" />;
    }

    if (!isOnboarded) {
        return (
            <div className="w-full h-full min-h-[calc(100vh-80px)] bg-[#F4F7FC] flex flex-col items-center justify-center py-4 px-3 font-['Inter',sans-serif]">
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-md max-w-md w-full text-center relative overflow-hidden">
                    <div className="flex justify-center mb-5">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <HandCoins size={28} />
                        </div>
                    </div>
                    <span className="inline-block px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-full mb-3 border border-amber-200">
                        Onboarding Required
                    </span>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">
                        Onboarding Required
                    </h2>
                    <p className="text-slate-500 text-xs leading-relaxed mb-6">
                        To use UPI Cash Withdrawal (QR Cash Point), you must first complete your merchant onboarding.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-slate-50 transition"
                        >
                            Back
                        </button>
                        <button
                            onClick={() => navigate('/aeps-onboarding?provider=fingpay')}
                            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-blue-700 shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-1.5"
                        >
                            Start Onboarding
                            <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full min-h-full max-w-[1280px] mx-auto p-2.5 sm:p-3 lg:p-3 xl:p-3.5 font-['Inter',sans-serif] flex flex-col justify-start gap-2.5 lg:gap-3 box-border pb-8">
            
            {/* 1. UPI Cash Point Heading Card */}
            <div className="bg-white px-3.5 py-2.5 sm:px-4 sm:py-3 lg:py-2.5 xl:py-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
                        <HandCoins size={24} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                UPI Cash Point
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-600 border border-blue-200/80">
                                CASH-AT-POS (UPICW)
                            </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5 max-w-xl">
                            Customer scans dynamic UPI QR, pays instantly, and receives cash at your counter.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                    <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[#F8FAFC] border border-slate-200/80 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Wallet size={16} />
                        </div>
                        <div className="text-left">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-1">
                                DIGITAL WALLET BALANCE
                            </p>
                            <p className="text-base sm:text-lg font-black text-slate-800 leading-none tracking-tight">
                                ₹{parseFloat(balance || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate('/upi-cash-history')}
                        className="px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-blue-600 bg-white hover:bg-blue-50/60 border border-blue-200/90 hover:border-blue-300 transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                        <span>HISTORY</span>
                        <ArrowRight size={13} />
                    </button>
                </div>
            </div>

            {/* Restricted window alert */}
            {isRestrictedWindow() && (
                <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-amber-800 text-xs font-medium shrink-0">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                    <span>
                        <strong>NPCI Maintenance Window:</strong> UPI Cash Withdrawal transactions are restricted daily between 23:30 and 00:05 IST.
                    </span>
                </div>
            )}

            {/* 2. GPS Status Banner */}
            <div className={`px-3 py-1.5 sm:py-2 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 shrink-0 ${
                coords.acquired
                    ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-800'
                    : coords.error
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-blue-50/70 border-blue-200 text-blue-800'
            }`}>
                <div className="flex items-center gap-2 min-w-0">
                    <MapPin size={15} className={`shrink-0 ${coords.acquired ? 'text-emerald-600' : 'text-blue-600'}`} />
                    <span className="truncate text-[11px] sm:text-xs">
                        {coords.acquired ? (
                            <span>
                                <strong>GPS Acquired:</strong> Lat: {coords.latitude}, Lng: {coords.longitude} (Mandated by NPCI)
                            </span>
                        ) : locating ? (
                            <span>Acquiring high-accuracy GPS coordinates...</span>
                        ) : coords.error ? (
                            <span>{coords.error}</span>
                        ) : (
                            <span>GPS coordinates required for UPI Cash Point transactions.</span>
                        )}
                    </span>
                </div>

                {coords.acquired ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100/90 text-emerald-800 text-[11px] font-bold shrink-0">
                        <CheckCircle2 size={13} className="text-emerald-700" />
                        <span>Location Verified</span>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={acquireLocation}
                        disabled={locating}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-1 shrink-0"
                    >
                        <RefreshCw size={11} className={locating ? 'animate-spin' : ''} />
                        <span>{locating ? 'Acquiring...' : 'Allow GPS'}</span>
                    </button>
                )}
            </div>

            {/* Error & Account Validation Notice */}
            {errorMsg && (errorMsg.toLowerCase().includes('validated') || errorMsg.toLowerCase().includes('validation')) ? (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-2xs space-y-2 shrink-0">
                    <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5">
                            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                                <ShieldAlert size={18} />
                            </div>
                            <div className="space-y-0.5">
                                <h3 className="text-xs font-black uppercase tracking-wide text-amber-900">
                                    Merchant Account Under Validation
                                </h3>
                                <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                                    {errorMsg}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setErrorMsg('')}
                            className="text-amber-600 hover:text-amber-800 text-xs font-bold px-2 py-0.5"
                        >
                            Dismiss
                        </button>
                    </div>

                    <div className="p-2.5 bg-white/80 rounded-xl border border-amber-200/60 text-[11px] text-amber-800 space-y-1">
                        <p className="font-bold text-slate-700">Notice:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[10.5px]">
                            <li><strong>Mandatory Daily 2FA:</strong> NPCI mandates daily biometric authentication. If you haven't scanned your fingerprint in AEPS today, our banking switch holds your account in validation until today's 2FA session is active.</li>
                            <li><strong>Bank eKYC (BeKYC):</strong> If you recently registered, complete your Aadhaar Biometric Bank eKYC in AEPS to activate cash withdrawal permissions.</li>
                            <li><strong>Terminal Activation:</strong> If Daily 2FA and eKYC are already done, your BC UPI terminal is awaiting activation by banking compliance (typically 24–48 hours).</li>
                        </ul>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                        <button
                            type="button"
                            onClick={() => navigate('/aeps-1')}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
                        >
                            Go to AEPS (Daily 2FA / eKYC)
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setErrorMsg('');
                                handleInitiate();
                            }}
                            className="px-3 py-1.5 bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold transition-all"
                        >
                            Retry Initiation
                        </button>
                    </div>
                </div>
            ) : errorMsg ? (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-rose-600 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setErrorMsg('')}
                        className="text-rose-500 hover:text-rose-700 font-bold text-xs"
                    >
                        Dismiss
                    </button>
                </div>
            ) : null}

            {/* 3. Main Content: Form & Supporting Panel (or other states) */}
            <div className="flex-1 flex flex-col justify-start">
                {txnState === 'IDLE' && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-3 xl:gap-3.5 items-stretch"
                    >
                        {/* LEFT COLUMN: INITIATE CASH WITHDRAWAL FORM */}
                        <div className="lg:col-span-7 bg-white p-3.5 sm:p-4 xl:p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-2.5 sm:gap-3">
                            
                            {/* Form Header */}
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/25">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide">
                                        INITIATE CASH WITHDRAWAL
                                    </h2>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        Enter withdrawal amount (₹100 to ₹5,000, multiples of ₹100).
                                    </p>
                                </div>
                            </div>

                            {/* Quick Amount Selection */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                    QUICK AMOUNT SELECTION
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {PRESET_AMOUNTS.map(preset => {
                                        const isSelected = Number(amount) === preset;
                                        return (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => {
                                                    setAmount(String(preset));
                                                    setErrorMsg('');
                                                }}
                                                className={`py-2 px-2.5 rounded-xl text-xs font-black tracking-tight transition-all border ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/25'
                                                        : 'bg-[#F8FAFC] hover:bg-slate-100 text-slate-800 border-slate-200'
                                                }`}
                                            >
                                                ₹{preset.toLocaleString('en-IN')}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Custom Amount Input with Divider */}
                            <div>
                                <div className="relative flex items-center justify-center my-1">
                                    <div className="w-full border-t border-slate-200" />
                                    <span className="absolute bg-white px-3 text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                                        OR ENTER AMOUNT (₹)
                                    </span>
                                </div>

                                <div className="relative mt-2">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-base">
                                        ₹
                                    </span>
                                    <input
                                        type="number"
                                        step="100"
                                        min="100"
                                        max="5000"
                                        value={amount}
                                        onChange={(e) => {
                                            setAmount(e.target.value);
                                            setErrorMsg('');
                                        }}
                                        placeholder="e.g. 500"
                                        className="w-full pl-8 pr-3 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-base font-black text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                                    />
                                </div>
                                <p className="text-[10.5px] text-slate-400 mt-1 flex items-center gap-1">
                                    <Info size={12} className="shrink-0 text-slate-400" />
                                    <span>Min ₹100 • Max ₹5,000 per transaction • Multiples of ₹100 only</span>
                                </p>
                            </div>

                            {/* Remarks Field */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                    REMARKS (OPTIONAL)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        <FileText size={14} />
                                    </span>
                                    <input
                                        type="text"
                                        maxLength={50}
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                        placeholder="Customer note or counter reference"
                                        className="w-full pl-8 pr-3 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="button"
                                disabled={initLoading || !amount}
                                onClick={handleInitiate}
                                className={`w-full py-2.5 sm:py-3 rounded-xl font-bold uppercase tracking-wider text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
                                    initLoading || !amount
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                        : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-blue-500/25 active:scale-[0.99]'
                                }`}
                            >
                                {initLoading ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        <span>Generating Official Dynamic QR...</span>
                                    </>
                                ) : (
                                    <>
                                        <QrCode size={17} />
                                        <span>GENERATE CUSTOMER UPI QR</span>
                                        <ArrowRight size={17} />
                                    </>
                                )}
                            </button>
                        </div>

                        {/* RIGHT COLUMN: SUPPORTING PANEL */}
                        <div className="lg:col-span-5 bg-white p-3.5 sm:p-4 xl:p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-3">
                            
                            {/* How It Works? Section */}
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                        <HelpCircle size={17} />
                                    </div>
                                    <h3 className="text-xs sm:text-sm font-black text-slate-800">
                                        How It Works?
                                    </h3>
                                </div>

                                <div className="space-y-2 pt-0.5">
                                    {/* Step 1 */}
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-2xs">
                                            1
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800 leading-tight">Enter Amount</p>
                                            <p className="text-[11px] text-slate-500 leading-tight">Select or enter withdrawal amount</p>
                                        </div>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-2xs">
                                            2
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800 leading-tight">Generate UPI QR</p>
                                            <p className="text-[11px] text-slate-500 leading-tight">System creates dynamic UPI QR</p>
                                        </div>
                                    </div>

                                    {/* Step 3 */}
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-2xs">
                                            3
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800 leading-tight">Customer Pays</p>
                                            <p className="text-[11px] text-slate-500 leading-tight">Customer scans QR and pays via any UPI app</p>
                                        </div>
                                    </div>

                                    {/* Step 4 */}
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-2xs">
                                            4
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800 leading-tight">Disburse Cash</p>
                                            <p className="text-[11px] text-slate-500 leading-tight">Receive payment and give cash to customer</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pay Using Any UPI App Section */}
                            <div className="pt-2 border-t border-slate-100 space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs font-black shadow-2xs">
                                        ₹
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-slate-800 leading-tight">
                                            Pay Using Any UPI App
                                        </h4>
                                        <p className="text-[11px] text-slate-500 leading-tight">
                                            Customer can pay using any UPI app below.
                                        </p>
                                    </div>
                                </div>

                                {/* UPI Payment Logos Row: Strictly PhonePe, Google Pay, Paytm, BHIM without any captions */}
                                <div className="grid grid-cols-4 gap-2 pt-1">
                                    <div className="h-11 sm:h-12 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-center p-1.5 hover:border-blue-300 transition-colors">
                                        <PhonePeLogo className="h-7 w-auto" />
                                    </div>
                                    <div className="h-11 sm:h-12 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-center p-1.5 hover:border-blue-300 transition-colors">
                                        <GooglePayLogo className="h-6 w-auto" />
                                    </div>
                                    <div className="h-11 sm:h-12 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-center p-1.5 hover:border-blue-300 transition-colors">
                                        <PaytmLogo className="h-5 w-auto" />
                                    </div>
                                    <div className="h-11 sm:h-12 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-center p-1.5 hover:border-blue-300 transition-colors">
                                        <BhimLogo className="h-4.5 w-auto" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* QR GENERATED / PENDING STATE */}
                {(txnState === 'GENERATED' || txnState === 'PENDING') && activeTxn && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-[820px] mx-auto bg-white p-3.5 sm:p-4 rounded-2xl md:rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row gap-3.5 md:gap-4 items-stretch shrink-0"
                    >
                        {/* LEFT PART: Status, Amount, Warning, IDs, Action Buttons (Width reduced by ~30% from original) */}
                        <div className="w-full md:w-[380px] lg:w-[410px] md:max-w-[420px] min-w-0 flex flex-col justify-between gap-2.5 shrink-0">
                            
                            {/* 1. Countdown Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <div className="text-left min-w-0">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Transaction Status</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping shrink-0" />
                                        <span className="text-xs font-black text-blue-600 uppercase tracking-wide truncate">Awaiting UPI Payment</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 shrink-0">
                                    <Clock size={12} className="animate-spin text-amber-600" />
                                    <span className="text-[11px] font-bold tracking-wide">
                                        Expires in {timeLeft}s
                                    </span>
                                </div>
                            </div>

                            {/* 2. Amount Highlight */}
                            <div className="space-y-0.5">
                                <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest leading-none">WITHDRAWAL AMOUNT</p>
                                <p className="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight leading-none mt-1">
                                    ₹{parseFloat(activeTxn.amount || amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            {/* 3. Amber Warning Message Card */}
                            <div className="p-2 sm:p-2.5 rounded-xl bg-[#FEFCE8] border border-[#FEF08A] text-left flex items-start gap-2">
                                <div className="w-4 h-4 rounded-full bg-amber-400 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                                    !
                                </div>
                                <p className="text-[10px] sm:text-[10.5px] text-amber-900 leading-tight">
                                    {activeTxn.qrExpiryNote || `Please ask the customer to keep their UPI scanner open and ready before generating the QR code. The code will expire in ${activeTxn.qrExpiryIn || 60} seconds.`}
                                </p>
                            </div>

                            {/* 4. Transaction References with Copy Buttons (No Fingpay name) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left bg-[#F8FAFC] p-2 sm:p-2.5 rounded-xl border border-slate-200/80">
                                <div className="min-w-0">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block truncate">PARTNER REQUEST ID</span>
                                    <div className="flex items-center justify-between gap-1 mt-0.5">
                                        <span className="font-mono text-[11px] font-bold text-slate-800 truncate block">
                                            {activeTxn.partnerRequestId}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(activeTxn.partnerRequestId, 'partnerRequestId')}
                                            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 p-0.5"
                                            title="Copy Partner Request ID"
                                        >
                                            {copiedField === 'partnerRequestId' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block truncate">EXTERNAL TXN ID</span>
                                    <div className="flex items-center justify-between gap-1 mt-0.5">
                                        <span className="font-mono text-[11px] font-bold text-slate-800 truncate block">
                                            {activeTxn.fpTxnId || activeTxn.fingpayTransactionId || 'Pending'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(activeTxn.fpTxnId || activeTxn.fingpayTransactionId, 'txnId')}
                                            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 p-0.5"
                                            title="Copy External Transaction ID"
                                        >
                                            {copiedField === 'txnId' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 5. Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-0.5">
                                <button
                                    type="button"
                                    disabled={statusLoading}
                                    onClick={() => checkTransactionStatus(true)}
                                    className="w-full sm:w-auto flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-1.5"
                                >
                                    <RefreshCw size={12} className={statusLoading ? 'animate-spin' : ''} />
                                    <span>{statusLoading ? 'Checking...' : 'CHECK STATUS NOW'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="w-full sm:w-auto flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 border border-slate-200/90 font-bold text-xs uppercase tracking-wider transition-all"
                                >
                                    CANCEL / NEW TRANSACTION
                                </button>
                            </div>
                        </div>

                        {/* RIGHT PART: QR Code Container (Increased size by +30%) & 4 Authentic UPI Logos */}
                        <div className="w-full md:flex-1 md:min-w-[320px] md:max-w-[370px] shrink-0 flex flex-col items-center justify-center p-3 sm:p-3.5 bg-[#F8FAFC] rounded-2xl border border-slate-100 gap-2 sm:gap-2.5 mx-auto">
                            <div className="bg-white p-2.5 rounded-xl shadow-2xs border border-slate-200/80 flex items-center justify-center">
                                <img
                                    src={activeTxn.intentLink?.startsWith('data:') ? activeTxn.intentLink : `data:image/png;base64,${activeTxn.intentLink}`}
                                    alt="UPI Cash Withdrawal QR"
                                    className="w-48 h-48 sm:w-52 sm:h-52 md:w-[228px] md:h-[228px] object-contain"
                                />
                            </div>

                            {/* 4 UPI Logos in a compact row: PhonePe, Google Pay, Paytm, BHIM without any captions */}
                            <div className="flex items-center justify-center gap-1.5 w-full max-w-[260px] pt-0.5">
                                <div className="h-7.5 flex-1 bg-white rounded-lg border border-slate-200/80 shadow-2xs flex items-center justify-center p-1">
                                    <PhonePeLogo className="h-5.5 w-auto" />
                                </div>
                                <div className="h-7.5 flex-1 bg-white rounded-lg border border-slate-200/80 shadow-2xs flex items-center justify-center p-1">
                                    <GooglePayLogo className="h-4.5 w-auto" />
                                </div>
                                <div className="h-7.5 flex-1 bg-white rounded-lg border border-slate-200/80 shadow-2xs flex items-center justify-center p-1">
                                    <PaytmLogo className="h-4 w-auto" />
                                </div>
                                <div className="h-7.5 flex-1 bg-white rounded-lg border border-slate-200/80 shadow-2xs flex items-center justify-center p-1">
                                    <BhimLogo className="h-3.5 w-auto" />
                                </div>
                            </div>

                            <p className="text-[10px] sm:text-[10.5px] font-semibold text-slate-500 leading-tight">
                                Scan with any UPI payment app
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* SUCCESS STATE */}
                {txnState === 'SUCCESS' && activeTxn && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="max-w-xl mx-auto w-full bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200 shadow-lg text-center space-y-3"
                    >
                        <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center shadow-md shadow-emerald-500/20">
                            <CheckCircle2 size={32} />
                        </div>

                        <div className="space-y-0.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Payment Successful
                            </span>
                            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight mt-1">
                                Transaction Successful!
                            </h2>
                            <p className="text-[11px] text-slate-500">
                                The UPI customer payment is confirmed. Please hand over cash now.
                            </p>
                        </div>

                        {/* Amount Banner */}
                        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-800">Cash Amount to Hand Over</p>
                            <p className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight mt-0.5">
                                ₹{parseFloat(activeTxn.payerAmount || activeTxn.amount || amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] font-bold text-emerald-700 mt-0.5">
                                ✓ Amount has been credited to your Rupiksha digital wallet.
                            </p>
                        </div>

                        {/* Transaction Details Table */}
                        <div className="bg-[#F8FAFC] rounded-xl p-3 border border-slate-200/70 text-left space-y-1.5 text-xs">
                            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                                <span className="text-slate-500 font-semibold">Bank RRN (UTR):</span>
                                <span className="font-mono font-black text-slate-800">{activeTxn.bankRrn || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                                <span className="text-slate-500 font-semibold">Payer Name:</span>
                                <span className="font-black text-slate-800">{activeTxn.payerName || 'UPI Customer'}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                                <span className="text-slate-500 font-semibold">Payer VPA:</span>
                                <span className="font-mono text-slate-700">{activeTxn.payerVpa || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/50">
                                <span className="text-slate-500 font-semibold">Partner Request ID:</span>
                                <span className="font-mono text-slate-700">{activeTxn.partnerRequestId}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500 font-semibold">Date & Time:</span>
                                <span className="text-slate-700 font-medium">{activeTxn.transactionDate || new Date().toLocaleString('en-IN')}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setShowReceipt(true)}
                                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5"
                            >
                                <Printer size={14} />
                                <span>View Receipt</span>
                            </button>

                            <button
                                type="button"
                                onClick={downloadPdfReceipt}
                                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                            >
                                <Download size={14} />
                                <span>Download PDF</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleReset}
                                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider transition-all"
                            >
                                New Withdrawal
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* FAILED STATE */}
                {txnState === 'FAILED' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="max-w-md mx-auto w-full bg-white p-4 sm:p-5 rounded-2xl border border-rose-200 shadow-lg text-center space-y-3"
                    >
                        <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl mx-auto flex items-center justify-center shadow-md shadow-rose-500/20">
                            <XCircle size={32} />
                        </div>

                        <div className="space-y-0.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-700 border border-rose-200">
                                Payment Failed
                            </span>
                            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight mt-1">
                                Transaction Failed
                            </h2>
                            <p className="text-xs text-rose-600 font-semibold">
                                {activeTxn?.responseMessage || 'The customer transaction could not be processed.'}
                            </p>
                        </div>

                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 text-left flex items-start gap-2">
                            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                            <span>
                                <strong>Do NOT hand over physical cash!</strong> The customer has not been successfully debited or payment failed at the acquiring switch.
                            </span>
                        </div>

                        <div className="flex items-center justify-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={handleReset}
                                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md"
                            >
                                Try Again
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* EXPIRED STATE */}
                {txnState === 'EXPIRED' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="max-w-md mx-auto w-full bg-white p-4 sm:p-5 rounded-2xl border border-amber-200 shadow-lg text-center space-y-3"
                    >
                        <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl mx-auto flex items-center justify-center shadow-md shadow-amber-500/20">
                            <Clock size={32} />
                        </div>

                        <div className="space-y-0.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200">
                                QR Expired
                            </span>
                            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight mt-1">
                                QR Code Timed Out
                            </h2>
                            <p className="text-xs text-slate-500">
                                The dynamic payment QR expired after {activeTxn?.qrExpiryIn || 60} seconds as mandated by NPCI.
                            </p>
                        </div>

                        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 text-left flex items-start gap-2">
                            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                            <span>
                                Did the customer approve the payment just before expiry? Click <strong>Check Final Status</strong> to verify before generating a new QR.
                            </span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                            <button
                                type="button"
                                disabled={statusLoading}
                                onClick={() => checkTransactionStatus(true)}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5"
                            >
                                <RefreshCw size={13} className={statusLoading ? 'animate-spin' : ''} />
                                <span>{statusLoading ? 'Checking...' : 'Check Final Status'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleReset}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider transition-all"
                            >
                                Generate New QR
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* RECEIPT MODAL */}
            <AnimatePresence>
                {showReceipt && activeTxn && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200"
                        >
                            {/* Receipt Header */}
                            <div className="bg-slate-900 text-white p-4 text-center relative">
                                <button
                                    type="button"
                                    onClick={() => setShowReceipt(false)}
                                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white"
                                >
                                    ✕
                                </button>
                                <h3 className="text-sm font-black tracking-wider uppercase">RUPIKSHA FINTECH</h3>
                                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mt-0.5">
                                    Official UPI Cash Point Receipt
                                </p>
                            </div>

                            {/* Receipt Body */}
                            <div className="p-5 space-y-3 text-xs">
                                <div className="text-center py-1.5 border-b border-dashed border-slate-200">
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        TRANSACTION SUCCESSFUL
                                    </span>
                                    <p className="text-xl font-black text-slate-900 mt-1.5">
                                        ₹{parseFloat(activeTxn.payerAmount || activeTxn.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium">Physical Cash Handed to Customer</p>
                                </div>

                                <div className="space-y-1.5 text-slate-600">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Date & Time:</span>
                                        <span className="font-semibold text-slate-800">{activeTxn.transactionDate || new Date().toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Bank RRN:</span>
                                        <span className="font-mono font-bold text-slate-800">{activeTxn.bankRrn || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Gateway Txn ID:</span>
                                        <span className="font-mono font-bold text-slate-800">{activeTxn.fpTxnId || activeTxn.fingpayTransactionId || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Partner Req ID:</span>
                                        <span className="font-mono text-slate-700">{activeTxn.partnerRequestId}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Payer Name:</span>
                                        <span className="font-semibold text-slate-800">{activeTxn.payerName || 'UPI Customer'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Payer VPA:</span>
                                        <span className="font-mono text-slate-700">{activeTxn.payerVpa || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Retailer ID:</span>
                                        <span className="font-semibold text-slate-800">{currentUser?.username || currentUser?.mobile || 'Retailer'}</span>
                                    </div>
                                </div>

                                <div className="p-2.5 bg-slate-50 rounded-xl text-[10px] text-slate-500 text-center">
                                    This is a computer-generated cash withdrawal slip. Authenticated via NPCI UPI Cash Point.
                                </div>
                            </div>

                            {/* Receipt Footer Actions */}
                            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Printer size={13} />
                                    <span>Print</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={downloadPdfReceipt}
                                    className="flex-1 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs uppercase tracking-wider hover:bg-slate-900 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Download size={13} />
                                    <span>Download PDF</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UpiCashPoint;

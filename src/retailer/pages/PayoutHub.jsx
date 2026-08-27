import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { 
    Landmark, Zap, ShieldCheck, CheckCircle2, XCircle, Clock, 
    RefreshCw, Search, ArrowRight, Printer, Download, AlertTriangle, 
    CreditCard, ArrowUpRight, HelpCircle, Check, Copy, ExternalLink, Sparkles, FileText,
    Building2, User, Lock, Activity, Banknote, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { payoutService, transactionService, userService } from '../../services/apiService';
import { dataService } from '../../services/dataService';
import { useWallet } from '../../context/WalletContext';
import DisabledServiceBanner from '../../components/shared/DisabledServiceBanner';

const PayoutHub = () => {
    const user = useMemo(() => dataService.getCurrentUser(), []);
    const { balance, refreshWallet, isWalletLoading } = useWallet();
    const walletBalance = Number(balance || 0);

    // Active View Tab: 'transfer' | 'history'
    const [activeTab, setActiveTab] = useState('transfer');

    // Wallet State
    const balanceLoading = isWalletLoading;

    // Form State
    const [form, setForm] = useState({
        accountNumber: '',
        confirmAccountNumber: '',
        ifsc: '',
        beneficiaryName: '',
        bankName: '',
        branchName: '',
        transferMode: 'IMPS',
        amount: '',
        remarks: ''
    });

    // Verification State
    const [verifying, setVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState(null);
    const [verificationError, setVerificationError] = useState('');

    // Submission & Anti-duplicate State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [receiptData, setReceiptData] = useState(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    // History State
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [statusCheckingId, setStatusCheckingId] = useState(null);
    const [copiedField, setCopiedField] = useState('');
    const [serviceDisabled, setServiceDisabled] = useState(false);

    // Fetch Wallet Balance
    const fetchBalance = useCallback(async () => {
        try {
            await refreshWallet();
        } catch (e) {
            console.warn('Failed to load wallet balance', e);
        }
    }, [refreshWallet]);

    // Fetch Recent Payout Transactions
    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const res = await payoutService.getTransactions();
            if (Array.isArray(res)) {
                setHistory(res);
            }
        } catch (e) {
            console.warn('Failed to fetch payout history', e);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        const checkService = async () => {
            try {
                const services = await userService.getUserServices();
                if (services && services.PAYOUT === false) {
                    setServiceDisabled(true);
                }
            } catch (e) {
                console.warn('Could not verify payout service status', e);
            }
        };
        checkService();
        fetchBalance();
        fetchHistory();
    }, [fetchBalance, fetchHistory]);

    if (serviceDisabled) {
        return <DisabledServiceBanner serviceName="Payout Hub" />;
    }

    // Validation Flags
    const isAccountValid = /^\d{9,18}$/.test(form.accountNumber.trim());
    const isAccountMatching = form.accountNumber.trim() && form.accountNumber.trim() === form.confirmAccountNumber.trim();
    const isIfscValid = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.trim().toUpperCase());
    const isAmountEntered = Number(form.amount) > 0;
    const isAmountWithinBalance = Number(form.amount) <= walletBalance;
    const isNameValid = form.beneficiaryName.trim().length >= 2;

    const canVerify = isAccountValid && isIfscValid && !verifying;
    const canSubmit = isAccountValid && isAccountMatching && isIfscValid && isNameValid && isAmountEntered && isAmountWithinBalance && !isSubmitting;

    // Verify Bank Account (Penny-less)
    const handleVerifyAccount = async () => {
        if (!canVerify) return;
        setVerifying(true);
        setVerificationError('');
        setVerificationResult(null);

        try {
            const res = await payoutService.verifyAccount({
                accountNumber: form.accountNumber.trim(),
                ifsc: form.ifsc.trim().toUpperCase(),
                method: 'penny-less'
            });

            if (res && res.success && res.nameAtBank) {
                setVerificationResult(res);
                setForm(prev => ({
                    ...prev,
                    beneficiaryName: res.nameAtBank,
                    bankName: prev.bankName || (form.ifsc.startsWith('SBIN') ? 'State Bank of India' : '')
                }));
            } else {
                setVerificationError(res?.message || 'Bank account verification failed. Please verify details.');
            }
        } catch (err) {
            setVerificationError(err?.message || 'Verification service temporarily unavailable.');
        } finally {
            setVerifying(false);
        }
    };

    // Submit Payout
    const handlePayoutSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');

        if (!canSubmit) {
            if (!isAmountWithinBalance) {
                setSubmitError(`Insufficient wallet balance. You have ₹${walletBalance.toLocaleString('en-IN')}, but transfer requires ₹${Number(form.amount).toLocaleString('en-IN')}.`);
            } else if (!isAccountMatching) {
                setSubmitError('Account number and confirm account number do not match.');
            } else {
                setSubmitError('Please complete all required beneficiary details correctly.');
            }
            return;
        }

        setIsSubmitting(true);

        try {
            const payload = {
                amount: Number(form.amount),
                beneficiaryName: form.beneficiaryName.trim(),
                accountNumber: form.accountNumber.trim(),
                ifsc: form.ifsc.trim().toUpperCase(),
                bankName: form.bankName.trim() || 'Bank Transfer',
                branchName: form.branchName.trim() || 'Main Branch',
                transferMode: form.transferMode,
                remarks: form.remarks.trim() || 'Instant payout transfer'
            };

            const res = await payoutService.initiatePayout(payload);

            if (res && (res.success || res.status === 'SUCCESS' || res.status === 'INITIATED')) {
                let respData = {};
                try {
                    if (res.responseData) {
                        respData = typeof res.responseData === 'string' ? JSON.parse(res.responseData) : res.responseData;
                    }
                } catch(e) {}
                const bbTxn = respData?.TransactionData?.bbTransactionId || res.transactionId || res.orderId;
                const utrVal = res.utr || respData?.TransactionData?.bbUtrNumber || bbTxn || 'Pending / In Progress';

                setReceiptData({
                    status: res.status || 'SUCCESS',
                    message: res.message || res.responseMessage || 'Payout transferred successfully',
                    orderId: res.orderId || payload.orderId,
                    externalOrderId: res.orderId || payload.orderId,
                    transactionId: bbTxn,
                    utr: utrVal,
                    amount: form.amount,
                    beneficiaryName: form.beneficiaryName,
                    accountNumber: form.accountNumber,
                    ifsc: form.ifsc,
                    bankName: form.bankName || 'Bank Transfer',
                    transferMode: form.transferMode,
                    remarks: form.remarks || 'Instant payout transfer',
                    timestamp: res.timestamp || new Date().toLocaleString('en-IN')
                });
                setShowReceiptModal(true);

                // Reset Form
                setForm({
                    accountNumber: '',
                    confirmAccountNumber: '',
                    ifsc: '',
                    beneficiaryName: '',
                    bankName: '',
                    branchName: '',
                    transferMode: 'IMPS',
                    amount: '',
                    remarks: ''
                });
                setVerificationResult(null);

                // Refresh balance and history
                fetchBalance();
                fetchHistory();
            } else {
                setSubmitError(res?.message || 'Payout transfer failed. Any debited amount has been auto-refunded to your wallet.');
                fetchBalance();
                fetchHistory();
            }
        } catch (err) {
            setSubmitError(err?.message || 'Transfer request failed. Please check your transaction history.');
            fetchBalance();
            fetchHistory();
        } finally {
            setIsSubmitting(false);
        }
    };

    // Status Check for Pending Items
    const handleCheckStatus = async (orderId) => {
        if (!orderId) return;
        setStatusCheckingId(orderId);
        try {
            const res = await payoutService.checkStatus(orderId);
            if (res) {
                fetchHistory();
                fetchBalance();
            }
        } catch (e) {
            console.warn('Status check failed', e);
        } finally {
            setStatusCheckingId(null);
        }
    };

    const handleCopy = (text, field) => {
        if (!text || text === 'N/A') return;
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(''), 2000);
    };

    // Official Print Receipt Generator matching AEPS Receipt Template
    const handlePrintReceipt = () => {
        if (!receiptData) return;
        const logoUrl = window.location.origin + '/rupiksha logo.jpeg';
        const formattedAmount = Number(receiptData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const isSuccess = receiptData.status === 'SUCCESS' || receiptData.status === 'SUCCESSFUL';
        const isPending = receiptData.status === 'INITIATED' || receiptData.status === 'PENDING';

        const printWindow = window.open('', '_blank', 'width=850,height=900');
        if (!printWindow) {
            alert('Please allow popups to print receipt.');
            return;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Rupiksha Payout Receipt - ${receiptData.orderId}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
                        background: #f8fafc;
                        color: #000000;
                        padding: 24px;
                        font-size: 12px;
                        line-height: 1.4;
                    }
                    .receipt-container {
                        max-width: 680px;
                        margin: 0 auto;
                        background: #ffffff;
                        border: 2px solid #000000;
                        border-radius: 12px;
                        padding: 24px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    }
                    .header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding-bottom: 16px;
                        border-bottom: 2px solid #000000;
                    }
                    .header-left {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .logo-img {
                        height: 54px;
                        width: auto;
                        object-fit: contain;
                        border-radius: 8px;
                        border: 1px solid #cbd5e1;
                    }
                    .brand-name {
                        font-size: 22px;
                        font-weight: 900;
                        color: #000000;
                        letter-spacing: -0.5px;
                        line-height: 1.1;
                    }
                    .brand-name span { color: #1d4ed8; }
                    .brand-sub {
                        font-size: 11px;
                        font-weight: 800;
                        color: #000000;
                        text-transform: uppercase;
                        letter-spacing: 0.8px;
                        margin-top: 3px;
                    }
                    .header-right { text-align: right; }
                    .receipt-badge {
                        display: inline-block;
                        background: #f0fdf4;
                        color: #15803d;
                        border: 2px solid #15803d;
                        font-size: 11px;
                        font-weight: 900;
                        padding: 4px 10px;
                        border-radius: 6px;
                        text-transform: uppercase;
                        letter-spacing: 0.8px;
                    }
                    .header-date {
                        font-size: 11px;
                        color: #000000;
                        margin-top: 4px;
                        font-weight: 800;
                    }
                    .status-banner {
                        margin: 16px 0;
                        padding: 12px 16px;
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    }
                    .status-success {
                        background: #f0fdf4;
                        border: 2px solid #16a34a;
                        color: #14532d;
                    }
                    .status-pending {
                        background: #fffbeb;
                        border: 2px solid #d97706;
                        color: #78350f;
                    }
                    .status-failed {
                        background: #fef2f2;
                        border: 2px solid #dc2626;
                        color: #7f1d1d;
                    }
                    .status-title {
                        font-size: 14px;
                        font-weight: 900;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .status-desc { font-size: 11.5px; font-weight: 700; }
                    .amount-card {
                        background: #f8fafc;
                        border: 2px solid #000000;
                        border-radius: 8px;
                        padding: 12px 16px;
                        margin-bottom: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    }
                    .amount-label {
                        font-size: 12px;
                        font-weight: 900;
                        color: #000000;
                        text-transform: uppercase;
                    }
                    .amount-value {
                        font-size: 24px;
                        font-weight: 900;
                        color: #15803d;
                    }
                    .section-title {
                        font-size: 12px;
                        font-weight: 900;
                        text-transform: uppercase;
                        color: #000000;
                        letter-spacing: 0.5px;
                        margin: 14px 0 8px 0;
                        padding-bottom: 4px;
                        border-bottom: 2px solid #000000;
                    }
                    .details-grid {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 14px;
                    }
                    .details-grid td {
                        padding: 8px 10px;
                        border-bottom: 1px solid #cbd5e1;
                        font-size: 12px;
                    }
                    .details-grid tr:nth-child(even) { background: #f1f5f9; }
                    .label-cell {
                        color: #000000;
                        font-weight: 900;
                        width: 38%;
                        text-transform: uppercase;
                        font-size: 11px;
                        letter-spacing: 0.4px;
                    }
                    .value-cell {
                        color: #000000;
                        font-weight: 900;
                        text-align: right;
                        font-size: 12px;
                    }
                    .mono-val {
                        font-family: 'Courier New', Courier, monospace;
                        font-weight: 900;
                        letter-spacing: 0.5px;
                    }
                    .footer-note {
                        background: #f8fafc;
                        border: 1.5px solid #000000;
                        border-radius: 8px;
                        padding: 10px 12px;
                        margin-top: 16px;
                        font-size: 10.5px;
                        font-weight: 700;
                        color: #000000;
                        line-height: 1.5;
                        text-align: center;
                    }
                    .sign-row {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 36px;
                        padding: 0 10px;
                    }
                    .sign-box {
                        text-align: center;
                        width: 180px;
                        border-top: 1.5px dashed #000000;
                        padding-top: 6px;
                        font-size: 11px;
                        font-weight: 900;
                        color: #000000;
                    }
                    @media print {
                        body { background: #ffffff; padding: 0; }
                        .receipt-container { border: 1.5px solid #000000; box-shadow: none; padding: 10px; max-width: 100%; }
                        @page { margin: 8mm 12mm; }
                    }
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    <div class="header">
                        <div class="header-left">
                            <img src="${logoUrl}" alt="Rupiksha Logo" class="logo-img" onerror="this.style.display='none'" />
                            <div>
                                <div class="brand-name">Rupiksha Services <span>Private Limited</span></div>
                                <div class="brand-sub">Instant Bank Payout Terminal</div>
                            </div>
                        </div>
                        <div class="header-right">
                            <div class="receipt-badge">OFFICIAL E-RECEIPT</div>
                            <div class="header-date">${receiptData.timestamp}</div>
                        </div>
                    </div>

                    <div class="status-banner ${isSuccess ? 'status-success' : isPending ? 'status-pending' : 'status-failed'}">
                        <div>
                            <div class="status-title">
                                ${isSuccess ? 'Payout Transfer Successful' : isPending ? 'Payout Transfer Initiated' : 'Payout Transfer Failed'}
                            </div>
                            <div class="status-desc">${receiptData.message}</div>
                        </div>
                        <div style="font-size: 18px; font-weight: 900;">
                            ${isSuccess ? '✓ APPROVED' : isPending ? '⏳ INITIATED' : '✕ FAILED'}
                        </div>
                    </div>

                    <div class="amount-card">
                        <div class="amount-label">Transfer Amount</div>
                        <div class="amount-value">₹ ${formattedAmount}</div>
                    </div>

                    <div class="section-title">Transfer & Account Details</div>
                    <table class="details-grid">
                        <tr>
                            <td class="label-cell">Transfer Rail / Mode</td>
                            <td class="value-cell" style="text-transform: uppercase;">${receiptData.transferMode || 'IMPS'} (Instant Transfer)</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Beneficiary Name</td>
                            <td class="value-cell">${receiptData.beneficiaryName}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Beneficiary Account</td>
                            <td class="value-cell mono-val">${receiptData.accountNumber}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">IFSC Code</td>
                            <td class="value-cell mono-val uppercase">${receiptData.ifsc}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Bank Name</td>
                            <td class="value-cell">${receiptData.bankName}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">External Order ID</td>
                            <td class="value-cell mono-val">${receiptData.orderId}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Provider Transaction ID</td>
                            <td class="value-cell mono-val">${receiptData.transactionId || receiptData.orderId}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Bank UTR / Ref No</td>
                            <td class="value-cell mono-val" style="color: #1d4ed8;">${receiptData.utr || 'Pending / In Progress'}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Transfer Remarks</td>
                            <td class="value-cell">${receiptData.remarks || 'Instant payout transfer'}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Date & Time</td>
                            <td class="value-cell">${receiptData.timestamp}</td>
                        </tr>
                    </table>

                    <div class="footer-note">
                        This is a computer-generated transaction acknowledgement receipt verified through NPCI Banking Gateway. Rupiksha Services Private Limited is an authorized Business Correspondent partner. For queries or support, email support@rupiksha.in.
                    </div>

                    <div class="sign-row">
                        <div class="sign-box">Retailer Signature</div>
                        <div class="sign-box">Authorized BC Seal / Signature</div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.focus();
                            window.print();
                        }, 250);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <div className="w-full min-h-[calc(100vh-85px)] bg-slate-50/70 p-2.5 sm:p-4 md:p-5 lg:p-6 font-['Inter',sans-serif]">
            <div className="mx-auto max-w-6xl space-y-4">

                {/* ─── Modern Terminal Header ───────────────────────────────── */}
                <div className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-xs">
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between relative z-10">
                        {/* Terminal Branding */}
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20">
                                <Zap size={22} className="animate-pulse" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 leading-none">
                                        Instant Payout Terminal
                                    </h1>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                                        Rail 24x7 Active
                                    </span>
                                </div>
                                <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">
                                    Rupiksha Services Private Limited • NPCI Verified Banking Transfer
                                </p>
                            </div>
                        </div>

                        {/* Middle & Right: Navigation Tabs & Wallet Balance */}
                        <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-wrap">
                            
                            {/* View Switcher Tabs */}
                            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('transfer')}
                                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                                        activeTab === 'transfer'
                                            ? 'bg-white text-blue-700 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <SendIcon size={13} />
                                    <span>New Transfer</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setActiveTab('history'); fetchHistory(); }}
                                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                                        activeTab === 'history'
                                            ? 'bg-white text-blue-700 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Clock size={13} />
                                    <span>History</span>
                                    {history.length > 0 && (
                                        <span className="rounded-full bg-blue-100 text-blue-800 px-1.5 py-0.2 text-[9.5px] font-black">
                                            {history.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Wallet Balance Pill (Light Theme Matching UI) */}
                            <div className="flex items-center gap-2.5 bg-blue-50/90 border border-blue-200 text-slate-800 px-3.5 py-1.5 rounded-xl shadow-2xs shrink-0">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                                    <CreditCard size={16} />
                                </div>
                                <div className="text-left">
                                    <div className="text-[9.5px] font-black uppercase tracking-wider text-blue-700 leading-none">
                                        Main Wallet
                                    </div>
                                    <div className="text-sm sm:text-base font-black font-mono leading-tight text-slate-900 mt-0.5">
                                        ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={fetchBalance} 
                                    disabled={balanceLoading}
                                    title="Refresh Balance"
                                    className="p-1 text-slate-400 hover:text-blue-700 rounded transition"
                                >
                                    <RefreshCw size={13} className={balanceLoading ? 'animate-spin text-blue-600' : ''} />
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

                {/* ─── Tab 1: Terminal Form & Live Action Split Layout ──────── */}
                {activeTab === 'transfer' && (
                    <form onSubmit={handlePayoutSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        
                        {/* ══ LEFT (COL 1 to 7): Beneficiary & Rail Inputs ════════ */}
                        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl md:rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
                            
                            {/* ── Step 1: Beneficiary Bank Details ── */}
                            <div className="space-y-3 p-3 sm:p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                                            1
                                        </div>
                                        <span className="text-xs sm:text-[13px] font-black uppercase tracking-wide text-slate-800">
                                            Beneficiary Account Details
                                        </span>
                                    </div>

                                    {isAccountValid && isIfscValid && (
                                        <button
                                            type="button"
                                            onClick={handleVerifyAccount}
                                            disabled={verifying}
                                            className="inline-flex items-center gap-1.5 text-[10.5px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                                        >
                                            {verifying ? (
                                                <>
                                                    <RefreshCw size={11} className="animate-spin" />
                                                    Verifying Account...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={11} />
                                                    Verify Account Holder
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* 2x2 Clean Inputs */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    
                                    {/* Account Number */}
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                            Account Number *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono transition"
                                            placeholder="Enter bank account number"
                                            value={form.accountNumber}
                                            onChange={(e) => setForm(p => ({ ...p, accountNumber: e.target.value.replace(/\D/g, '') }))}
                                            maxLength={18}
                                        />
                                    </div>

                                    {/* Confirm Account Number */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                                Confirm Account Number *
                                            </label>
                                            {form.confirmAccountNumber && (
                                                <span className={`text-[10px] font-black ${isAccountMatching ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                    {isAccountMatching ? '✓ Matched' : '✕ Mismatch'}
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            className={`w-full rounded-xl border px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none font-mono transition ${
                                                form.confirmAccountNumber && !isAccountMatching
                                                    ? 'border-rose-300 bg-rose-50/50 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                                                    : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                            }`}
                                            placeholder="Re-enter account number"
                                            value={form.confirmAccountNumber}
                                            onChange={(e) => setForm(p => ({ ...p, confirmAccountNumber: e.target.value.replace(/\D/g, '') }))}
                                            maxLength={18}
                                        />
                                    </div>

                                    {/* IFSC Code */}
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                            IFSC Code *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold uppercase text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono transition"
                                            placeholder="e.g. SBIN0001234"
                                            value={form.ifsc}
                                            onChange={(e) => setForm(p => ({ ...p, ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                                            maxLength={11}
                                        />
                                    </div>

                                    {/* Beneficiary Legal Name */}
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                            Beneficiary Legal Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                                            placeholder="Name as in bank records"
                                            value={form.beneficiaryName}
                                            onChange={(e) => setForm(p => ({ ...p, beneficiaryName: e.target.value }))}
                                        />
                                    </div>

                                </div>

                                {/* Inline Verification Result */}
                                {verificationResult && (
                                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                        <span>
                                            Verified: <strong className="font-black">{verificationResult.nameAtBank}</strong> (Status: {verificationResult.acValidationStatus})
                                        </span>
                                    </div>
                                )}

                                {verificationError && (
                                    <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800">
                                        <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                                        <span>{verificationError}</span>
                                    </div>
                                )}
                            </div>

                            {/* ── Step 2: Payment Rail & Amount ── */}
                            <div className="space-y-3 p-3 sm:p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl">
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                                        2
                                    </div>
                                    <span className="text-xs sm:text-[13px] font-black uppercase tracking-wide text-slate-800">
                                        Transfer Rail & Amount
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    
                                    {/* Rail Selector Pills */}
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                            Payment Rail *
                                        </label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {[
                                                { mode: 'IMPS', title: 'IMPS', desc: 'Instant' },
                                                { mode: 'NEFT', title: 'NEFT', desc: 'Batch' },
                                                { mode: 'RTGS', title: 'RTGS', desc: '₹2L+' }
                                            ].map(item => (
                                                <button
                                                    key={item.mode}
                                                    type="button"
                                                    onClick={() => setForm(p => ({ ...p, transferMode: item.mode }))}
                                                    className={`rounded-xl border py-2 px-1.5 text-center transition cursor-pointer ${
                                                        form.transferMode === item.mode
                                                            ? 'border-blue-600 bg-blue-600 text-white font-black shadow-xs'
                                                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="text-xs font-black leading-tight">{item.title}</div>
                                                    <div className={`text-[9px] font-bold leading-tight ${form.transferMode === item.mode ? 'text-blue-100' : 'text-slate-400'}`}>
                                                        {item.desc}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Amount Input */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                                Transfer Amount (₹) *
                                            </label>
                                            {form.amount && !isAmountWithinBalance && (
                                                <span className="text-[10px] font-black text-rose-600">
                                                    Exceeds balance
                                                </span>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-black text-slate-400">₹</span>
                                            <input
                                                type="text"
                                                required
                                                className={`w-full rounded-xl border pl-8 pr-3.5 py-2 text-base font-black text-slate-900 placeholder:text-slate-400 outline-none font-mono transition ${
                                                    form.amount && !isAmountWithinBalance
                                                        ? 'border-rose-300 bg-rose-50/50 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                                                        : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                                }`}
                                                placeholder="0.00"
                                                value={form.amount}
                                                onChange={(e) => setForm(p => ({ ...p, amount: e.target.value.replace(/[^\d.]/g, '') }))}
                                            />
                                        </div>
                                    </div>

                                </div>
                            </div>

                        </div>

                        {/* ══ RIGHT (COL 8 to 12): Live Telemetry, Remarks & Transfer CTA ══ */}
                        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl md:rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
                            
                            {/* Live Transaction Preview (Matching Light UI) */}
                            <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/50 p-4 border border-blue-100/90 shadow-2xs space-y-2.5">
                                <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <Activity size={13} className="text-blue-600" />
                                        Live Transfer Summary
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-black uppercase font-mono shadow-2xs">
                                        {form.transferMode} RAIL
                                    </span>
                                </div>

                                <div className="flex items-baseline justify-between py-1">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                        Amount
                                    </span>
                                    <div className="text-2xl sm:text-3xl font-black font-mono text-blue-700 tracking-tight">
                                        ₹ {Number(form.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>

                                <div className="space-y-1.5 text-xs border-t border-blue-100/80 pt-2.5">
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span className="text-slate-500 text-[11px]">Beneficiary:</span>
                                        <span className="font-black text-slate-900 truncate max-w-[190px]">
                                            {form.beneficiaryName || '—'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span className="text-slate-500 text-[11px]">Account:</span>
                                        <span className="font-mono font-bold text-slate-900">
                                            {form.accountNumber ? `${form.accountNumber.slice(0, 3)}••••${form.accountNumber.slice(-4)}` : '—'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span className="text-slate-500 text-[11px]">IFSC:</span>
                                        <span className="font-mono font-bold uppercase text-slate-900">
                                            {form.ifsc || '—'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span className="text-slate-500 text-[11px]">Est. Settlement:</span>
                                        <span className="font-black text-emerald-700">
                                            {form.transferMode === 'IMPS' ? 'Instant (< 5s)' : form.transferMode === 'NEFT' ? '30 - 60 mins' : 'Instant (RTGS)'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Remarks Field */}
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                    Transaction Remarks (Optional)
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition"
                                    placeholder="e.g. Vendor payout, salary, or customer settlement"
                                    value={form.remarks}
                                    onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))}
                                    maxLength={100}
                                />
                            </div>

                            {/* Submit Error banner */}
                            {submitError && (
                                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-700">
                                    <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                                    <span>{submitError}</span>
                                </div>
                            )}

                            {/* Primary Action Submit Button */}
                            <div className="space-y-2 pt-1">
                                <button
                                    type="submit"
                                    disabled={!canSubmit || isSubmitting}
                                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 py-3 text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer active:scale-[0.99]"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <RefreshCw size={16} className="animate-spin" />
                                            Routing Bank Transfer...
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck size={18} />
                                            Confirm & Transfer Payout
                                        </>
                                    )}
                                </button>

                                <div className="flex items-center justify-center gap-3 text-[10.5px] font-bold text-slate-500 text-center flex-wrap">
                                    <span className="flex items-center gap-1 text-emerald-700">
                                        <CheckCircle2 size={12} /> Instant Auto-Refund on failure
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1 text-blue-700">
                                        <Lock size={12} /> 256-bit Encrypted Banking
                                    </span>
                                </div>
                            </div>

                        </div>

                    </form>
                )}

                {/* ─── Tab 2: Recent Transfers History ──────────────────────────── */}
                {activeTab === 'history' && (
                    <div className="rounded-2xl md:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h2 className="text-sm sm:text-base font-black text-slate-900">Recent Payout Transactions</h2>
                                <p className="text-[11px] font-semibold text-slate-500">Live status of your initiated payouts</p>
                            </div>
                            <button
                                type="button"
                                onClick={fetchHistory}
                                disabled={historyLoading}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                            >
                                <RefreshCw size={11} className={historyLoading ? 'animate-spin' : ''} />
                                Refresh
                            </button>
                        </div>

                        {historyLoading && history.length === 0 ? (
                            <div className="py-8 text-center text-xs font-bold text-slate-400">
                                Loading transfer history...
                            </div>
                        ) : history.length === 0 ? (
                            <div className="py-8 text-center text-xs font-bold text-slate-400">
                                No payout transfers found yet. Initiated transfers will appear here.
                            </div>
                        ) : (
                            <div className="mt-3 overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                            <th className="pb-2.5">Date & Time</th>
                                            <th className="pb-2.5">Order ID / UTR</th>
                                            <th className="pb-2.5">Beneficiary</th>
                                            <th className="pb-2.5">Mode</th>
                                            <th className="pb-2.5 text-right">Amount</th>
                                            <th className="pb-2.5 text-center">Status</th>
                                            <th className="pb-2.5 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                        {history.map(txn => {
                                            const isSuccess = txn.status === 'SUCCESS' || txn.status === 'SUCCESSFUL';
                                            const isFailed = txn.status === 'FAILED' || txn.status === 'FAILURE';
                                            const isPending = !isSuccess && !isFailed;

                                            return (
                                                <tr key={txn.id || txn.orderId} className="hover:bg-slate-50/60 transition">
                                                    <td className="py-2.5 font-mono text-[11px] text-slate-500">
                                                        {txn.createdAt ? new Date(txn.createdAt).toLocaleString('en-IN') : 'N/A'}
                                                    </td>
                                                    <td className="py-2.5 font-mono">
                                                        <div className="font-bold text-slate-900">{txn.orderId}</div>
                                                        {txn.utr && (
                                                            <div className="text-[10px] text-slate-400">UTR: {txn.utr}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5">
                                                        <div className="font-bold text-slate-900">{txn.beneficiaryName}</div>
                                                        <div className="font-mono text-[10px] text-slate-400">
                                                            {txn.accountNumber} ({txn.ifsc})
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 font-bold text-blue-600 uppercase">
                                                        {txn.transferMode || 'IMPS'}
                                                    </td>
                                                    <td className="py-2.5 text-right font-black text-slate-900 font-mono">
                                                        ₹{Number(txn.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-2.5 text-center">
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                                                            isSuccess
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : isFailed
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}>
                                                            {isSuccess ? '✓ Success' : isFailed ? '✕ Failed' : '⏳ Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 text-right">
                                                        {isPending ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCheckStatus(txn.orderId)}
                                                                disabled={statusCheckingId === txn.orderId}
                                                                className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition"
                                                            >
                                                                {statusCheckingId === txn.orderId ? 'Checking...' : 'Check Status'}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setReceiptData({
                                                                        status: txn.status,
                                                                        message: txn.responseMessage || 'Transfer processed',
                                                                        orderId: txn.orderId,
                                                                        externalOrderId: txn.orderId,
                                                                        transactionId: txn.utr || txn.orderId,
                                                                        utr: txn.utr || 'Pending / In Progress',
                                                                        amount: txn.amount,
                                                                        beneficiaryName: txn.beneficiaryName,
                                                                        accountNumber: txn.accountNumber,
                                                                        ifsc: txn.ifsc,
                                                                        bankName: txn.bankName || 'Bank Transfer',
                                                                        transferMode: txn.transferMode || 'IMPS',
                                                                        remarks: txn.remarks || 'Instant payout transfer',
                                                                        timestamp: txn.createdAt ? new Date(txn.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')
                                                                    });
                                                                    setShowReceiptModal(true);
                                                                }}
                                                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                                            >
                                                                Receipt
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── Processing Live Animation Modal Lock (Visible until response) ─── */}
            <AnimatePresence>
                {isSubmitting && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-sans">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl border border-slate-200 overflow-hidden"
                        >
                            {/* Ambient Glow */}
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

                            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 border border-blue-200 text-blue-600 shadow-inner">
                                <RefreshCw size={36} className="animate-spin text-blue-600" />
                                <div className="absolute inset-0 rounded-3xl border-2 border-blue-400 animate-ping opacity-25 pointer-events-none" />
                            </div>

                            <h3 className="mt-5 text-xl font-black text-slate-900 tracking-tight">
                                Processing Bank Payout
                            </h3>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                                Transferring <strong className="text-slate-900">₹{Number(form.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> to <strong className="text-slate-900">{form.beneficiaryName || 'Beneficiary'}</strong>
                            </p>

                            {/* Real-time Processing Steps */}
                            <div className="mt-6 space-y-2.5 text-left border border-slate-100 bg-slate-50/80 rounded-2xl p-4 text-xs font-bold">
                                <div className="flex items-center gap-2.5 text-emerald-700">
                                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                    <span>Wallet balance verified & debited</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-blue-700 animate-pulse">
                                    <RefreshCw size={14} className="animate-spin text-blue-600 shrink-0" />
                                    <span>Routing securely to {form.transferMode || 'IMPS'} Banking Rail</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-slate-400">
                                    <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 shrink-0" />
                                    <span>Awaiting final bank acknowledgment</span>
                                </div>
                            </div>

                            <p className="mt-4 text-[11px] font-semibold text-slate-400 leading-relaxed">
                                Please do not close, refresh, or navigate away from this page.
                            </p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ─── Premium Payout Receipt Modal (Matching AEPS Receipt Design) ──── */}
            <AnimatePresence>
                {showReceiptModal && receiptData && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm font-['Inter',sans-serif] overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 10 }}
                            className="relative bg-white border border-slate-300 shadow-[0_25px_70px_rgba(0,0,0,0.3)] rounded-2xl md:rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
                        >
                            {/* Top Bar with title & Close Cut Button */}
                            <div className="px-4 sm:px-6 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wide text-black">
                                    <ShieldCheck size={17} className="text-emerald-600 shrink-0" />
                                    <span>Payout Transfer E-Receipt</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowReceiptModal(false)}
                                    title="Close Receipt"
                                    className="p-1.5 text-black hover:text-white bg-white hover:bg-slate-900 border border-slate-300 rounded-full transition-all cursor-pointer shadow-sm hover:scale-105"
                                >
                                    <XCircle size={17} strokeWidth={2.5} />
                                </button>
                            </div>

                            {/* Responsive 2-Part Split Layout Body */}
                            <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start">

                                    {/* ══ LEFT PART (COL 1 to 5): Branding, Status & Amount ══ */}
                                    <div className="md:col-span-5 flex flex-col space-y-3.5">
                                        {/* Branding Header */}
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-300 rounded-2xl shadow-2xs">
                                            <img
                                                src="/rupiksha logo.jpeg"
                                                alt="Rupiksha Logo"
                                                className="h-11 w-11 object-contain rounded-xl border border-slate-300 p-0.5 bg-white shrink-0 shadow-xs"
                                                onError={e => { e.currentTarget.style.display = 'none'; }}
                                            />
                                            <div className="text-left">
                                                <h2 className="text-base sm:text-lg font-black tracking-tight text-black leading-none">
                                                    Rupiksha Services <span className="text-blue-700">Private Limited</span>
                                                </h2>
                                                <p className="text-[10px] sm:text-[11px] font-black text-slate-800 uppercase tracking-wider mt-1">
                                                    Instant Payout Terminal
                                                </p>
                                            </div>
                                        </div>

                                        {/* Status & Prominent Amount Box */}
                                        <div className="bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-center shadow-2xs">
                                            <div className="flex items-center justify-center mb-2">
                                                {receiptData.status === 'SUCCESS' || receiptData.status === 'SUCCESSFUL' ? (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-950 border-2 border-emerald-400 rounded-full text-xs font-black uppercase tracking-wide">
                                                        <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
                                                        <span>Payout Approved</span>
                                                    </div>
                                                ) : receiptData.status === 'INITIATED' || receiptData.status === 'PENDING' ? (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-950 border-2 border-amber-400 rounded-full text-xs font-black uppercase tracking-wide">
                                                        <Clock size={15} className="text-amber-700 shrink-0" />
                                                        <span>Payout Initiated</span>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-950 border-2 border-rose-400 rounded-full text-xs font-black uppercase tracking-wide">
                                                        <XCircle size={15} className="text-rose-700 shrink-0" />
                                                        <span>Payout Declined</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="py-1">
                                                <p className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                                                    Transfer Amount
                                                </p>
                                                <div className={`text-2xl sm:text-3xl font-black tracking-tight mt-0.5 ${
                                                    receiptData.status === 'SUCCESS' || receiptData.status === 'SUCCESSFUL'
                                                        ? 'text-emerald-700'
                                                        : 'text-black'
                                                }`}>
                                                    ₹ {Number(receiptData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>

                                            {receiptData.message && (
                                                <p className="text-[11px] font-bold text-slate-800 mt-1 leading-snug">
                                                    {receiptData.message}
                                                </p>
                                            )}
                                        </div>

                                        {/* Beneficiary Quick Card */}
                                        <div className="border border-slate-300 rounded-2xl p-3 bg-white shadow-xs text-xs">
                                            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                                Credited To
                                            </span>
                                            <div className="font-black text-slate-900 text-sm">{receiptData.beneficiaryName}</div>
                                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600 mt-0.5">
                                                <Landmark size={13} className="text-blue-700 shrink-0" />
                                                <span>{receiptData.bankName}</span>
                                            </div>
                                            <div className="font-mono font-bold text-slate-800 mt-0.5">
                                                A/C: {receiptData.accountNumber}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ══ RIGHT PART (COL 6 to 12): All IDs & Transaction Details in High Contrast ══ */}
                                    <div className="md:col-span-7 flex flex-col space-y-3">
                                        <div className="border border-slate-300 rounded-2xl p-3 sm:p-4 bg-slate-50/90 shadow-2xs">
                                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-300">
                                                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                                    <FileText size={15} className="text-blue-700" />
                                                    Transfer Details & References
                                                </span>
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-black text-white px-2 py-0.5 rounded-md">
                                                    Verified
                                                </span>
                                            </div>

                                            {/* 2-Column Details Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                                                
                                                {/* External Order ID */}
                                                <div className="bg-white p-2.5 rounded-xl border border-slate-200 relative group">
                                                    <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                        External Order ID
                                                    </span>
                                                    <div className="flex items-center justify-between mt-0.5">
                                                        <span className="text-xs sm:text-[12.5px] font-mono font-black text-black truncate select-all">
                                                            {receiptData.orderId}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopy(receiptData.orderId, 'orderId')}
                                                            title="Copy Order ID"
                                                            className="text-slate-400 hover:text-blue-700 p-0.5 transition"
                                                        >
                                                            {copiedField === 'orderId' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Provider Transaction ID */}
                                                <div className="bg-white p-2.5 rounded-xl border border-slate-200 relative group">
                                                    <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                        Transaction ID (Ref)
                                                    </span>
                                                    <div className="flex items-center justify-between mt-0.5">
                                                        <span className="text-xs sm:text-[12.5px] font-mono font-black text-black truncate select-all">
                                                            {receiptData.transactionId || receiptData.orderId}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopy(receiptData.transactionId || receiptData.orderId, 'txnId')}
                                                            title="Copy Transaction ID"
                                                            className="text-slate-400 hover:text-blue-700 p-0.5 transition"
                                                        >
                                                            {copiedField === 'txnId' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Bank UTR */}
                                                <div className="bg-white p-2.5 rounded-xl border border-slate-200 sm:col-span-2 relative group">
                                                    <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                        Bank UTR Number / Reference
                                                    </span>
                                                    <div className="flex items-center justify-between mt-0.5">
                                                        <span className="text-xs sm:text-[13px] font-mono font-black text-blue-700 truncate select-all">
                                                            {receiptData.utr || 'Pending / In Progress'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopy(receiptData.utr, 'utr')}
                                                            title="Copy UTR"
                                                            className="text-slate-400 hover:text-blue-700 p-0.5 transition"
                                                        >
                                                            {copiedField === 'utr' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Transfer Rail */}
                                                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                                    <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                        Payment Rail
                                                    </span>
                                                    <span className="block text-xs sm:text-[13px] font-black text-blue-700 mt-0.5 uppercase">
                                                        {receiptData.transferMode || 'IMPS'} (Instant 24x7)
                                                    </span>
                                                </div>

                                                {/* IFSC Code */}
                                                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                                    <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                        IFSC Code
                                                    </span>
                                                    <span className="block text-xs sm:text-[13px] font-mono font-black text-black mt-0.5 uppercase">
                                                        {receiptData.ifsc}
                                                    </span>
                                                </div>

                                                {/* Account Number */}
                                                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                                    <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                        Account Number
                                                    </span>
                                                    <span className="block text-xs sm:text-[13px] font-mono font-black text-black mt-0.5">
                                                        {receiptData.accountNumber}
                                                    </span>
                                                </div>

                                                {/* Remarks */}
                                                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                                    <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                        Transfer Remarks
                                                    </span>
                                                    <span className="block text-xs sm:text-[13px] font-black text-slate-800 mt-0.5 truncate">
                                                        {receiptData.remarks || 'Instant payout transfer'}
                                                    </span>
                                                </div>

                                                {/* Transaction Timestamp */}
                                                <div className="bg-white p-2.5 rounded-xl border border-slate-200 sm:col-span-2">
                                                    <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                        Transaction Date & Time
                                                    </span>
                                                    <span className="block text-xs sm:text-[13px] font-black text-black mt-0.5">
                                                        {receiptData.timestamp}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* SOP Compliance Disclaimer */}
                                        <div className="p-2.5 bg-slate-100 border border-slate-300 rounded-xl text-[10.5px] font-bold text-black text-center leading-snug">
                                            System generated e-receipt • NPCI Banking Gateway Settlement • Rupiksha Licensed BC
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Bottom Action buttons */}
                            <div className="px-4 sm:px-6 py-3 bg-slate-100 border-t border-slate-300 flex items-center justify-end gap-2.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={handlePrintReceipt}
                                    className="flex-1 sm:flex-initial py-2.5 px-5 bg-black hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02]"
                                >
                                    <Printer size={15} />
                                    <span>Print Receipt</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePrintReceipt}
                                    className="py-2.5 px-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-300 text-blue-900 rounded-xl font-black uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02]"
                                >
                                    <Download size={15} />
                                    <span>PDF</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowReceiptModal(false)}
                                    className="py-2.5 px-5 bg-white hover:bg-slate-200 border-2 border-slate-300 text-black rounded-xl font-black uppercase tracking-wider text-xs transition-all cursor-pointer hover:scale-[1.02]"
                                >
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
};

// Helper SVG icon for transfer
const SendIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
);

export default PayoutHub;

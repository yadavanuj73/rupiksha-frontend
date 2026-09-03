import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { 
    Landmark, Zap, ShieldCheck, CheckCircle2, XCircle, Clock, 
    RefreshCw, Search, ArrowRight, Printer, Download, AlertTriangle, 
    CreditCard, ArrowUpRight, HelpCircle, Check, Copy, ExternalLink, Sparkles, FileText,
    Building2, User, Lock, Activity, Banknote, Shield, Users, UserPlus, Trash2, Plus,
    BookmarkPlus, CheckCheck, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { payoutService, transactionService, userService } from '../../services/apiService';
import { dataService } from '../../services/dataService';
import { payoutChargeService } from '../../services/payoutChargeService';
import { useWallet } from '../../context/WalletContext';
import DisabledServiceBanner from '../../components/shared/DisabledServiceBanner';

const PayoutHub = () => {
    const user = useMemo(() => dataService.getCurrentUser(), []);
    const { balance, refreshWallet, isWalletLoading } = useWallet();
    const walletBalance = Number(balance || 0);

    // Active View Tab: 'transfer' | 'beneficiaries' | 'history'
    const [activeTab, setActiveTab] = useState('transfer');

    // Charge slabs state
    const [chargeSlabs, setChargeSlabs] = useState([]);

    // Beneficiary State
    const [beneficiaries, setBeneficiaries] = useState([]);
    const [beneficiariesLoading, setBeneficiariesLoading] = useState(false);
    const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState(null);
    const [saveToBeneficiaries, setSaveToBeneficiaries] = useState(false);
    const [beneficiarySearch, setBeneficiarySearch] = useState('');
    const [showAddBeneModal, setShowAddBeneModal] = useState(false);
    const [deletingBeneId, setDeletingBeneId] = useState(null);

    // Modal Add Beneficiary Form
    const [newBeneForm, setNewBeneForm] = useState({
        accountNumber: '',
        confirmAccountNumber: '',
        ifsc: '',
        beneficiaryName: '',
        bankName: '',
        nickName: '',
        isVerified: false,
        verifying: false,
        verifyError: '',
        submitError: '',
        isSubmitting: false
    });

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

    // Fetch Saved Beneficiaries
    const fetchBeneficiaries = useCallback(async () => {
        setBeneficiariesLoading(true);
        try {
            const res = await payoutService.getBeneficiaries();
            if (Array.isArray(res)) {
                setBeneficiaries(res);
            }
        } catch (e) {
            console.warn('Failed to load beneficiaries', e);
        } finally {
            setBeneficiariesLoading(false);
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
        fetchBeneficiaries();
        payoutChargeService.getCharges().then(res => {
            if (Array.isArray(res) && res.length > 0) setChargeSlabs(res);
        }).catch(() => {});
    }, [fetchBalance, fetchBeneficiaries]);

    // Beneficiary Quick Selection
    const handleSelectBeneficiary = (bene) => {
        setSelectedBeneficiaryId(bene.id);
        setForm(prev => ({
            ...prev,
            accountNumber: bene.accountNumber,
            confirmAccountNumber: bene.accountNumber,
            ifsc: bene.ifsc,
            beneficiaryName: bene.beneficiaryName,
            bankName: bene.bankName || ''
        }));
        setVerificationError('');
        if (bene.isVerified) {
            setVerificationResult({
                nameAtBank: bene.beneficiaryName,
                acValidationStatus: 'VERIFIED'
            });
        } else {
            setVerificationResult(null);
        }
        setActiveTab('transfer');
    };

    const handleClearSelectedBeneficiary = () => {
        setSelectedBeneficiaryId(null);
        setForm(prev => ({
            ...prev,
            accountNumber: '',
            confirmAccountNumber: '',
            ifsc: '',
            beneficiaryName: '',
            bankName: ''
        }));
        setVerificationResult(null);
        setVerificationError('');
    };

    const handleDeleteBeneficiary = async (id, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm('Are you sure you want to remove this saved beneficiary?')) return;
        setDeletingBeneId(id);
        try {
            await payoutService.deleteBeneficiary(id);
            if (selectedBeneficiaryId === id) {
                handleClearSelectedBeneficiary();
            }
            fetchBeneficiaries();
        } catch (err) {
            alert(err?.message || 'Failed to delete beneficiary');
        } finally {
            setDeletingBeneId(null);
        }
    };

    // Modal Beneficiary Verification
    const handleVerifyNewBeneInModal = async () => {
        const isAccOk = /^\d{9,18}$/.test(newBeneForm.accountNumber.trim());
        const isIfscOk = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(newBeneForm.ifsc.trim().toUpperCase());
        if (!isAccOk || !isIfscOk) {
            setNewBeneForm(p => ({ ...p, verifyError: 'Enter valid Account Number & IFSC code before verifying' }));
            return;
        }
        setNewBeneForm(p => ({ ...p, verifying: true, verifyError: '' }));
        try {
            const res = await payoutService.verifyAccount({
                accountNumber: newBeneForm.accountNumber.trim(),
                ifsc: newBeneForm.ifsc.trim().toUpperCase(),
                method: 'penny-less'
            });
            if (res && res.success && res.nameAtBank) {
                setNewBeneForm(p => ({
                    ...p,
                    beneficiaryName: res.nameAtBank,
                    bankName: p.bankName || (p.ifsc.startsWith('SBIN') ? 'State Bank of India' : 'Bank Transfer'),
                    isVerified: true,
                    verifying: false
                }));
            } else {
                setNewBeneForm(p => ({
                    ...p,
                    verifyError: res?.message || 'Account verification failed. Please verify IFSC & Account Number.',
                    verifying: false
                }));
            }
        } catch (err) {
            setNewBeneForm(p => ({
                ...p,
                verifyError: err?.message || 'Verification service temporarily unavailable.',
                verifying: false
            }));
        }
    };

    // Modal Beneficiary Submit
    const handleSaveNewBeneficiary = async (e) => {
        e.preventDefault();
        const isAccOk = /^\d{9,18}$/.test(newBeneForm.accountNumber.trim());
        const isMatch = newBeneForm.accountNumber.trim() === newBeneForm.confirmAccountNumber.trim();
        const isIfscOk = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(newBeneForm.ifsc.trim().toUpperCase());
        const isNameOk = newBeneForm.beneficiaryName.trim().length >= 2;

        if (!isAccOk) {
            setNewBeneForm(p => ({ ...p, submitError: 'Invalid account number (9 to 18 digits)' }));
            return;
        }
        if (!isMatch) {
            setNewBeneForm(p => ({ ...p, submitError: 'Account number and confirmation do not match' }));
            return;
        }
        if (!isIfscOk) {
            setNewBeneForm(p => ({ ...p, submitError: 'Invalid IFSC code format (e.g. SBIN0001234)' }));
            return;
        }
        if (!isNameOk) {
            setNewBeneForm(p => ({ ...p, submitError: 'Beneficiary legal name is required' }));
            return;
        }

        setNewBeneForm(p => ({ ...p, isSubmitting: true, submitError: '' }));
        try {
            const res = await payoutService.addBeneficiary({
                accountNumber: newBeneForm.accountNumber.trim(),
                ifsc: newBeneForm.ifsc.trim().toUpperCase(),
                beneficiaryName: newBeneForm.beneficiaryName.trim(),
                bankName: newBeneForm.bankName.trim() || 'Bank Transfer',
                nickName: newBeneForm.nickName.trim() || undefined,
                isVerified: newBeneForm.isVerified
            });

            await fetchBeneficiaries();
            setShowAddBeneModal(false);
            if (res && res.id) {
                handleSelectBeneficiary(res);
            }
            setNewBeneForm({
                accountNumber: '',
                confirmAccountNumber: '',
                ifsc: '',
                beneficiaryName: '',
                bankName: '',
                nickName: '',
                isVerified: false,
                verifying: false,
                verifyError: '',
                submitError: '',
                isSubmitting: false
            });
        } catch (err) {
            setNewBeneForm(p => ({ ...p, submitError: err?.message || 'Failed to save beneficiary', isSubmitting: false }));
        }
    };

    // Approval Status Groups
    const approvedBeneficiaries = useMemo(() => beneficiaries.filter(b => b.status === 'APPROVED'), [beneficiaries]);
    const pendingBeneficiaries = useMemo(() => beneficiaries.filter(b => b.status === 'PENDING'), [beneficiaries]);
    const rejectedBeneficiaries = useMemo(() => beneficiaries.filter(b => b.status === 'REJECTED'), [beneficiaries]);

    const hasApproved = approvedBeneficiaries.length > 0;
    const hasPendingOnly = !hasApproved && pendingBeneficiaries.length > 0;
    const hasRejectedOnly = !hasApproved && !hasPendingOnly && rejectedBeneficiaries.length > 0;
    const hasNone = beneficiaries.length === 0;

    // Auto-select first approved beneficiary if not already selected
    useEffect(() => {
        if (approvedBeneficiaries.length > 0) {
            const currentSelected = approvedBeneficiaries.find(b => b.id === selectedBeneficiaryId);
            if (!currentSelected) {
                handleSelectBeneficiary(approvedBeneficiaries[0]);
            }
        }
    }, [approvedBeneficiaries, selectedBeneficiaryId]);

    // Dynamic Charge & GST Calculation
    const payoutChargeInfo = useMemo(() => {
        return payoutChargeService.calculateChargeForAmount(form.amount, chargeSlabs);
    }, [form.amount, chargeSlabs]);

    // Validation Flags
    const isAccountValid = /^\d{9,18}$/.test(form.accountNumber.trim());
    const isAccountMatching = form.accountNumber.trim() && form.accountNumber.trim() === form.confirmAccountNumber.trim();
    const isIfscValid = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.trim().toUpperCase());
    const numAmount = Number(form.amount) || 0;
    const isAmountEntered = numAmount >= 500;
    const isAmountBelowMin = form.amount !== '' && numAmount < 500;
    const isAmountWithinBalance = isAmountEntered && payoutChargeInfo.totalDeduction <= walletBalance;
    const isNameValid = form.beneficiaryName.trim().length >= 2;

    const canVerify = isAccountValid && isIfscValid && !verifying;
    const canSubmit = isAccountValid && isAccountMatching && isIfscValid && isNameValid && isAmountEntered && isAmountWithinBalance && !isSubmitting;

    // Filtered Beneficiaries List for search
    const filteredBeneficiaries = useMemo(() => {
        if (!beneficiarySearch.trim()) return beneficiaries;
        const q = beneficiarySearch.toLowerCase();
        return beneficiaries.filter(b => 
            (b.beneficiaryName && b.beneficiaryName.toLowerCase().includes(q)) ||
            (b.accountNumber && b.accountNumber.includes(q)) ||
            (b.ifsc && b.ifsc.toLowerCase().includes(q)) ||
            (b.bankName && b.bankName.toLowerCase().includes(q)) ||
            (b.nickName && b.nickName.toLowerCase().includes(q))
        );
    }, [beneficiaries, beneficiarySearch]);

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
            if (isAmountBelowMin) {
                setSubmitError('Minimum transfer amount is ₹500.00.');
            } else if (!isAmountWithinBalance) {
                setSubmitError(`Insufficient wallet balance. Total required: ₹${payoutChargeInfo.totalDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Transfer ₹${Number(form.amount).toLocaleString('en-IN')} + Base Charge ₹${payoutChargeInfo.baseCharge.toFixed(2)} + GST (${payoutChargeInfo.gstRate || 18}%) ₹${payoutChargeInfo.gstAmount.toFixed(2)} = Total Charges ₹${payoutChargeInfo.totalCharge.toFixed(2)}). Available: ₹${walletBalance.toLocaleString('en-IN')}.`);
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
                remarks: form.remarks.trim() || 'Instant payout transfer',
                saveBeneficiary: !selectedBeneficiaryId && saveToBeneficiaries
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
                setSelectedBeneficiaryId(null);
                setSaveToBeneficiaries(false);
                setVerificationResult(null);

                // Refresh balance and beneficiaries
                fetchBalance();
                fetchBeneficiaries();
            } else {
                setSubmitError(res?.message || 'Payout transfer failed. Any debited amount has been auto-refunded to your wallet.');
                fetchBalance();
            }
        } catch (err) {
            setSubmitError(err?.message || 'Transfer request failed. Please check your transaction history.');
            fetchBalance();
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

    if (serviceDisabled) {
        return <DisabledServiceBanner serviceName="Payout Hub" />;
    }

    return (
        <div className="w-full min-h-[calc(100vh-80px)] bg-slate-50/70 p-2 sm:p-3 md:p-3.5 font-['Inter',sans-serif]">
            <div className="mx-auto max-w-6xl space-y-2.5 sm:space-y-3">

                {/* ─── Compact Terminal Header ───────────────────────────────── */}
                <div className="relative overflow-hidden rounded-xl md:rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3.5 shadow-2xs">
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                    
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between relative z-10">
                        {/* Terminal Branding */}
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xs">
                                <Zap size={18} className="animate-pulse" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-tight">
                                        Instant Payout Terminal
                                    </h1>
                                </div>
                                <p className="text-[10.5px] font-semibold text-slate-500">
                                    Rupiksha Services Private Limited • NPCI Verified Banking Transfer
                                </p>
                            </div>
                        </div>

                        {/* Middle & Right: Navigation Tabs & Wallet Balance */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                            
                            {/* View Switcher Tabs */}
                            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('transfer')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-wider transition ${
                                        activeTab === 'transfer'
                                            ? 'bg-white text-blue-700 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <SendIcon size={12} />
                                    <span>New Transfer</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setActiveTab('beneficiaries'); fetchBeneficiaries(); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-wider transition ${
                                        activeTab === 'beneficiaries'
                                            ? 'bg-white text-blue-700 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Users size={12} />
                                    <span>Beneficiaries</span>
                                    {beneficiaries.length > 0 && (
                                        <span className="rounded-full bg-blue-100 text-blue-800 px-1.5 py-0.2 text-[9px] font-black">
                                            {beneficiaries.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Wallet Balance Pill */}
                            <div className="flex items-center gap-2 bg-blue-50/90 border border-blue-200 text-slate-800 px-2.5 py-1 rounded-lg shadow-2xs shrink-0">
                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white shadow-2xs">
                                    <CreditCard size={13} />
                                </div>
                                <div className="text-left">
                                    <div className="text-[9px] font-black uppercase tracking-wider text-blue-700 leading-none">
                                        Main Wallet
                                    </div>
                                    <div className="text-xs sm:text-sm font-black font-mono leading-tight text-slate-900 mt-0.5">
                                        ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={fetchBalance} 
                                    disabled={balanceLoading}
                                    title="Refresh Balance"
                                    className="p-0.5 text-slate-400 hover:text-blue-700 rounded transition"
                                >
                                    <RefreshCw size={11} className={balanceLoading ? 'animate-spin text-blue-600' : ''} />
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

                {/* ─── Tab 1: Terminal Form & 4-State Approval Gating ──────── */}
                
                {/* 1. Loading State */}
                {activeTab === 'transfer' && beneficiariesLoading && beneficiaries.length === 0 && (
                    <div className="py-12 text-center text-xs font-bold text-slate-500 flex flex-col items-center justify-center gap-2.5 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
                        <RefreshCw size={24} className="animate-spin text-blue-600" />
                        <div className="text-sm font-black text-slate-800">Checking Beneficiary Approval Status...</div>
                        <p className="text-xs text-slate-400">Verifying authorized bank accounts with Admin & NPCI gateway</p>
                    </div>
                )}

                {/* 2. Pending Approval State */}
                {activeTab === 'transfer' && !beneficiariesLoading && !hasApproved && hasPendingOnly && (
                    <div className="bg-white border border-amber-200/90 rounded-2xl md:rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5 max-w-2xl mx-auto text-center">
                        <div className="mx-auto h-11 w-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
                            <Clock size={22} className="animate-pulse" />
                        </div>
                        
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10.5px] font-black uppercase tracking-wider">
                                <Clock size={11} /> Approval Pending
                            </div>
                            <h2 className="text-base sm:text-lg font-black text-slate-900">
                                Beneficiary Approval Pending with Admin
                            </h2>
                            <p className="text-xs font-semibold text-slate-500 max-w-md mx-auto">
                                The <strong>Instant Payout Terminal</strong> will automatically unlock once Admin approves your bank beneficiary.
                            </p>
                        </div>

                        {/* Submitted Details Card */}
                        <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-left max-w-lg mx-auto space-y-2">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Submitted Bank Account</div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black">
                                    <Clock size={10} /> Under Review
                                </span>
                            </div>
                            {pendingBeneficiaries.map((bene) => (
                                <div key={bene.id} className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <div className="text-[9.5px] text-slate-400 font-bold uppercase">Beneficiary Name</div>
                                        <div className="font-black text-slate-900 text-xs mt-0.5">{bene.beneficiaryName}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9.5px] text-slate-400 font-bold uppercase">Bank Name</div>
                                        <div className="font-bold text-slate-800 text-xs mt-0.5">{bene.bankName || 'Bank Transfer'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9.5px] text-slate-400 font-bold uppercase">Account Number</div>
                                        <div className="font-mono font-black text-slate-900 text-xs mt-0.5">{bene.accountNumber}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9.5px] text-slate-400 font-bold uppercase">IFSC Code</div>
                                        <div className="font-mono font-black text-slate-900 text-xs mt-0.5">{bene.ifsc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-center gap-2.5 flex-wrap pt-1">
                            <button
                                type="button"
                                onClick={fetchBeneficiaries}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider transition shadow-2xs cursor-pointer"
                            >
                                <RefreshCw size={12} />
                                Refresh Approval Status
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAddBeneModal(true)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-wider transition cursor-pointer"
                            >
                                <Plus size={12} />
                                Add Another Account
                            </button>
                        </div>
                    </div>
                )}

                {/* 3. Rejected by Admin State */}
                {activeTab === 'transfer' && !beneficiariesLoading && !hasApproved && hasRejectedOnly && (
                    <div className="bg-white border border-rose-200/90 rounded-2xl md:rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5 max-w-2xl mx-auto text-center">
                        <div className="mx-auto h-11 w-11 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-2xs">
                            <XCircle size={24} />
                        </div>
                        
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10.5px] font-black uppercase tracking-wider">
                                <AlertTriangle size={11} /> Request Rejected
                            </div>
                            <h2 className="text-base sm:text-lg font-black text-slate-900">
                                Beneficiary Request Rejected by Admin
                            </h2>
                            <p className="text-xs font-semibold text-slate-500 max-w-md mx-auto">
                                Your payout beneficiary request was rejected. Please review the reason below and submit a new request.
                            </p>
                        </div>

                        {/* Rejection Alert Box */}
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-left max-w-lg mx-auto space-y-1.5">
                            <div className="text-[10px] font-black uppercase tracking-wider text-rose-600">Admin Rejection Reason</div>
                            <div className="text-xs font-black text-rose-950 bg-white/90 border border-rose-200/70 p-2.5 rounded-lg">
                                "{rejectedBeneficiaries[0]?.rejectionReason || 'Bank account details could not be verified with bank records.'}"
                            </div>
                            <div className="text-[10.5px] font-bold text-rose-700 pt-0.5">
                                Rejected Account: <span className="font-mono font-black">{rejectedBeneficiaries[0]?.accountNumber}</span> ({rejectedBeneficiaries[0]?.ifsc})
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-2.5 flex-wrap pt-1">
                            <button
                                type="button"
                                onClick={() => setShowAddBeneModal(true)}
                                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider transition shadow-2xs cursor-pointer"
                            >
                                <Plus size={12} />
                                Submit New Beneficiary Request
                            </button>
                        </div>
                    </div>
                )}

                {/* 4. No Beneficiary Registered State (2-Part Responsive Wide Layout) */}
                {activeTab === 'transfer' && !beneficiariesLoading && !hasApproved && hasNone && (
                    <div className="bg-white border-2 border-slate-200/90 rounded-2xl md:rounded-3xl p-5 sm:p-7 md:p-8 shadow-sm w-full max-w-6xl mx-auto space-y-6">
                        {/* Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                            <div className="flex items-center gap-3.5">
                                <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-500/25">
                                    <Building2 size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight leading-tight">
                                        Register Bank Beneficiary for Payouts
                                    </h2>
                                    <p className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5">
                                        Enter and verify your bank account details below to submit for instant Admin approval.
                                    </p>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-black self-start sm:self-auto">
                                <ShieldCheck size={14} className="text-blue-600" /> NPCI Bank Verified
                            </span>
                        </div>

                        <form onSubmit={handleSaveNewBeneficiary} className="space-y-6">
                            {newBeneForm.submitError && (
                                <div className="flex items-center gap-2.5 rounded-xl border-2 border-rose-200 bg-rose-50 p-3.5 text-xs sm:text-sm font-black text-rose-900">
                                    <AlertTriangle size={18} className="shrink-0 text-rose-600" />
                                    <span>{newBeneForm.submitError}</span>
                                </div>
                            )}

                            {/* 2-Part Responsive Split: Left Side & Right Side */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
                                
                                {/* ═══ LEFT SIDE: Account Number, Confirm Account Number, Beneficiary Legal Name ═══ */}
                                <div className="space-y-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-6">
                                    <div className="text-xs font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5 pb-1 border-b border-slate-200/60">
                                        <span>1. Account & Beneficiary Identity</span>
                                    </div>

                                    {/* Account Number */}
                                    <div>
                                        <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 mb-1.5">
                                            Account Number *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm sm:text-base font-black text-slate-950 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 font-mono transition shadow-2xs"
                                            placeholder="Enter bank account number"
                                            value={newBeneForm.accountNumber}
                                            onChange={(e) => setNewBeneForm(p => ({ ...p, accountNumber: e.target.value.replace(/\D/g, '') }))}
                                            maxLength={18}
                                        />
                                    </div>

                                    {/* Confirm Account Number */}
                                    <div>
                                        <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 mb-1.5">
                                            Confirm Account Number *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm sm:text-base font-black text-slate-950 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 font-mono transition shadow-2xs"
                                            placeholder="Re-enter bank account number"
                                            value={newBeneForm.confirmAccountNumber}
                                            onChange={(e) => setNewBeneForm(p => ({ ...p, confirmAccountNumber: e.target.value.replace(/\D/g, '') }))}
                                            maxLength={18}
                                        />
                                    </div>

                                    {/* Beneficiary Legal Name */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                                            <label className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950">
                                                Beneficiary Legal Name *
                                            </label>
                                            {newBeneForm.isVerified && (
                                                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                                    <CheckCircle2 size={13} className="text-emerald-600" /> Bank Verified Name
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm sm:text-base font-black text-slate-950 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition shadow-2xs"
                                            placeholder="Legal account holder name"
                                            value={newBeneForm.beneficiaryName}
                                            onChange={(e) => setNewBeneForm(p => ({ ...p, beneficiaryName: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {/* ═══ RIGHT SIDE: IFSC Code + Verify Button, Bank Name, Nickname, Submit Button ═══ */}
                                <div className="space-y-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-6">
                                    <div className="text-xs font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5 pb-1 border-b border-slate-200/60">
                                        <span>2. Bank IFSC & Verification</span>
                                    </div>

                                    {/* IFSC Code + Verify Legal Name Button */}
                                    <div>
                                        <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 mb-1.5">
                                            IFSC Code *
                                        </label>
                                        <div className="flex flex-col sm:flex-row gap-2.5">
                                            <input
                                                type="text"
                                                required
                                                className="flex-1 rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm sm:text-base font-black uppercase text-slate-950 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 font-mono transition shadow-2xs"
                                                placeholder="e.g. SBIN0001234"
                                                value={newBeneForm.ifsc}
                                                onChange={(e) => setNewBeneForm(p => ({ ...p, ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                                                maxLength={11}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleVerifyNewBeneInModal}
                                                disabled={newBeneForm.verifying || !/^\d{9,18}$/.test(newBeneForm.accountNumber) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(newBeneForm.ifsc)}
                                                className="inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 px-5 py-3 rounded-xl transition cursor-pointer shadow-md shadow-emerald-600/20 shrink-0"
                                            >
                                                {newBeneForm.verifying ? (
                                                    <>
                                                        <RefreshCw size={15} className="animate-spin" />
                                                        Verifying...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles size={15} />
                                                        Verify Legal Name
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Bank Name (Optional) */}
                                    <div>
                                        <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 mb-1.5">
                                            Bank Name (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm sm:text-base font-black text-slate-950 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition shadow-2xs"
                                            placeholder="e.g. State Bank of India"
                                            value={newBeneForm.bankName}
                                            onChange={(e) => setNewBeneForm(p => ({ ...p, bankName: e.target.value }))}
                                        />
                                    </div>

                                    {/* Nickname (Optional) */}
                                    <div>
                                        <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 mb-1.5">
                                            Nickname (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm sm:text-base font-black text-slate-950 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition shadow-2xs"
                                            placeholder="e.g. Primary Shop Account"
                                            value={newBeneForm.nickName}
                                            onChange={(e) => setNewBeneForm(p => ({ ...p, nickName: e.target.value }))}
                                            maxLength={50}
                                        />
                                    </div>

                                    {newBeneForm.verifyError && (
                                        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-black text-rose-800">
                                            <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                                            <span>{newBeneForm.verifyError}</span>
                                        </div>
                                    )}

                                    {/* Big Bold Submit for Admin Approval Button */}
                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={newBeneForm.isSubmitting}
                                            className="w-full inline-flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-sm sm:text-base font-black uppercase tracking-wider text-white transition shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50"
                                        >
                                            {newBeneForm.isSubmitting ? (
                                                <>
                                                    <RefreshCw size={18} className="animate-spin" />
                                                    Submitting to Admin...
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldCheck size={18} />
                                                    Submit for Admin Approval
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </form>
                    </div>
                )}

                {/* 5. Approved State: Full Terminal Unlocked */}
                {/* 5. Approved State: Full Terminal Unlocked (Clean No-Scroll Layout) */}
                {activeTab === 'transfer' && !beneficiariesLoading && hasApproved && (
                    <form onSubmit={handlePayoutSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        
                        {/* ══ LEFT (COL 1 to 7): Quick Beneficiary Selection & Transfer Amount ════════ */}
                        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl md:rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
                            
                            {/* ── Quick Beneficiary Selector ── */}
                            <div className="p-3 sm:p-3.5 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 border border-blue-100 rounded-2xl space-y-2.5">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <Users size={15} className="text-blue-600" />
                                        <span className="text-xs sm:text-[12.5px] font-black uppercase tracking-wide text-slate-800">
                                            Approved Beneficiaries
                                        </span>
                                        <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-black">
                                            {approvedBeneficiaries.length} Approved
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowAddBeneModal(true)}
                                        className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer"
                                    >
                                        <Plus size={12} />
                                        Add Beneficiary
                                    </button>
                                </div>

                                {/* Horizontal quick selector chips */}
                                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                                    {approvedBeneficiaries.slice(0, 10).map((bene) => {
                                        const isSelected = selectedBeneficiaryId === bene.id;
                                        return (
                                            <button
                                                key={bene.id}
                                                type="button"
                                                onClick={() => handleSelectBeneficiary(bene)}
                                                className={`shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300'
                                                        : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                                                }`}
                                            >
                                                <div className={`h-7 w-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                                    isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {bene.beneficiaryName ? bene.beneficiaryName.charAt(0).toUpperCase() : <Landmark size={13} />}
                                                </div>
                                                <div className="min-w-0 pr-1">
                                                    <div className="text-xs font-black truncate max-w-[140px] leading-tight">
                                                        {bene.nickName || bene.beneficiaryName}
                                                    </div>
                                                    <div className={`text-[10px] font-mono font-bold leading-tight ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                                        ••••{bene.accountNumber ? bene.accountNumber.slice(-4) : ''}
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <CheckCircle2 size={14} className="text-white shrink-0 ml-1" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Payment Rail & Amount Control ── */}
                            <div className="space-y-3.5 p-3.5 sm:p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl">
                                
                                {/* Rail Selector */}
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                                        Payment Rail *
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { mode: 'IMPS', title: 'IMPS', desc: 'Instant (< 5s)' },
                                            { mode: 'NEFT', title: 'NEFT', desc: 'Batch (30m)' },
                                            { mode: 'RTGS', title: 'RTGS', desc: 'High Value (₹2L+)' }
                                        ].map(item => (
                                            <button
                                                key={item.mode}
                                                type="button"
                                                onClick={() => setForm(p => ({ ...p, transferMode: item.mode }))}
                                                className={`rounded-xl border py-2 px-2 text-center transition cursor-pointer ${
                                                    form.transferMode === item.mode
                                                        ? 'border-blue-600 bg-blue-600 text-white font-black shadow-xs'
                                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className="text-xs font-black leading-tight">{item.title}</div>
                                                <div className={`text-[9.5px] font-bold leading-tight ${form.transferMode === item.mode ? 'text-blue-100' : 'text-slate-400'}`}>
                                                    {item.desc}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Amount Input & Quick Chips */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                            Transfer Amount (₹) *
                                        </label>
                                        <span className={`text-[11px] font-bold ${isAmountWithinBalance || !form.amount ? 'text-slate-500' : 'text-rose-600 font-black'}`}>
                                            Wallet Balance: <strong className="font-mono text-slate-900">₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">₹</span>
                                        <input
                                            type="text"
                                            required
                                            className={`w-full rounded-xl border pl-9 pr-3.5 py-2.5 text-lg font-black text-slate-950 placeholder:text-slate-400 outline-none font-mono transition ${
                                                isAmountBelowMin || (form.amount && !isAmountWithinBalance)
                                                    ? 'border-rose-300 bg-rose-50/50 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                                                    : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                            }`}
                                            placeholder="Min ₹500.00"
                                            value={form.amount}
                                            onChange={(e) => setForm(p => ({ ...p, amount: e.target.value.replace(/[^\d.]/g, '') }))}
                                        />
                                    </div>

                                    {/* Below Minimum Amount Warning */}
                                    {isAmountBelowMin && (
                                        <p className="text-[11px] font-bold text-rose-600 mt-1.5 flex items-center gap-1 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                                            <AlertTriangle size={13} className="shrink-0 text-rose-600" />
                                            Minimum payout transfer amount is ₹500.00
                                        </p>
                                    )}

                                    {/* Quick Amount Chips */}
                                    <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5">
                                        {[500, 1000, 2000, 5000, 10000].map((amt) => (
                                            <button
                                                key={amt}
                                                type="button"
                                                onClick={() => setForm(p => ({ ...p, amount: amt.toString() }))}
                                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-black font-mono transition cursor-pointer shadow-2xs ${
                                                    form.amount === amt.toString()
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-700 border-slate-200'
                                                }`}
                                            >
                                                ₹{amt.toLocaleString('en-IN')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                            </div>

                        </div>

                        {/* ══ RIGHT (COL 8 to 12): Live Telemetry, Full Beneficiary Details & Transfer CTA ══ */}
                        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl md:rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
                            
                            {/* Live Transaction Preview */}
                            <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/50 p-4 border border-blue-100/90 shadow-2xs space-y-2.5">
                                <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <Activity size={13} className="text-blue-600" />
                                        Live Transfer Summary
                                    </span>
                                </div>

                                <div className="flex items-baseline justify-between py-1">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                        Amount
                                    </span>
                                    <div className="text-xl sm:text-2xl font-black font-mono text-blue-700 tracking-tight">
                                        ₹ {Number(form.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>

                                <div className="space-y-1.5 py-1.5 border-t border-blue-100/60 pt-2">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                            Base Charges
                                        </span>
                                        <span className="text-xs sm:text-sm font-bold font-mono text-slate-700">
                                            ₹ {payoutChargeInfo.baseCharge.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                            GST ({payoutChargeInfo.gstRate || 18}%)
                                        </span>
                                        <span className="text-xs sm:text-sm font-bold font-mono text-slate-700">
                                            + ₹ {payoutChargeInfo.gstAmount.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline justify-between pt-1 border-t border-blue-100/50">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                                            Total Payout Charges
                                        </span>
                                        <span className="text-xs sm:text-sm font-black font-mono text-slate-900">
                                            ₹ {payoutChargeInfo.totalCharge.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-baseline justify-between py-1.5 border-t border-blue-200/80 pt-2 bg-blue-100/40 -mx-4 px-4 rounded-xl">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                                        Total Deducted
                                    </span>
                                    <div className="text-base sm:text-lg font-black font-mono text-indigo-900 tracking-tight">
                                        ₹ {payoutChargeInfo.totalDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>

                                <div className="space-y-2 text-xs border-t border-blue-100/80 pt-2.5">
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span className="text-slate-500 text-[11px] font-semibold">Beneficiary:</span>
                                        <span className="font-black text-slate-950 text-sm truncate max-w-[210px]">
                                            {form.beneficiaryName || '—'}
                                        </span>
                                    </div>
                                    {form.bankName && (
                                        <div className="flex justify-between items-center text-slate-600">
                                            <span className="text-slate-500 text-[11px] font-semibold">Bank:</span>
                                            <span className="font-bold text-slate-800 truncate max-w-[210px]">
                                                {form.bankName}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span className="text-slate-500 text-[11px] font-semibold">Account:</span>
                                        <span className="font-mono font-black text-slate-950 text-xs tracking-wider">
                                            {form.accountNumber || '—'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span className="text-slate-500 text-[11px] font-semibold">IFSC:</span>
                                        <span className="font-mono font-bold uppercase text-slate-900">
                                            {form.ifsc || '—'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span className="text-slate-500 text-[11px] font-semibold">Est. Settlement:</span>
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
                                    placeholder="e.g. Vendor payout, salary, or settlement"
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
                            </div>

                        </div>

                    </form>
                )}

                {/* ─── Tab 2: Saved Beneficiaries Management ──────────────────────────── */}
                {activeTab === 'beneficiaries' && (
                    <div className="rounded-2xl md:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm sm:text-base font-black text-slate-900">Saved Bank Beneficiaries</h2>
                                    <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-black">
                                        {beneficiaries.length}
                                    </span>
                                </div>
                                <p className="text-[11px] font-semibold text-slate-500">
                                    Manage accounts for instant 1-click payouts without re-entering bank details
                                </p>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Search Bar */}
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search name, account, IFSC..."
                                        value={beneficiarySearch}
                                        onChange={(e) => setBeneficiarySearch(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-blue-500 transition w-44 sm:w-56"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowAddBeneModal(true)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-blue-700 transition shadow-xs cursor-pointer"
                                >
                                    <Plus size={13} />
                                    Add Beneficiary
                                </button>
                            </div>
                        </div>

                        {beneficiariesLoading && beneficiaries.length === 0 ? (
                            <div className="py-12 text-center text-xs font-bold text-slate-400 flex flex-col items-center justify-center gap-2">
                                <RefreshCw size={20} className="animate-spin text-blue-600" />
                                <span>Loading saved beneficiaries...</span>
                            </div>
                        ) : filteredBeneficiaries.length === 0 ? (
                            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-3">
                                <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                                    <Users size={26} />
                                </div>
                                {beneficiarySearch ? (
                                    <>
                                        <div className="font-black text-slate-900 text-sm">No beneficiaries match "{beneficiarySearch}"</div>
                                        <button
                                            type="button"
                                            onClick={() => setBeneficiarySearch('')}
                                            className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                                        >
                                            Clear Search Filter
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="font-black text-slate-900 text-sm">No Saved Beneficiaries Yet</div>
                                        <p className="text-slate-500 max-w-sm text-center text-xs font-semibold">
                                            Add bank accounts of your frequent recipients to send payouts in seconds with 1-click auto-fill.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddBeneModal(true)}
                                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700 transition shadow-sm cursor-pointer"
                                        >
                                            <Plus size={14} />
                                            Add Your First Beneficiary
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                {filteredBeneficiaries.map((bene) => {
                                    const isApproved = bene.status === 'APPROVED';
                                    const isPending = bene.status === 'PENDING';
                                    const isRejected = bene.status === 'REJECTED';

                                    return (
                                        <div
                                            key={bene.id}
                                            className={`rounded-2xl border bg-white p-4 transition flex flex-col justify-between space-y-3 group ${
                                                isApproved ? 'border-slate-200 hover:border-blue-300 hover:shadow-xs' :
                                                isPending ? 'border-amber-200 bg-amber-50/20' :
                                                'border-rose-200 bg-rose-50/20'
                                            }`}
                                        >
                                            <div className="space-y-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-base font-black shrink-0 ${
                                                            isApproved ? 'bg-blue-50 border border-blue-100 text-blue-700' :
                                                            isPending ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                                                            'bg-rose-50 border border-rose-200 text-rose-700'
                                                        }`}>
                                                            {bene.beneficiaryName ? bene.beneficiaryName.charAt(0).toUpperCase() : <Landmark size={18} />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-black text-slate-900 truncate">
                                                                {bene.beneficiaryName}
                                                            </div>
                                                            {bene.nickName && (
                                                                <div className="text-[10.5px] font-bold text-blue-600 truncate">
                                                                    ★ {bene.nickName}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        {isApproved && (
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9.5px] font-black text-emerald-700">
                                                                <CheckCircle2 size={11} /> Approved
                                                            </span>
                                                        )}
                                                        {isPending && (
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9.5px] font-black text-amber-700">
                                                                <Clock size={11} /> Pending Approval
                                                            </span>
                                                        )}
                                                        {isRejected && (
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[9.5px] font-black text-rose-700">
                                                                <XCircle size={11} /> Rejected
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDeleteBeneficiary(bene.id, e)}
                                                            disabled={deletingBeneId === bene.id}
                                                            title="Delete Beneficiary"
                                                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Rejection Note if Rejected */}
                                                {isRejected && bene.rejectionReason && (
                                                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-[10.5px] font-bold text-rose-800">
                                                        <strong>Rejection Note:</strong> {bene.rejectionReason}
                                                    </div>
                                                )}

                                                {/* Bank & Account Details */}
                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 space-y-1 text-xs">
                                                    <div className="flex justify-between items-center text-slate-600">
                                                        <span className="text-[10.5px] text-slate-400 font-bold uppercase">Bank</span>
                                                        <span className="font-bold text-slate-800 truncate max-w-[170px]">{bene.bankName || 'Bank Transfer'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-slate-600">
                                                        <span className="text-[10.5px] text-slate-400 font-bold uppercase">Account</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono font-black text-slate-900">{bene.accountNumber}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCopy(bene.accountNumber, `acc_${bene.id}`)}
                                                                title="Copy Account Number"
                                                                className="text-slate-400 hover:text-blue-700 transition"
                                                            >
                                                                {copiedField === `acc_${bene.id}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center text-slate-600">
                                                        <span className="text-[10.5px] text-slate-400 font-bold uppercase">IFSC</span>
                                                        <span className="font-mono font-bold uppercase text-slate-900">{bene.ifsc}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Send Payout CTA Button or Status Indicator */}
                                            {isApproved ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectBeneficiary(bene)}
                                                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-2xs cursor-pointer active:scale-[0.98]"
                                                >
                                                    <SendIcon size={12} />
                                                    <span>Send Payout</span>
                                                </button>
                                            ) : isPending ? (
                                                <div className="w-full py-2 px-3 bg-amber-100 text-amber-800 rounded-xl text-xs font-bold text-center">
                                                    ⏳ Awaiting Admin Approval
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAddBeneModal(true)}
                                                    className="w-full py-2 px-3 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl text-xs font-bold text-center transition cursor-pointer"
                                                >
                                                    Resubmit Request
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
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

            {/* ─── Add New Beneficiary Modal ────────────────────────────────────── */}
            <AnimatePresence>
                {showAddBeneModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm font-sans overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative bg-white border border-slate-300 shadow-2xl rounded-3xl w-full max-w-lg overflow-hidden flex flex-col my-auto"
                        >
                            {/* Header */}
                            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                                        <UserPlus size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 leading-tight">Add Bank Beneficiary</h3>
                                        <p className="text-[10.5px] font-semibold text-slate-500">Save recipient account for instant 1-click payouts</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAddBeneModal(false)}
                                    className="p-1.5 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-200 transition cursor-pointer"
                                >
                                    <XCircle size={18} />
                                </button>
                            </div>

                            {/* Form Body */}
                            <form onSubmit={handleSaveNewBeneficiary} className="p-5 space-y-3.5">
                                {newBeneForm.submitError && (
                                    <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-700">
                                        <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                                        <span>{newBeneForm.submitError}</span>
                                    </div>
                                )}

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
                                            placeholder="Enter account number"
                                            value={newBeneForm.accountNumber}
                                            onChange={(e) => setNewBeneForm(p => ({ ...p, accountNumber: e.target.value.replace(/\D/g, '') }))}
                                            maxLength={18}
                                        />
                                    </div>

                                    {/* Confirm Account Number */}
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                            Confirm Account Number *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono transition"
                                            placeholder="Re-enter account number"
                                            value={newBeneForm.confirmAccountNumber}
                                            onChange={(e) => setNewBeneForm(p => ({ ...p, confirmAccountNumber: e.target.value.replace(/\D/g, '') }))}
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
                                            value={newBeneForm.ifsc}
                                            onChange={(e) => setNewBeneForm(p => ({ ...p, ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                                            maxLength={11}
                                        />
                                    </div>

                                    {/* Bank Verification Trigger */}
                                    <div className="flex flex-col justify-end">
                                        <button
                                            type="button"
                                            onClick={handleVerifyNewBeneInModal}
                                            disabled={newBeneForm.verifying || !/^\d{9,18}$/.test(newBeneForm.accountNumber) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(newBeneForm.ifsc)}
                                            className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 py-2.5 px-3 rounded-xl transition cursor-pointer shadow-xs"
                                        >
                                            {newBeneForm.verifying ? (
                                                <>
                                                    <RefreshCw size={13} className="animate-spin" />
                                                    Verifying Bank...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={13} />
                                                    Verify Name
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Beneficiary Legal Name */}
                                    <div className="sm:col-span-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                                Beneficiary Legal Name *
                                            </label>
                                            {newBeneForm.isVerified && (
                                                <span className="text-[10.5px] font-black text-emerald-600 flex items-center gap-1">
                                                    <CheckCircle2 size={12} /> Verified from Bank
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                                            placeholder="Legal account holder name"
                                            value={newBeneForm.beneficiaryName}
                                            onChange={(e) => setNewBeneForm(p => ({ ...p, beneficiaryName: e.target.value }))}
                                        />
                                    </div>

                                    {/* Bank Name */}
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                            Bank Name (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                                            placeholder="e.g. State Bank of India"
                                            value={newBeneForm.bankName}
                                            onChange={(e) => setNewBeneForm(p => ({ ...p, bankName: e.target.value }))}
                                        />
                                    </div>

                                    {/* Nickname */}
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                            Nickname (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                                            placeholder="e.g. Main Vendor / Self"
                                            value={newBeneForm.nickName}
                                            onChange={(e) => setNewBeneForm(p => ({ ...p, nickName: e.target.value }))}
                                            maxLength={50}
                                        />
                                    </div>
                                </div>

                                {newBeneForm.verifyError && (
                                    <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs font-bold text-rose-700">
                                        <AlertTriangle size={13} className="shrink-0 text-rose-600" />
                                        <span>{newBeneForm.verifyError}</span>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddBeneModal(false)}
                                        className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={newBeneForm.isSubmitting}
                                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-black text-white uppercase tracking-wider transition shadow-sm cursor-pointer disabled:opacity-50"
                                    >
                                        {newBeneForm.isSubmitting ? (
                                            <>
                                                <RefreshCw size={13} className="animate-spin" />
                                                Saving Beneficiary...
                                            </>
                                        ) : (
                                            <>
                                                <ShieldCheck size={14} />
                                                Save Beneficiary
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
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

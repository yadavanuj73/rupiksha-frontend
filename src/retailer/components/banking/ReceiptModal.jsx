import React from 'react';
import { X, Printer, Download, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Landmark, FileText, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReceiptModal({ isOpen, onClose, txnData }) {
    if (!isOpen || !txnData) return null;

    const {
        status = 'FAILED',
        message = 'Transaction failed',
        txnId = 'N/A',
        fpTxnId = 'N/A',
        bankRRN = 'N/A',
        transactionAmount = 0,
        balanceAmount = 0,
        maskedAadhaar = 'XXXX-XXXX-XXXX',
        mobile = 'N/A',
        bankName = 'N/A',
        timestamp = new Date().toLocaleString('en-IN'),
        agentId = 'N/A',
        miniStatement = []
    } = txnData;

    const statusUpper = (status || 'FAILED').toUpperCase();
    const isSuccess = statusUpper === 'SUCCESS';
    const isPending = statusUpper === 'PENDING';
    const isBalanceInquiry = txnData.serviceType === 'BALANCE_INQUIRY' || (txnData.serviceLabel && txnData.serviceLabel.toLowerCase().includes('balance'));
    const isMiniStatement = txnData.serviceType === 'MINI_STATEMENT' || (txnData.serviceLabel && txnData.serviceLabel.toLowerCase().includes('statement'));
    const serviceTitle = txnData.serviceLabel || txnData.serviceType || 'AEPS Banking';

    const handlePrint = () => {
        const logoUrl = window.location.origin + '/rupiksha logo.jpeg';
        
        let miniStatementHtml = '';
        if (isMiniStatement && miniStatement && miniStatement.length > 0) {
            const rows = miniStatement.map((entry, idx) => {
                const isCr = (entry.txnType || '').toLowerCase().startsWith('c');
                return `
                    <tr>
                        <td style="text-align: center; font-weight: 800; color: #000000;">${idx + 1}</td>
                        <td style="font-weight: 800; color: #000000;">${entry.date || 'N/A'}</td>
                        <td style="text-align: center;">
                            <span class="${isCr ? 'badge-cr' : 'badge-dr'}">${isCr ? 'CR (Deposit)' : 'DR (Withdraw)'}</span>
                        </td>
                        <td style="text-align: right; font-weight: 900; color: ${isCr ? '#14532d' : '#000000'}; font-size: 11px;">
                            ₹${parseFloat(entry.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style="color: #000000; font-weight: 700; font-size: 11px;">${entry.narration || 'N/A'}</td>
                    </tr>
                `;
            }).join('');

            miniStatementHtml = `
                <div class="section-title">Mini Statement (Recent Transactions)</div>
                <table class="statement-table">
                    <thead>
                        <tr>
                            <th style="width: 55px; text-align: center;">SL.NO</th>
                            <th style="width: 95px;">DATE</th>
                            <th style="width: 110px; text-align: center;">TXN TYPE</th>
                            <th style="width: 105px; text-align: right;">AMOUNT</th>
                            <th>NARRATION / DETAILS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `;
        }

        const formattedBalance = parseFloat(balanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const formattedAmount = parseFloat(transactionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

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
                <title>Rupiksha Receipt - ${txnId}</title>
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
                        max-width: 650px;
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
                    .brand-name span {
                        color: #1d4ed8;
                    }
                    .brand-sub {
                        font-size: 11px;
                        font-weight: 800;
                        color: #000000;
                        text-transform: uppercase;
                        letter-spacing: 0.8px;
                        margin-top: 3px;
                    }
                    .header-right {
                        text-align: right;
                    }
                    .receipt-badge {
                        display: inline-block;
                        background: #fef2f2;
                        color: #dc2626;
                        border: 2px solid #dc2626;
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
                    .status-failed {
                        background: #fef2f2;
                        border: 2px solid #dc2626;
                        color: #7f1d1d;
                    }
                    .status-pending {
                        background: #fffbeb;
                        border: 2px solid #d97706;
                        color: #78350f;
                    }
                    .status-title {
                        font-size: 14px;
                        font-weight: 900;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .status-desc {
                        font-size: 11.5px;
                        font-weight: 700;
                    }
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
                        color: #000000;
                    }
                    .amount-success {
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
                    .details-grid tr:nth-child(even) {
                        background: #f1f5f9;
                    }
                    .label-cell {
                        color: #000000;
                        font-weight: 900;
                        width: 35%;
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
                    .statement-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 8px;
                        margin-bottom: 16px;
                        font-size: 11px;
                    }
                    .statement-table th {
                        background: #fef2f2;
                        color: #dc2626;
                        font-weight: 900;
                        text-transform: uppercase;
                        font-size: 10.5px;
                        letter-spacing: 0.5px;
                        padding: 8px 10px;
                        border: 1.5px solid #dc2626;
                        text-align: left;
                    }
                    .statement-table td {
                        padding: 7px 10px;
                        border: 1px solid #cbd5e1;
                        font-size: 11px;
                    }
                    .statement-table tr:nth-child(even) td {
                        background: #f8fafc;
                    }
                    .badge-cr {
                        background: #dcfce7;
                        color: #14532d;
                        border: 1.5px solid #16a34a;
                        padding: 3px 7px;
                        border-radius: 4px;
                        font-size: 10px;
                        font-weight: 900;
                        display: inline-block;
                    }
                    .badge-dr {
                        background: #fee2e2;
                        color: #7f1d1d;
                        border: 1.5px solid #dc2626;
                        padding: 3px 7px;
                        border-radius: 4px;
                        font-size: 10px;
                        font-weight: 900;
                        display: inline-block;
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
                    <!-- Brand Header -->
                    <div class="header">
                        <div class="header-left">
                            <img src="${logoUrl}" alt="Rupiksha Logo" class="logo-img" onerror="this.style.display='none'" />
                            <div>
                                <div class="brand-name">Rupiksha Services <span>Private Limited</span></div>
                                <div class="brand-sub">AEPS Banking Correspondent Point</div>
                            </div>
                        </div>
                        <div class="header-right">
                            <div class="receipt-badge">OFFICIAL E-RECEIPT</div>
                            <div class="header-date">${timestamp}</div>
                        </div>
                    </div>

                    <!-- Status Banner -->
                    <div class="status-banner ${isSuccess ? 'status-success' : isPending ? 'status-pending' : 'status-failed'}">
                        <div>
                            <div class="status-title">
                                ${isSuccess ? (isBalanceInquiry ? 'Balance Enquiry Successful' : isMiniStatement ? 'Mini Statement Generated' : 'Transaction Successful') : isPending ? 'Transaction Pending' : 'Transaction Failed'}
                            </div>
                            <div class="status-desc">${message}</div>
                        </div>
                        <div style="font-size: 18px; font-weight: 900;">
                            ${isSuccess ? '✓ APPROVED' : isPending ? '⏳ PENDING' : '✕ FAILED'}
                        </div>
                    </div>

                    <!-- Primary Amount / Balance Highlight -->
                    <div class="amount-card">
                        <div class="amount-label">${isBalanceInquiry || isMiniStatement ? 'Available Account Balance' : 'Transaction Amount'}</div>
                        <div class="amount-value ${isSuccess ? 'amount-success' : ''}">
                            ₹ ${isBalanceInquiry || isMiniStatement ? formattedBalance : formattedAmount}
                        </div>
                    </div>

                    <!-- Transaction Details Table -->
                    <div class="section-title">Transaction Information</div>
                    <table class="details-grid">
                        <tr>
                            <td class="label-cell">Transaction Type</td>
                            <td class="value-cell" style="text-transform: uppercase;">${serviceTitle}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Bank Name</td>
                            <td class="value-cell">${bankName}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Customer Mobile</td>
                            <td class="value-cell">${mobile}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Aadhaar / VID</td>
                            <td class="value-cell mono-val">${maskedAadhaar}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Bank RRN</td>
                            <td class="value-cell mono-val">${bankRRN}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Merchant Txn ID</td>
                            <td class="value-cell mono-val">${txnId}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Gateway Ref ID</td>
                            <td class="value-cell mono-val">${fpTxnId}</td>
                        </tr>
                        <tr>
                            <td class="label-cell">Retailer / Terminal ID</td>
                            <td class="value-cell">${agentId}</td>
                        </tr>
                        ${!isBalanceInquiry && !isMiniStatement && isSuccess && balanceAmount > 0 ? `
                        <tr>
                            <td class="label-cell">Remaining Ledger Balance</td>
                            <td class="value-cell" style="color: #15803d; font-weight: 900;">₹ ${formattedBalance}</td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td class="label-cell">Date & Time</td>
                            <td class="value-cell">${timestamp}</td>
                        </tr>
                    </table>

                    <!-- Mini Statement Table (if available) -->
                    ${miniStatementHtml}

                    <!-- Legal SOP / System generated disclaimer -->
                    <div class="footer-note">
                        This is a computer-generated transaction acknowledgement receipt verified through biometric Aadhaar UIDAI authentication. No physical signature is required. Rupiksha Services Private Limited is an authorized Business Correspondent partner. For any support, email support@rupiksha.in.
                    </div>

                    <!-- Retailer & Customer Signature Rows -->
                    <div class="sign-row">
                        <div class="sign-box">Customer Signature</div>
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
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm font-['Inter',sans-serif] overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 10 }}
                    className="relative bg-white border border-slate-300 shadow-[0_25px_70px_rgba(0,0,0,0.3)] rounded-2xl md:rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
                >
                    {/* Top Bar with title & prominent Close (X) Cut Button */}
                    <div className="px-4 sm:px-6 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wide text-black">
                            <ShieldCheck size={17} className="text-emerald-600 shrink-0" />
                            <span>{isBalanceInquiry ? 'Account Balance Statement' : isMiniStatement ? 'Account Mini Statement' : 'Transaction E-Receipt'}</span>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            title="Close Receipt"
                            className="p-1.5 text-black hover:text-white bg-white hover:bg-slate-900 border border-slate-300 rounded-full transition-all cursor-pointer shadow-sm hover:scale-105"
                        >
                            <X size={17} strokeWidth={3} />
                        </button>
                    </div>

                    {/* Responsive 2-Part Split Layout Body */}
                    <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start">
                            
                            {/* ══ LEFT PART (COL 1 to 5): Branding, Status, Amount & Statement ══ */}
                            <div className="md:col-span-5 flex flex-col space-y-3.5">
                                {/* Branding Header */}
                                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-300 rounded-2xl shadow-2xs">
                                    <img
                                        src="/rupiksha logo.jpeg"
                                        alt="Rupiksha Logo"
                                        className="h-11 w-11 object-contain rounded-xl border border-slate-300 p-0.5 bg-white shrink-0 shadow-xs"
                                    />
                                    <div className="text-left">
                                        <h2 className="text-base sm:text-lg font-black tracking-tight text-black leading-none">
                                            Rupiksha Services <span className="text-blue-700">Private Limited</span>
                                        </h2>
                                        <p className="text-[10px] sm:text-[11px] font-black text-slate-800 uppercase tracking-wider mt-1">
                                            AEPS Banking Terminal
                                        </p>
                                    </div>
                                </div>

                                {/* Status Box */}
                                <div className="bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-center shadow-2xs">
                                    <div className="flex items-center justify-center mb-2">
                                        {isSuccess ? (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-950 border-2 border-emerald-400 rounded-full text-xs font-black uppercase tracking-wide">
                                                <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
                                                <span>
                                                    {isBalanceInquiry ? 'Balance Fetched' : isMiniStatement ? 'Statement Fetched' : 'Transaction Approved'}
                                                </span>
                                            </div>
                                        ) : isPending ? (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-950 border-2 border-amber-400 rounded-full text-xs font-black uppercase tracking-wide">
                                                <AlertTriangle size={15} className="text-amber-700 shrink-0" />
                                                <span>Transaction Pending</span>
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-950 border-2 border-rose-400 rounded-full text-xs font-black uppercase tracking-wide">
                                                <XCircle size={15} className="text-rose-700 shrink-0" />
                                                <span>Transaction Declined</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Prominent Amount / Balance Display */}
                                    <div className="py-1">
                                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                                            {isBalanceInquiry || isMiniStatement ? 'Available Account Balance' : 'Transaction Amount'}
                                        </p>
                                        <div className={`text-2xl sm:text-3xl font-black tracking-tight mt-0.5 ${isSuccess ? 'text-emerald-700' : 'text-black'}`}>
                                            ₹ {isBalanceInquiry || isMiniStatement ? balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : transactionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>

                                    {message && (
                                        <p className="text-[11px] font-bold text-slate-800 mt-1 leading-snug">
                                            {message}
                                        </p>
                                    )}
                                </div>

                                {/* Mini Statement (if available) */}
                                {isMiniStatement && isSuccess && miniStatement && miniStatement.length > 0 && (
                                    <div className="border border-slate-300 rounded-2xl p-3 bg-white shadow-xs">
                                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200">
                                            <span className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                                                <FileText size={14} className="text-blue-700" />
                                                Recent Statement ({miniStatement.length})
                                            </span>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="border-b border-red-200 text-[10px] font-black uppercase text-red-600 bg-red-50 sticky top-0">
                                                        <th className="py-1.5 px-1.5 text-center">SL.NO</th>
                                                        <th className="py-1.5 px-1.5">Date</th>
                                                        <th className="py-1.5 px-1 text-center">Type</th>
                                                        <th className="py-1.5 px-1 text-right">Amount</th>
                                                        <th className="py-1.5 px-2">Narration</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 font-bold text-black">
                                                    {miniStatement.map((entry, idx) => {
                                                        const isCr = (entry.txnType || '').toLowerCase().startsWith('c');
                                                        return (
                                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                <td className="py-1.5 px-1.5 text-[11px] text-center whitespace-nowrap text-black font-extrabold">
                                                                    {idx + 1}
                                                                </td>
                                                                <td className="py-1.5 px-1.5 text-[11px] whitespace-nowrap text-black font-extrabold">
                                                                    {entry.date}
                                                                </td>
                                                                <td className="py-1.5 px-1 text-center whitespace-nowrap">
                                                                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                                                        isCr ? 'bg-emerald-100 text-emerald-950 border border-emerald-300' : 'bg-rose-100 text-rose-950 border border-rose-300'
                                                                    }`}>
                                                                        {isCr ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                                                                        {isCr ? 'CR' : 'DR'}
                                                                    </span>
                                                                </td>
                                                                <td className={`py-1.5 px-1 text-right text-[11px] font-black whitespace-nowrap ${
                                                                    isCr ? 'text-emerald-700' : 'text-black'
                                                                }`}>
                                                                    ₹{entry.amount}
                                                                </td>
                                                                <td className="py-1.5 px-2 text-[10px] text-black truncate max-w-[120px] font-bold" title={entry.narration}>
                                                                    {entry.narration}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ══ RIGHT PART (COL 6 to 12): All Transaction Details in Crisp Dark Black ══ */}
                            <div className="md:col-span-7 flex flex-col space-y-3">
                                <div className="border border-slate-300 rounded-2xl p-3 sm:p-4 bg-slate-50/90 shadow-2xs">
                                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-300">
                                        <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                            <FileText size={15} className="text-blue-700" />
                                            Transaction Details
                                        </span>
                                        <span className="text-[10px] font-black uppercase tracking-wider bg-black text-white px-2 py-0.5 rounded-md">
                                            Verified
                                        </span>
                                    </div>

                                    {/* 2-Column Details Grid with Dark Black & Enlarged Text */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                Transaction Type
                                            </span>
                                            <span className="block text-xs sm:text-[13px] font-black text-black mt-0.5 truncate">
                                                {serviceTitle}
                                            </span>
                                        </div>

                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                Bank Name
                                            </span>
                                            <span className="block text-xs sm:text-[13px] font-black text-black mt-0.5 truncate flex items-center gap-1">
                                                <Landmark size={13} className="text-blue-700 shrink-0" />
                                                {bankName}
                                            </span>
                                        </div>

                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                Customer Mobile
                                            </span>
                                            <span className="block text-xs sm:text-[13px] font-black text-black mt-0.5">
                                                {mobile}
                                            </span>
                                        </div>

                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                Aadhaar / VID Number
                                            </span>
                                            <span className="block text-xs sm:text-[13px] font-mono font-black text-black mt-0.5">
                                                {maskedAadhaar}
                                            </span>
                                        </div>

                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                Bank RRN
                                            </span>
                                            <span className="block text-xs sm:text-[13px] font-mono font-black text-black mt-0.5 truncate select-all">
                                                {bankRRN}
                                            </span>
                                        </div>

                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                Merchant Txn ID
                                            </span>
                                            <span className="block text-xs sm:text-[13px] font-mono font-black text-black mt-0.5 truncate select-all">
                                                {txnId}
                                            </span>
                                        </div>

                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                Gateway Txn ID
                                            </span>
                                            <span className="block text-xs sm:text-[13px] font-mono font-black text-black mt-0.5 truncate select-all">
                                                {fpTxnId}
                                            </span>
                                        </div>

                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                Retailer Terminal ID
                                            </span>
                                            <span className="block text-xs sm:text-[13px] font-black text-black mt-0.5 uppercase">
                                                {agentId}
                                            </span>
                                        </div>

                                        {isSuccess && !isBalanceInquiry && !isMiniStatement && balanceAmount > 0 && (
                                            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-300 sm:col-span-2">
                                                <span className="block text-[10.5px] font-black text-emerald-950 uppercase tracking-wider">
                                                    Remaining Ledger Balance
                                                </span>
                                                <span className="block text-sm font-black text-emerald-800 mt-0.5">
                                                    ₹ {balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}

                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 sm:col-span-2">
                                            <span className="block text-[10.5px] font-black text-black uppercase tracking-wider">
                                                Transaction Date & Time
                                            </span>
                                            <span className="block text-xs sm:text-[13px] font-black text-black mt-0.5">
                                                {timestamp}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* SOP / Biometric Compliance Disclaimer */}
                                <div className="p-2.5 bg-slate-100 border border-slate-300 rounded-xl text-[10.5px] font-bold text-black text-center leading-snug">
                                    System generated e-receipt • Biometrically verified via UIDAI Aadhaar • Rupiksha Licensed BC
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Bottom Action buttons (Always visible) */}
                    <div className="px-4 sm:px-6 py-3 bg-slate-100 border-t border-slate-300 flex items-center justify-end gap-2.5 shrink-0">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="flex-1 sm:flex-initial py-2.5 px-5 bg-black hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02]"
                        >
                            <Printer size={15} />
                            <span>Print Receipt</span>
                        </button>
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="py-2.5 px-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-300 text-blue-900 rounded-xl font-black uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02]"
                        >
                            <Download size={15} />
                            <span>PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="py-2.5 px-4 bg-white hover:bg-slate-200 border-2 border-slate-300 text-black rounded-xl font-black uppercase tracking-wider text-xs transition-all cursor-pointer hover:scale-[1.02]"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

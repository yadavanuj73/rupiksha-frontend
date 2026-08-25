import React, { useRef } from 'react';
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
                        <td style="text-align: center; color: #64748b;">${idx + 1}</td>
                        <td style="font-weight: 600;">${entry.date || 'N/A'}</td>
                        <td style="text-align: center;">
                            <span class="${isCr ? 'badge-cr' : 'badge-dr'}">${isCr ? 'CR (Deposit)' : 'DR (Withdraw)'}</span>
                        </td>
                        <td style="text-align: right; font-weight: 700; color: ${isCr ? '#166534' : '#1e293b'};">
                            ₹${parseFloat(entry.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style="color: #475569; font-size: 11px;">${entry.narration || 'N/A'}</td>
                    </tr>
                `;
            }).join('');

            miniStatementHtml = `
                <div class="section-title">Mini Statement (Recent Transactions)</div>
                <table class="statement-table">
                    <thead>
                        <tr>
                            <th style="width: 30px; text-align: center;">#</th>
                            <th style="width: 90px;">Date</th>
                            <th style="width: 110px; text-align: center;">Txn Type</th>
                            <th style="width: 100px; text-align: right;">Amount</th>
                            <th>Narration / Details</th>
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

        const printWindow = window.open('', '_blank', 'width=800,height=900');
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
                        color: #1e293b;
                        padding: 24px;
                        font-size: 12px;
                        line-height: 1.4;
                    }
                    .receipt-container {
                        max-width: 620px;
                        margin: 0 auto;
                        background: #ffffff;
                        border: 1px solid #cbd5e1;
                        border-radius: 12px;
                        padding: 24px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    }
                    .header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding-bottom: 16px;
                        border-bottom: 2px dashed #cbd5e1;
                    }
                    .header-left {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .logo-img {
                        height: 52px;
                        width: auto;
                        object-fit: contain;
                        border-radius: 8px;
                        border: 1px solid #e2e8f0;
                    }
                    .brand-name {
                        font-size: 20px;
                        font-weight: 900;
                        color: #0f172a;
                        letter-spacing: -0.5px;
                        line-height: 1.1;
                    }
                    .brand-name span {
                        color: #2563eb;
                    }
                    .brand-sub {
                        font-size: 10px;
                        font-weight: 700;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.8px;
                        margin-top: 3px;
                    }
                    .header-right {
                        text-align: right;
                    }
                    .receipt-badge {
                        display: inline-block;
                        background: #eff6ff;
                        color: #1d4ed8;
                        border: 1px solid #bfdbfe;
                        font-size: 10px;
                        font-weight: 800;
                        padding: 3px 8px;
                        border-radius: 6px;
                        text-transform: uppercase;
                    }
                    .header-date {
                        font-size: 10px;
                        color: #64748b;
                        margin-top: 4px;
                        font-weight: 600;
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
                        border: 1px solid #86efac;
                        color: #15803d;
                    }
                    .status-failed {
                        background: #fef2f2;
                        border: 1px solid #fca5a5;
                        color: #b91c1c;
                    }
                    .status-pending {
                        background: #fffbeb;
                        border: 1px solid #fde68a;
                        color: #b45309;
                    }
                    .status-title {
                        font-size: 13px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .status-desc {
                        font-size: 11px;
                        font-weight: 600;
                        opacity: 0.9;
                    }
                    .amount-card {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 12px 16px;
                        margin-bottom: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    }
                    .amount-label {
                        font-size: 11px;
                        font-weight: 700;
                        color: #64748b;
                        text-transform: uppercase;
                    }
                    .amount-value {
                        font-size: 22px;
                        font-weight: 900;
                        color: #0f172a;
                    }
                    .amount-success {
                        color: #15803d;
                    }
                    .section-title {
                        font-size: 11px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #475569;
                        letter-spacing: 0.5px;
                        margin: 14px 0 8px 0;
                        padding-bottom: 4px;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    .details-grid {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 14px;
                    }
                    .details-grid td {
                        padding: 7px 8px;
                        border-bottom: 1px solid #f1f5f9;
                        font-size: 11px;
                    }
                    .details-grid tr:nth-child(even) {
                        background: #f8fafc;
                    }
                    .label-cell {
                        color: #64748b;
                        font-weight: 700;
                        width: 32%;
                        text-transform: uppercase;
                        font-size: 10px;
                        letter-spacing: 0.3px;
                    }
                    .value-cell {
                        color: #0f172a;
                        font-weight: 700;
                        text-align: right;
                    }
                    .mono-val {
                        font-family: 'Courier New', Courier, monospace;
                        font-weight: 800;
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
                        background: #f1f5f9;
                        color: #334155;
                        font-weight: 800;
                        text-transform: uppercase;
                        font-size: 9.5px;
                        letter-spacing: 0.5px;
                        padding: 7px 8px;
                        border: 1px solid #e2e8f0;
                        text-align: left;
                    }
                    .statement-table td {
                        padding: 6px 8px;
                        border: 1px solid #e2e8f0;
                        font-size: 10.5px;
                    }
                    .statement-table tr:nth-child(even) td {
                        background: #fafafa;
                    }
                    .badge-cr {
                        background: #dcfce7;
                        color: #15803d;
                        border: 1px solid #bbf7d0;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 9px;
                        font-weight: 800;
                        display: inline-block;
                    }
                    .badge-dr {
                        background: #fee2e2;
                        color: #b91c1c;
                        border: 1px solid #fecaca;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 9px;
                        font-weight: 800;
                        display: inline-block;
                    }
                    .footer-note {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 10px 12px;
                        margin-top: 16px;
                        font-size: 9.5px;
                        color: #64748b;
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
                        border-top: 1px dashed #94a3b8;
                        padding-top: 6px;
                        font-size: 10px;
                        font-weight: 700;
                        color: #475569;
                    }
                    @media print {
                        body { background: #ffffff; padding: 0; }
                        .receipt-container { border: none; box-shadow: none; padding: 10px; max-width: 100%; }
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
                                <div class="brand-name">RUPIKSHA <span>FINTECH</span></div>
                                <div class="brand-sub">AEPS Banking Correspondent Point</div>
                            </div>
                        </div>
                        <div class="header-right">
                            <div class="receipt-badge">Official E-Receipt</div>
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
                            <td class="label-cell">Service Type</td>
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
                            <td class="value-cell" style="color: #15803d; font-weight: 800;">₹ ${formattedBalance}</td>
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
                        This is a computer-generated transaction acknowledgement receipt verified through biometric Aadhaar UIDAI authentication. No physical signature is required. Rupiksha Fintech is an authorized Business Correspondent partner. For any support, email support@rupiksha.in.
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm font-['Inter',sans-serif] overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 10 }}
                    className="relative bg-white border border-slate-200/90 shadow-[0_25px_60px_rgba(0,0,0,0.25)] rounded-2xl w-full max-w-lg overflow-hidden flex flex-col my-auto max-h-[92vh]"
                >
                    {/* Header Bar with prominent Close (X) Cut Button */}
                    <div className="px-4 sm:px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600">
                            <ShieldCheck size={15} className="text-emerald-600" />
                            <span>{isBalanceInquiry ? 'Account Balance Statement' : isMiniStatement ? 'Account Mini Statement' : 'Transaction E-Receipt'}</span>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            title="Close Receipt"
                            className="p-1.5 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-200 border border-slate-200 rounded-full transition-all cursor-pointer shadow-sm hover:scale-105"
                        >
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Receipt Body (Clean, compact, no awkward scroll for normal receipts) */}
                    <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
                        {/* Company Logo & Brand Header */}
                        <div className="flex items-center justify-center gap-3 pb-2.5 border-b border-dashed border-slate-200">
                            <img
                                src="/rupiksha logo.jpeg"
                                alt="Rupiksha Logo"
                                className="h-10 w-10 object-contain rounded-xl shadow-xs border border-slate-200/70 p-0.5 bg-white shrink-0"
                            />
                            <div className="text-left">
                                <h2 className="text-lg font-black tracking-tight text-slate-900 leading-none">
                                    RUPIKSHA <span className="text-blue-600">FINTECH</span>
                                </h2>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                                    AEPS Banking Terminal
                                </p>
                            </div>
                        </div>

                        {/* Status Graphic & Amount Banner */}
                        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 text-center">
                            <div className="flex items-center justify-center gap-2 mb-1.5">
                                {isSuccess ? (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-black uppercase tracking-wider">
                                        <CheckCircle2 size={13} className="text-emerald-700" />
                                        <span>
                                            {isBalanceInquiry ? 'Balance Fetched' : isMiniStatement ? 'Mini Statement Fetched' : 'Transaction Approved'}
                                        </span>
                                    </div>
                                ) : isPending ? (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[10px] font-black uppercase tracking-wider">
                                        <AlertTriangle size={13} className="text-amber-700" />
                                        <span>Transaction Pending</span>
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-[10px] font-black uppercase tracking-wider">
                                        <XCircle size={13} className="text-rose-700" />
                                        <span>Transaction Declined</span>
                                    </div>
                                )}
                            </div>

                            {/* Prominent Amount / Balance Display */}
                            {isBalanceInquiry || isMiniStatement ? (
                                <div>
                                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Available Account Balance</p>
                                    <div className="text-2xl font-black text-emerald-600 tracking-tight">
                                        ₹ {balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Transaction Amount</p>
                                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                                        ₹ {transactionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            )}

                            {message && (
                                <p className="text-[10px] font-semibold text-slate-500 mt-1 truncate" title={message}>
                                    {message}
                                </p>
                            )}
                        </div>

                        {/* Mini Statement Table Section (if available) */}
                        {isMiniStatement && isSuccess && miniStatement && miniStatement.length > 0 && (
                            <div className="border border-slate-200 rounded-xl p-2.5 bg-white shadow-xs">
                                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
                                    <span className="text-[10.5px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                        <FileText size={12} className="text-blue-600" />
                                        Recent Statement ({miniStatement.length} Transactions)
                                    </span>
                                </div>
                                <div className="max-h-36 overflow-y-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-[9px] font-black uppercase text-slate-500 bg-slate-50 sticky top-0">
                                                <th className="py-1 px-1">Date</th>
                                                <th className="py-1 px-1 text-center">Type</th>
                                                <th className="py-1 px-1 text-right">Amount</th>
                                                <th className="py-1 px-1.5">Narration</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                            {miniStatement.map((entry, idx) => {
                                                const isCr = (entry.txnType || '').toLowerCase().startsWith('c');
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="py-1 px-1 text-[10px] whitespace-nowrap text-slate-600 font-bold">
                                                            {entry.date}
                                                        </td>
                                                        <td className="py-1 px-1 text-center whitespace-nowrap">
                                                            <span className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-black uppercase ${
                                                                isCr ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                            }`}>
                                                                {isCr ? <ArrowDownLeft size={9} /> : <ArrowUpRight size={9} />}
                                                                {isCr ? 'CR' : 'DR'}
                                                            </span>
                                                        </td>
                                                        <td className={`py-1 px-1 text-right text-[10px] font-black whitespace-nowrap ${
                                                            isCr ? 'text-emerald-700' : 'text-slate-800'
                                                        }`}>
                                                            ₹{entry.amount}
                                                        </td>
                                                        <td className="py-1 px-1.5 text-[9.5px] text-slate-600 truncate max-w-[130px] font-medium" title={entry.narration}>
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

                        {/* Compact 2-Column Details Grid */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80 text-[11px]">
                            <div className="flex flex-col">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase">Transaction Type</span>
                                <span className="font-extrabold text-slate-800 truncate">{serviceTitle}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase">Bank Name</span>
                                <span className="font-extrabold text-slate-800 truncate flex items-center gap-1">
                                    <Landmark size={11} className="text-slate-400 shrink-0" />
                                    {bankName}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase">Customer Mobile</span>
                                <span className="font-bold text-slate-800">{mobile}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase">Aadhaar / VID</span>
                                <span className="font-mono font-bold text-slate-800">{maskedAadhaar}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase">Bank RRN</span>
                                <span className="font-mono font-black text-slate-800 truncate select-all">{bankRRN}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase">Merchant Txn ID</span>
                                <span className="font-mono font-bold text-slate-700 truncate select-all">{txnId}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase">Gateway Txn ID</span>
                                <span className="font-mono font-bold text-slate-700 truncate select-all">{fpTxnId}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase">Terminal ID</span>
                                <span className="font-bold text-slate-800 uppercase">{agentId}</span>
                            </div>
                            <div className="flex flex-col col-span-2 pt-1 border-t border-slate-200/60">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase">Date & Time</span>
                                <span className="font-semibold text-slate-600">{timestamp}</span>
                            </div>
                        </div>

                        {/* SOP / Biometric Compliance Disclaimer */}
                        <div className="text-[9.5px] font-medium text-slate-400 text-center leading-tight">
                            System generated e-receipt • Biometrically verified via UIDAI • Rupiksha Licensed BC
                        </div>
                    </div>

                    {/* Bottom Action buttons */}
                    <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:shadow"
                        >
                            <Printer size={14} />
                            <span>Print Receipt</span>
                        </button>
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="py-2.5 px-3.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <Download size={14} />
                            <span>PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="py-2.5 px-3.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-bold uppercase tracking-wider text-xs transition-all cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

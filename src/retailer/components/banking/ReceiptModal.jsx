import React, { useRef } from 'react';
import { X, Printer, Download, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Landmark } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReceiptModal({ isOpen, onClose, txnData }) {
    const printAreaRef = useRef();

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
        timestamp = new Date().toLocaleString(),
        agentId = 'N/A'
    } = txnData;

    const handlePrint = () => {
        const printContent = printAreaRef.current.innerHTML;
        const originalContent = document.body.innerHTML;
        
        // Open print window
        const win = window.open('', '_blank');
        win.document.write(`
            <html>
                <head>
                    <title>Rupiksha AEPS Receipt - ${txnId}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 20px; color: #334155; }
                        .receipt-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; max-width: 500px; margin: 0 auto; }
                        .header { text-align: center; border-bottom: 2px dashed #e2e8f0; padding-bottom: 16px; margin-bottom: 16px; }
                        .logo { font-size: 20px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: -0.5px; }
                        .subtitle { font-size: 11px; color: #64748b; font-weight: 700; margin-top: 4px; }
                        .status-box { text-align: center; margin: 16px 0; padding: 12px; border-radius: 8px; font-weight: 800; font-size: 14px; text-transform: uppercase; }
                        .status-success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
                        .status-failed { background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5; }
                        .status-pending { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
                        .amount { font-size: 28px; font-weight: 900; color: #0f172a; margin: 8px 0; text-align: center; }
                        .grid-row { display: flex; justify-content: space-between; font-size: 12px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
                        .grid-label { color: #64748b; font-weight: 600; }
                        .grid-val { color: #1e293b; font-weight: 700; text-align: right; }
                        .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 24px; font-weight: 600; }
                    </style>
                </head>
                <body>
                    <div class="receipt-card">
                        ${printContent}
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `);
        win.document.close();
    };

    const statusUpper = status.toUpperCase();
    const isBalanceInquiry = txnData.serviceType === 'BALANCE_INQUIRY' || (txnData.serviceLabel && txnData.serviceLabel.toLowerCase().includes('balance'));
    const isMiniStatement = txnData.serviceType === 'MINI_STATEMENT' || (txnData.serviceLabel && txnData.serviceLabel.toLowerCase().includes('statement'));

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm font-['Inter',sans-serif]">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="bg-white border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header bar */}
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-emerald-500" />
                            {isBalanceInquiry ? 'Account Balance Statement' : 'Secure Transaction E-Receipt'}
                        </span>
                        <button
                            onClick={onClose}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Scrollable Receipt Body */}
                    <div className="p-8 overflow-y-auto flex-1 space-y-6" ref={printAreaRef}>
                        {/* Branding Header */}
                        <div className="text-center pb-5 border-b border-dashed border-slate-200">
                            <h2 className="text-xl font-black tracking-tight text-slate-800 uppercase">
                                RUPIKSHA <span className="text-blue-600">FINTECH</span>
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                AEPS Banking Terminal
                            </p>
                        </div>

                        {/* Status Graphic & Amount */}
                        <div className="text-center py-2">
                            <div className="flex justify-center mb-3">
                                {statusUpper === 'SUCCESS' ? (
                                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full flex items-center justify-center shadow-sm">
                                        <CheckCircle2 size={24} />
                                    </div>
                                ) : statusUpper === 'PENDING' ? (
                                    <div className="w-12 h-12 bg-amber-50 text-amber-600 border border-amber-100 rounded-full flex items-center justify-center shadow-sm">
                                        <AlertTriangle size={24} />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 bg-rose-50 text-rose-600 border border-rose-100 rounded-full flex items-center justify-center shadow-sm">
                                        <XCircle size={24} />
                                    </div>
                                )}
                            </div>

                            <span className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-2 ${
                                statusUpper === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                statusUpper === 'PENDING' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                                {statusUpper === 'SUCCESS' ? (isBalanceInquiry ? 'Balance Fetched Successfully' : 'Transaction Approved') : statusUpper === 'PENDING' ? 'Transaction Pending' : 'Transaction Rejected'}
                            </span>

                            {isBalanceInquiry ? (
                                <div className="space-y-0.5">
                                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Available Account Balance</p>
                                    <div className="text-3xl font-black text-emerald-600 tracking-tight">
                                        ₹ {balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-3xl font-black text-slate-800 tracking-tight">
                                    ₹ {transactionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                            )}

                            <p className="text-[10px] font-semibold text-slate-400 mt-1 leading-normal">
                                {message}
                            </p>
                        </div>

                        {/* Details Table */}
                        <div className="space-y-2.5">
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                                <span className="font-semibold text-slate-400">Transaction Type</span>
                                <span className="font-black text-slate-800 uppercase tracking-wide">{txnData.serviceLabel || txnData.serviceType || 'AEPS Banking'}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                                <span className="font-semibold text-slate-400">Bank Name</span>
                                <span className="font-black text-slate-800 flex items-center gap-1">
                                    <Landmark size={12} className="text-slate-400" />
                                    {bankName}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                                <span className="font-semibold text-slate-400">Customer Mobile</span>
                                <span className="font-black text-slate-800">{mobile}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                                <span className="font-semibold text-slate-400">Aadhaar / VID Number</span>
                                <span className="font-black text-slate-800">{maskedAadhaar}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                                <span className="font-semibold text-slate-400">Merchant Txn ID</span>
                                <span className="font-mono font-black text-slate-800 select-all">{txnId}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                                <span className="font-semibold text-slate-400">Gateway Txn ID</span>
                                <span className="font-mono font-black text-slate-800 select-all">{fpTxnId}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                                <span className="font-semibold text-slate-400">Bank RRN</span>
                                <span className="font-mono font-black text-slate-800 select-all">{bankRRN}</span>
                            </div>
                            {statusUpper === 'SUCCESS' && !isBalanceInquiry && balanceAmount > 0 && (
                                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                                    <span className="font-semibold text-slate-400">Remaining Ledger Balance</span>
                                    <span className="font-black text-slate-800">₹{balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                                <span className="font-semibold text-slate-400">Retailer Terminal ID</span>
                                <span className="font-black text-slate-800 uppercase">{agentId}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                                <span className="font-semibold text-slate-400">Date & Time</span>
                                <span className="font-black text-slate-500">{timestamp}</span>
                            </div>
                        </div>

                        {/* Customer SOP reminder disclaimer */}
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[10px] font-semibold text-slate-400 leading-normal text-center">
                            This is a system generated e-receipt. Biometric verified by UIDAI. Rupiksha is a licensed BC under corporate banking agreements.
                        </div>
                    </div>

                    {/* Bottom Action buttons */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                        <button
                            onClick={handlePrint}
                            className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                        >
                            <Printer size={14} />
                            Print Receipt
                        </button>
                        <button
                            onClick={handlePrint} // Print prints to PDF on most systems, reusing standard browser print dialog
                            className="py-3.5 px-4 bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-100 rounded-2xl font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Download size={14} />
                            PDF
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

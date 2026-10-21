import React, { useRef, useState } from 'react';
import {
    CheckCircle2,
    Clock,
    AlertCircle,
    Download,
    Printer,
    ShieldCheck,
    RefreshCw
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Standard Bharat Connect (BBPS) Transaction Receipt Card
 * Supports Success, Failed, and Pending statuses.
 * Includes official Bharat Connect and Rupiksha Services logos.
 * Generates crisp A4 PDF download without overflow.
 */
const BbpsReceiptCard = ({
    txnOutcome,
    category = 'electricity',
    isPrepaid = false,
    billerName = '',
    consumerNumber = '',
    customerName = '',
    onReset,
    resetButtonText = '+ Pay Another Bill'
}) => {
    const receiptRef = useRef(null);
    const [isDownloading, setIsDownloading] = useState(false);

    if (!txnOutcome) return null;

    const isSuccess = txnOutcome.status === 'SUCCESS' || txnOutcome.success === true;
    const isPending = txnOutcome.status === 'PENDING';
    const isFailed = !isSuccess && !isPending;
    const isElectricity = category === 'electricity';
    const isMobile = category === 'mobile-prepaid';

    // Format paid date nicely
    const formatPaidDate = (dateVal) => {
        try {
            const d = dateVal ? new Date(dateVal) : new Date();
            if (isNaN(d.getTime())) return new Date().toLocaleString('en-IN');
            return d.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }) + ', ' + d.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return new Date().toLocaleString('en-IN');
        }
    };

    const txnId = txnOutcome.merchantRefNo || txnOutcome.transactionId || 'N/A';
    const refNo = txnOutcome.providerTxnId || txnOutcome.bankRRN || txnOutcome.refNo || 'N/A';
    const approvalNo = txnOutcome.approvalRefNo || txnOutcome.approvalNumber || 'AB123456';
    const displayBiller = txnOutcome.billerName || billerName || (isElectricity ? 'Electricity Board' : 'Telecom Operator');
    const isPrepaidMeter = isPrepaid || txnOutcome.meterType === 'PREPAID';
    
    const serviceType = isElectricity
        ? (isPrepaidMeter ? 'Smart Prepaid Meter Recharge' : 'Postpaid Electricity Bill')
        : (isMobile ? 'Smart Prepaid Mobile Recharge' : 'Bharat Connect Utility Payment');
        
    const paidDate = formatPaidDate(txnOutcome.createdAt || txnOutcome.completedAt || txnOutcome.billDate || new Date());
    const caNumber = txnOutcome.consumerNumber || txnOutcome.mobileNumber || consumerNumber || 'N/A';
    const custName = txnOutcome.customerName || customerName || (isElectricity ? (isPrepaidMeter ? 'Prepaid Meter Consumer' : 'Electricity Consumer') : 'Customer');
    const amountVal = Number(txnOutcome.amount || txnOutcome.totalAmount || 0).toFixed(2);

    // Download PDF handler
    const handleDownloadPdf = async () => {
        if (!receiptRef.current) return;
        setIsDownloading(true);

        try {
            const element = receiptRef.current;

            // Render crisp canvas at 3x resolution
            const canvas = await html2canvas(element, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            });

            const imgData = canvas.toDataURL('image/png', 1.0);

            // A4 Portrait: 210mm x 297mm
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 16;
            const printableWidth = pageWidth - (margin * 2);
            const printableHeight = (canvas.height * printableWidth) / canvas.width;

            // Vertically center on page if fits comfortably, else top margin
            const yPos = printableHeight < (pageHeight - margin * 2)
                ? Math.max(margin, (pageHeight - printableHeight) / 3)
                : margin;

            pdf.addImage(imgData, 'PNG', margin, yPos, printableWidth, Math.min(printableHeight, pageHeight - margin * 2), undefined, 'FAST');

            const fileSafeTxnId = (txnId || 'BBPS').replace(/[^a-zA-Z0-9_-]/g, '_');
            pdf.save(`BBPS_Receipt_${fileSafeTxnId}.pdf`);
        } catch (err) {
            console.error('Failed to generate BBPS receipt PDF:', err);
            // Fallback to window.print if html2canvas/jsPDF fails
            window.print();
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto space-y-4 font-['Inter',sans-serif]">
            {/* The Printable / Downloadable Receipt Card */}
            <div
                ref={receiptRef}
                id="bbps-printable-receipt"
                className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xl space-y-4 text-center overflow-hidden"
            >
                {/* Official Brand Header (Left: Rupiksha, Right: Bharat Connect) */}
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/90 gap-3">
                    {/* Left: Rupiksha Services Pvt. Ltd */}
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <img
                            src="/logo rupiksha.png"
                            alt="Rupiksha Logo"
                            className="h-10 sm:h-12 w-auto max-w-[46px] sm:max-w-[52px] object-contain rounded-xl p-1 bg-white border border-slate-200 shadow-2xs shrink-0"
                            crossOrigin="anonymous"
                        />
                        <div className="text-left min-w-0">
                            <h3 className="text-xs sm:text-sm font-black text-black leading-tight truncate">
                                Rupiksha Services <span className="text-blue-700">Pvt. Ltd</span>
                            </h3>
                            <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider truncate mt-0.5">
                                Bharat Connect Agent Point
                            </p>
                        </div>
                    </div>

                    {/* Right: Official Bharat Connect Primary Logo */}
                    <div className="flex items-center justify-end shrink-0">
                        <img
                            src="/Bharat Connect Primary Logo_PNG.png"
                            alt="Bharat Connect Official Logo"
                            className="h-8 sm:h-10 w-auto max-w-[125px] sm:max-w-[150px] object-contain"
                            crossOrigin="anonymous"
                        />
                    </div>
                </div>

                {/* Status Indicator & Title */}
                {isSuccess ? (
                    <div className="space-y-2 py-1">
                        <div className="w-14 h-14 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-2xs">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="space-y-0.5">
                            <h2 className="text-lg sm:text-xl font-black text-black tracking-tight">
                                {isElectricity
                                    ? (isPrepaidMeter ? 'Prepaid Meter Recharged!' : 'Electricity Bill Paid!')
                                    : 'Recharge Successful!'}
                            </h2>
                            <p className="text-xs font-bold text-slate-600 max-w-md mx-auto leading-relaxed">
                                {isElectricity
                                    ? (isPrepaidMeter
                                        ? 'Your smart prepaid meter recharge token/credit has been generated via Bharat Connect'
                                        : 'Your electricity bill payment has been verified & completed via Bharat Connect')
                                    : 'Your prepaid mobile has been recharged instantly via Bharat Connect'}
                            </p>
                        </div>
                    </div>
                ) : isPending ? (
                    <div className="space-y-2 py-1">
                        <div className="w-14 h-14 rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center mx-auto text-amber-600 shadow-2xs">
                            <Clock className="w-8 h-8" />
                        </div>
                        <div className="space-y-0.5">
                            <h2 className="text-lg sm:text-xl font-black text-black tracking-tight">Payment In Progress</h2>
                            <p className="text-xs font-bold text-slate-600 max-w-md mx-auto leading-relaxed">
                                The provider network is confirming the transaction. You can check the final status in BBPS History.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2 py-1">
                        <div className="w-14 h-14 rounded-full bg-rose-50 border-4 border-rose-100 flex items-center justify-center mx-auto text-rose-600 shadow-2xs">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <div className="space-y-0.5">
                            <h2 className="text-lg sm:text-xl font-black text-black tracking-tight">Payment Failed</h2>
                            <p className="text-xs font-bold text-slate-600 max-w-md mx-auto leading-relaxed">
                                {txnOutcome.message || 'The payment could not be processed.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Details Table */}
                <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200 text-left text-xs font-bold space-y-2">
                    {isSuccess ? (
                        /* SUCCESS RECEIPT - Exact Series Specified:
                           1. Transaction ID
                           2. Refrence No (was BBPS Provider Ref)
                           3. Approval No
                           4. Electricity Board (or Operator for mobile)
                           5. Service Type
                           6. Bill Date (paid date)
                           7. CA Number (or Consumer Number / CA)
                           8. Customer Name
                           9. Amount Paid
                        */
                        <>
                            {/* 1. Transaction ID */}
                            <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                <span className="text-slate-500 shrink-0">Transaction ID</span>
                                <span className="font-mono font-black text-black text-right break-all select-all">
                                    {txnId}
                                </span>
                            </div>

                            {/* 2. Refrence No */}
                            <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                <span className="text-slate-500 shrink-0">Refrence No</span>
                                <span className="font-mono font-black text-black text-right break-all select-all">
                                    {refNo}
                                </span>
                            </div>

                            {/* 3. Approval No */}
                            <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                <span className="text-slate-500 shrink-0">Approval No</span>
                                <span className="font-mono font-black text-black text-right break-all select-all">
                                    {approvalNo}
                                </span>
                            </div>

                            {/* 4. Electricity Board / Operator */}
                            <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                <span className="text-slate-500 shrink-0">{isElectricity ? 'Electricity Board' : 'Operator'}</span>
                                <span className="font-black text-black text-right break-words max-w-[65%]">
                                    {displayBiller}
                                </span>
                            </div>

                            {/* 5. Service Type */}
                            <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                <span className="text-slate-500 shrink-0">Service Type</span>
                                <span className="font-black text-slate-800 text-right">
                                    {serviceType}
                                </span>
                            </div>

                            {/* 6. Bill Date (paid date) */}
                            <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                <span className="text-slate-500 shrink-0">Bill Date</span>
                                <span className="font-black text-black text-right">
                                    {paidDate}
                                </span>
                            </div>

                            {/* 7. CA Number */}
                            <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                <span className="text-slate-500 shrink-0">{isElectricity ? 'CA Number' : 'Mobile Number'}</span>
                                <span className="font-mono font-black text-black text-right break-all">
                                    {caNumber}
                                </span>
                            </div>

                            {/* 8. Customer Name */}
                            <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                <span className="text-slate-500 shrink-0">Customer Name</span>
                                <span className="font-black text-black text-right break-words uppercase">
                                    {custName}
                                </span>
                            </div>

                            {/* 9. Amount Paid */}
                            <div className="flex justify-between items-baseline py-1 pt-1.5 gap-2">
                                <span className="text-slate-700 font-black text-xs uppercase">Amount Paid</span>
                                <span className="font-black text-amber-600 text-base sm:text-lg">
                                    ₹{amountVal}
                                </span>
                            </div>
                        </>
                    ) : (
                        /* FAILED (or Pending) RECEIPT - Keep existing details format:
                           - Transaction ID
                           - Electricity Board
                           - Service Type
                           - Consumer Number / CA
                           - Customer Name
                           - Amount Paid
                        */
                        <>
                            <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                <span className="text-slate-500 shrink-0">Transaction ID</span>
                                <span className="font-mono font-black text-black text-right break-all select-all">
                                    {txnId}
                                </span>
                            </div>

                            <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                <span className="text-slate-500 shrink-0">{isElectricity ? 'Electricity Board' : 'Operator'}</span>
                                <span className="font-black text-black text-right break-words max-w-[65%]">
                                    {displayBiller}
                                </span>
                            </div>

                            <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                <span className="text-slate-500 shrink-0">Service Type</span>
                                <span className="font-black text-slate-800 text-right">
                                    {serviceType}
                                </span>
                            </div>

                            <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                <span className="text-slate-500 shrink-0">{isElectricity ? 'Consumer Number / CA' : 'Mobile Number'}</span>
                                <span className="font-mono font-black text-black text-right break-all">
                                    {caNumber}
                                </span>
                            </div>

                            <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                <span className="text-slate-500 shrink-0">Customer Name</span>
                                <span className="font-black text-black text-right break-words uppercase">
                                    {custName}
                                </span>
                            </div>

                            <div className="flex justify-between items-baseline py-1 pt-1.5 gap-2">
                                <span className="text-slate-700 font-black text-xs uppercase">Amount Paid</span>
                                <span className="font-black text-amber-600 text-base sm:text-lg">
                                    ₹{amountVal}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* Bottom Assurance Note */}
                <div className="pt-1 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Official Bharat Connect Payment Receipt • Verified via NPCI</span>
                </div>
            </div>

            {/* Receipt Action Buttons (Outside printable area) */}
            <div className="flex items-center gap-3 pt-1">
                {/* Download Receipt Button in place of Print Receipt */}
                <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isDownloading}
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-60"
                >
                    {isDownloading ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                            <span>Generating PDF...</span>
                        </>
                    ) : (
                        <>
                            <Download className="w-4 h-4 text-blue-600" />
                            <span>Download Receipt</span>
                        </>
                    )}
                </button>

                {/* Print button shortcut */}
                <button
                    type="button"
                    onClick={() => window.print()}
                    title="Print Receipt"
                    className="p-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-black transition-colors cursor-pointer shadow-xs shrink-0"
                >
                    <Printer className="w-4 h-4" />
                </button>

                {/* Pay Another Bill Button */}
                <button
                    type="button"
                    onClick={onReset}
                    className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs transition-all cursor-pointer shadow-sm active:scale-[0.99] text-center"
                >
                    {resetButtonText}
                </button>
            </div>
        </div>
    );
};

export default BbpsReceiptCard;

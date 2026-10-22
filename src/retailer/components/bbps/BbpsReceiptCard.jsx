import React, { useState } from 'react';
import {
    CheckCircle2,
    Clock,
    AlertCircle,
    Download,
    ShieldCheck,
    RefreshCw
} from 'lucide-react';
import { jsPDF } from 'jspdf';

/**
 * Helper to convert an image path to Base64 for razor-sharp jsPDF rendering
 */
const loadImageAsBase64 = (url) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
};

/**
 * Standard Bharat Connect (BBPS) Transaction Receipt Card
 * - On-screen: Clean presentation without top logos; B Assured watermark in background of details area.
 * - On PDF Download: Official e-receipt with Rupiksha logo & name on top left, B Assured logo in 30mm area on top right, and structured details table.
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
    const [isDownloading, setIsDownloading] = useState(false);

    if (!txnOutcome) return null;

    const isSuccess = txnOutcome.status === 'SUCCESS' || txnOutcome.success === true;
    const isPending = txnOutcome.status === 'PENDING';
    const isFailed = !isSuccess && !isPending;
    const isElectricity = category === 'electricity';
    const isMobile = category === 'mobile-prepaid';
    const isLoan = category === 'loan-repayment' || category === 'loan' || String(category || '').toLowerCase().includes('loan');

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
    const displayBiller = txnOutcome.billerName || billerName || (isElectricity ? 'Electricity Board' : isLoan ? 'Lender / Financier' : 'Telecom Operator');
    const isPrepaidMeter = isPrepaid || txnOutcome.meterType === 'PREPAID';

    const serviceType = isElectricity
        ? (isPrepaidMeter ? 'Smart Prepaid Meter Recharge' : 'Postpaid Electricity Bill')
        : isLoan
            ? 'Loan Repayment (EMI / Advance)'
            : (isMobile ? 'Smart Prepaid Mobile Recharge' : 'Bharat Connect Utility Payment');

    const paidDate = formatPaidDate(txnOutcome.createdAt || txnOutcome.completedAt || txnOutcome.billDate || new Date());
    const caNumber = txnOutcome.consumerNumber || txnOutcome.mobileNumber || consumerNumber || 'N/A';
    const custName = txnOutcome.customerName || customerName || (isElectricity ? (isPrepaidMeter ? 'Prepaid Meter Consumer' : 'Electricity Consumer') : isLoan ? 'Borrower / Customer' : 'Customer');
    const amountVal = Number(txnOutcome.amount || txnOutcome.totalAmount || 0).toFixed(2);

    // Direct, reliable PDF download using jsPDF vector engine
    const handleDownloadPdf = async () => {
        setIsDownloading(true);

        try {
            // Preload logos as Base64 to ensure immediate, zero-error rendering
            const [rupikshaBase64, bAssuredBase64] = await Promise.all([
                loadImageAsBase64('/logo rupiksha.png'),
                loadImageAsBase64('/B Assured Logo_PNG.png')
            ]);

            // Create A4 Portrait PDF: 210mm x 297mm
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = 210;
            const margin = 16;
            const contentWidth = pageWidth - (margin * 2); // 178mm

            // 1. TOP HEADER (Left: Rupiksha Logo & Company Info, Right: B Assured Logo in 30mm area)
            // Left: Rupiksha Logo
            if (rupikshaBase64) {
                pdf.addImage(rupikshaBase64, 'PNG', margin, 14, 22, 22);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(15);
                pdf.setTextColor(15, 23, 42); // slate-900
                pdf.text('Rupiksha Services Pvt. Ltd', margin + 26, 21);

                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(8.5);
                pdf.setTextColor(37, 99, 235); // blue-600
                pdf.text('BHARAT CONNECT AUTHORIZED AGENT', margin + 26, 27);

                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
                pdf.setTextColor(100, 116, 139); // slate-500
                pdf.text(`Official Transaction Receipt • Date: ${paidDate}`, margin + 26, 32);
            } else {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(16);
                pdf.setTextColor(15, 23, 42);
                pdf.text('Rupiksha Services Pvt. Ltd', margin, 21);
                pdf.setFontSize(9);
                pdf.setTextColor(100, 116, 139);
                pdf.text(`Official Transaction Receipt • Date: ${paidDate}`, margin, 27);
            }

            // Right: B Assured Logo with EXACT 30mm area (30mm x 30mm)
            const logo30mmSize = 30;
            const logoX = pageWidth - margin - logo30mmSize;
            const logoY = 11;
            if (bAssuredBase64) {
                pdf.addImage(bAssuredBase64, 'PNG', logoX, logoY, logo30mmSize, logo30mmSize);
            }

            // Divider Line below Header
            pdf.setDrawColor(226, 232, 240); // slate-200
            pdf.setLineWidth(0.6);
            pdf.line(margin, 45, pageWidth - margin, 45);

            // 2. STATUS BANNER
            let currentY = 52;
            if (isSuccess) {
                pdf.setFillColor(240, 253, 244); // emerald-50
                pdf.setDrawColor(34, 197, 94); // emerald-500
                pdf.roundedRect(margin, currentY, contentWidth, 16, 3, 3, 'FD');

                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(11);
                pdf.setTextColor(21, 128, 61); // emerald-700
                pdf.text('TRANSACTION SUCCESSFUL', margin + 6, currentY + 7);

                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
                pdf.setTextColor(22, 101, 52);
                pdf.text(
                    isElectricity
                        ? (isPrepaidMeter ? 'Smart Prepaid Meter Recharge Completed via Bharat Connect' : 'Electricity Bill Payment Verified & Completed')
                        : 'Prepaid Mobile Recharge Verified & Completed via Bharat Connect',
                    margin + 6,
                    currentY + 12
                );
            } else if (isPending) {
                pdf.setFillColor(255, 251, 235); // amber-50
                pdf.setDrawColor(245, 158, 11);
                pdf.roundedRect(margin, currentY, contentWidth, 16, 3, 3, 'FD');

                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(11);
                pdf.setTextColor(180, 83, 9);
                pdf.text('TRANSACTION PENDING', margin + 6, currentY + 7);

                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
                pdf.setTextColor(146, 64, 14);
                pdf.text('Reconciling with biller provider. Check BBPS history for final status.', margin + 6, currentY + 12);
            } else {
                pdf.setFillColor(255, 241, 242); // rose-50
                pdf.setDrawColor(244, 63, 94);
                pdf.roundedRect(margin, currentY, contentWidth, 18, 3, 3, 'FD');

                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(11);
                pdf.setTextColor(190, 18, 60); // rose-700
                pdf.text('TRANSACTION FAILED', margin + 6, currentY + 7);

                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
                pdf.setTextColor(159, 18, 57);
                const failMsg = txnOutcome.message || 'Payment amount is unacceptable. Amount has been refunded to your wallet.';
                const splitMsg = pdf.splitTextToSize(failMsg, contentWidth - 12);
                pdf.text(splitMsg, margin + 6, currentY + 12);
                currentY += 2;
            }

            currentY += 24;

            // 3. DETAILS TABLE HEADER
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(15, 23, 42);
            pdf.text('TRANSACTION DETAILS', margin, currentY);

            currentY += 4.5;

            // Ordered Rows
            const rows = isSuccess ? [
                { label: 'Transaction ID', value: txnId },
                { label: 'Refrence No', value: refNo },
                { label: 'Approval No', value: approvalNo },
                { label: isElectricity ? 'Electricity Board' : isLoan ? 'Lender / Financier' : 'Operator', value: displayBiller },
                { label: 'Service Type', value: serviceType },
                { label: 'Bill Date', value: paidDate },
                { label: isElectricity ? 'CA Number' : isLoan ? 'Loan Account No (LAN)' : 'Mobile Number', value: caNumber },
                { label: 'Customer Name', value: custName },
                { label: 'Amount Paid', value: `INR ${amountVal}`, isAmount: true }
            ] : [
                { label: 'Transaction ID', value: txnId },
                { label: isElectricity ? 'Electricity Board' : isLoan ? 'Lender / Financier' : 'Operator', value: displayBiller },
                { label: 'Service Type', value: serviceType },
                { label: isElectricity ? 'Consumer Number / CA' : isLoan ? 'Loan Account No (LAN)' : 'Mobile Number', value: caNumber },
                { label: 'Customer Name', value: custName },
                { label: 'Amount Paid', value: `INR ${amountVal}`, isAmount: true }
            ];

            // 4. DRAW PROPER BOX TABLE (Plain White Background, Full Grid Borders, Zero Overflow)
            const tableStartY = currentY;
            const col1Width = 56; // Label column width (mm)
            const col2Width = contentWidth - col1Width; // Value column width (mm) = 122mm
            const maxValueWidth = col2Width - 8; // Available text width = 114mm

            rows.forEach((row) => {
                const valStr = String(row.value || 'N/A');

                // Split text dynamically so long names never overflow
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(row.isAmount ? 10.5 : 8.5);
                const valLines = pdf.splitTextToSize(valStr, maxValueWidth);
                const rHeight = Math.max(8.5, valLines.length * 4.4 + 4.2);

                // Plain White Background for every cell (pure white, no odd/even zebra stripes)
                pdf.setFillColor(255, 255, 255);
                pdf.rect(margin, currentY, contentWidth, rHeight, 'F');

                // Horizontal bottom border
                pdf.setDrawColor(203, 213, 225); // slate-300
                pdf.setLineWidth(0.3);
                pdf.line(margin, currentY + rHeight, margin + contentWidth, currentY + rHeight);

                // Vertical column divider between label and value
                pdf.line(margin + col1Width, currentY, margin + col1Width, currentY + rHeight);

                // Label Column Text (Left-aligned, vertically centered)
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(8.5);
                pdf.setTextColor(71, 85, 105); // slate-600
                pdf.text(row.label, margin + 4, currentY + (rHeight / 2) + 1.5);

                // Value Column Text (Right-aligned, cleanly formatted)
                if (row.isAmount) {
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(10.5);
                    pdf.setTextColor(217, 119, 6); // amber-600
                } else {
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(8.5);
                    pdf.setTextColor(15, 23, 42); // slate-900
                }

                if (valLines.length === 1) {
                    pdf.text(valLines[0], margin + contentWidth - 4, currentY + (rHeight / 2) + 1.5, { align: 'right' });
                } else {
                    let textY = currentY + 5.2;
                    valLines.forEach((line) => {
                        pdf.text(line, margin + contentWidth - 4, textY, { align: 'right' });
                        textY += 4.2;
                    });
                }

                currentY += rHeight;
            });

            // Outer Box Table Border (encloses entire table perfectly)
            const totalTableHeight = currentY - tableStartY;
            pdf.setDrawColor(203, 213, 225); // slate-300
            pdf.setLineWidth(0.4);
            pdf.rect(margin, tableStartY, contentWidth, totalTableHeight, 'D');

            // 5. FOOTER ASSURANCE BOX
            currentY += 8;
            pdf.setFillColor(248, 250, 252);
            pdf.setDrawColor(226, 232, 240);
            pdf.roundedRect(margin, currentY, contentWidth, 14, 2, 2, 'FD');

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(7.5);
            pdf.setTextColor(100, 116, 139);
            pdf.text('This is a computer-generated official e-receipt verified through NPCI Bharat Connect & Rupiksha Services Pvt. Ltd.', margin + contentWidth / 2, currentY + 6, { align: 'center' });

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7);
            pdf.text('For queries or support, please contact support@rupiksha.in • Authorized BC Point', margin + contentWidth / 2, currentY + 10, { align: 'center' });

            // 6. SAVE PDF DIRECTLY
            const fileSafeTxnId = (txnId || 'BBPS').replace(/[^a-zA-Z0-9_-]/g, '_');
            pdf.save(`BBPS_Receipt_${fileSafeTxnId}.pdf`);
        } catch (err) {
            console.error('Failed to export BBPS receipt PDF:', err);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto space-y-4 font-['Inter',sans-serif]">
            {/* The On-Screen Receipt Card: Clean view without top brand name/logos */}
            <div
                id="bbps-onscreen-receipt"
                className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl space-y-5 text-center overflow-hidden"
            >
                {/* Status Indicator & Title (Starts directly with status as requested) */}
                {isSuccess ? (
                    <div className="space-y-2 py-1">
                        <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-2xs">
                            <CheckCircle2 className="w-9 h-9" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-black text-black tracking-tight">
                                {isElectricity
                                    ? (isPrepaidMeter ? 'Prepaid Meter Recharged!' : 'Electricity Bill Paid!')
                                    : isLoan
                                        ? 'Loan Repayment Successful!'
                                        : 'Recharge Successful!'}
                            </h2>
                            <p className="text-xs font-bold text-slate-600 max-w-md mx-auto leading-relaxed">
                                {isElectricity
                                    ? (isPrepaidMeter
                                        ? 'Your smart prepaid meter recharge token/credit has been generated via Bharat Connect'
                                        : 'Your electricity bill payment has been verified & completed via Bharat Connect')
                                    : isLoan
                                        ? 'Your loan repayment / EMI installment has been processed successfully via Bharat Connect'
                                        : 'Your prepaid mobile has been recharged instantly via Bharat Connect'}
                            </p>
                        </div>
                    </div>
                ) : isPending ? (
                    <div className="space-y-2 py-1">
                        <div className="w-16 h-16 rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center mx-auto text-amber-600 shadow-2xs">
                            <Clock className="w-9 h-9" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-black text-black tracking-tight">Payment In Progress</h2>
                            <p className="text-xs font-bold text-slate-600 max-w-md mx-auto leading-relaxed">
                                The provider network is confirming the transaction. You can check the final status in BBPS History.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2 py-1">
                        <div className="w-16 h-16 rounded-full bg-rose-50 border-4 border-rose-100 flex items-center justify-center mx-auto text-rose-600 shadow-2xs">
                            <AlertCircle className="w-9 h-9" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-black text-black tracking-tight">Payment Failed</h2>
                            <p className="text-xs font-bold text-slate-600 max-w-md mx-auto leading-relaxed">
                                {txnOutcome.message || 'Payment amount is unacceptable (AMT010). Amount has been refunded to your wallet.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Details Box: Features B Assured watermark in background */}
                <div className="relative overflow-hidden bg-slate-50/90 p-4 sm:p-5 rounded-2xl border border-slate-200 text-left text-xs font-bold space-y-2">
                    {/* B Assured Logo Watermark in Background of Details Box */}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.17] select-none"
                    >
                        <img
                            src="/B Assured Logo_PNG.png"
                            alt=""
                            className="w-44 h-44 sm:w-52 sm:h-52 object-contain"
                        />
                    </div>

                    {/* Table Rows (Layered cleanly on top of watermark) */}
                    <div className="relative z-10 space-y-2">
                        {isSuccess ? (
                            /* SUCCESS DETAILS SERIES:
                               1. Transaction ID
                               2. Refrence No
                               3. Approval No
                               4. Electricity Board
                               5. Service Type
                               6. Bill Date (paid date)
                               7. CA Number
                               8. Customer Name
                               9. Amount Paid
                            */
                            <>
                                <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                    <span className="text-slate-500 shrink-0">Transaction ID</span>
                                    <span className="font-mono font-black text-black text-right break-all select-all">
                                        {txnId}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                    <span className="text-slate-500 shrink-0">Refrence No</span>
                                    <span className="font-mono font-black text-black text-right break-all select-all">
                                        {refNo}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                    <span className="text-slate-500 shrink-0">Approval No</span>
                                    <span className="font-mono font-black text-black text-right break-all select-all">
                                        {approvalNo}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                    <span className="text-slate-500 shrink-0">{isElectricity ? 'Electricity Board' : isLoan ? 'Lender / Financier' : 'Operator'}</span>
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
                                    <span className="text-slate-500 shrink-0">Bill Date</span>
                                    <span className="font-black text-black text-right">
                                        {paidDate}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center py-1 border-b border-slate-200/70 gap-2">
                                    <span className="text-slate-500 shrink-0">{isElectricity ? 'CA Number' : isLoan ? 'Loan Account No' : 'Mobile Number'}</span>
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
                        ) : (
                            /* FAILED (or Pending) DETAILS:
                               - Transaction ID
                               - Electricity Board / Lender / Operator
                               - Service Type
                               - Consumer Number / CA / Loan Account
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
                                    <span className="text-slate-500 shrink-0">{isElectricity ? 'Electricity Board' : isLoan ? 'Lender / Financier' : 'Operator'}</span>
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
                                    <span className="text-slate-500 shrink-0">{isElectricity ? 'Consumer Number / CA' : isLoan ? 'Loan Account No' : 'Mobile Number'}</span>
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
                </div>

                {/* Bottom Assurance Note */}
                <div className="pt-1 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Official Bharat Connect Payment Receipt • Verified via NPCI</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-1">
                {/* Download Receipt Button */}
                <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isDownloading}
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-60"
                >
                    {isDownloading ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                            <span>Downloading PDF...</span>
                        </>
                    ) : (
                        <>
                            <Download className="w-4 h-4 text-blue-600" />
                            <span>Download Receipt</span>
                        </>
                    )}
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

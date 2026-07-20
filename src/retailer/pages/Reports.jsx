import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
    FileText, Search, Download, Calendar, IndianRupee, 
    ArrowRight, Filter, RefreshCw, CheckCircle, Clock, 
    AlertCircle, Smartphone, Fingerprint, ChevronRight,
    ArrowUpRight, ArrowDownRight, Printer, Share2, History, Coins,
    Landmark, CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dataService } from '../../services/dataService';

// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const Icon3D = ({ icon: Icon, color, size = 24 }) => (
    <div className="relative group">
        <div className="absolute inset-0 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity" style={{ backgroundColor: color }}></div>
        <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95 border border-white/20 overflow-hidden" style={{ backgroundColor: color }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent"></div>
            <Icon size={size} className="text-white relative z-10" />
        </div>
    </div>
);

const StatusBadge = ({ status }) => {
    const config = {
        SUCCESS: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Completed' },
        PENDING: { bg: 'bg-amber-500/10', text: 'text-amber-600', dot: 'bg-amber-500', label: 'Processing' },
        FAILED: { bg: 'bg-rose-500/10', text: 'text-rose-600', dot: 'bg-rose-500', label: 'Declined' },
    };
    const s = config[status?.toUpperCase()] || config.PENDING;
    return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${s.bg} ${s.text} text-[10px] font-black uppercase tracking-wider border border-white/50 shadow-sm`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`}></span>
            {s.label}
        </div>
    );
};

// Mock Transactions Generator for fallback visualization
const generateMockTransactions = (reportType) => {
    const mockData = {
        aeps_1: [
            { id: 'TXN10001', created_at: new Date(Date.now() - 10 * 60000).toISOString(), service: 'AEPS Withdrawal', amount: 5000, status: 'SUCCESS', operator: 'Fingpay', commission: 10 },
            { id: 'TXN10002', created_at: new Date(Date.now() - 30 * 60000).toISOString(), service: 'AEPS Balance Inquiry', amount: 0, status: 'SUCCESS', operator: 'Fingpay', commission: 0.5 },
            { id: 'TXN10003', created_at: new Date(Date.now() - 120 * 60000).toISOString(), service: 'AEPS Mini Statement', amount: 0, status: 'SUCCESS', operator: 'Fingpay', commission: 1 },
            { id: 'TXN10004', created_at: new Date(Date.now() - 360 * 60000).toISOString(), service: 'AEPS Withdrawal', amount: 2000, status: 'FAILED', operator: 'Fingpay', commission: 0 }
        ],
        aeps_2: [
            { id: 'TXN20001', created_at: new Date(Date.now() - 15 * 60000).toISOString(), service: 'AEPS Withdrawal', amount: 3000, status: 'SUCCESS', operator: 'Levin', commission: 6 },
            { id: 'TXN20002', created_at: new Date(Date.now() - 45 * 60000).toISOString(), service: 'AEPS Balance Inquiry', amount: 0, status: 'SUCCESS', operator: 'Levin', commission: 0.5 },
            { id: 'TXN20003', created_at: new Date(Date.now() - 180 * 60000).toISOString(), service: 'AEPS Withdrawal', amount: 8000, status: 'SUCCESS', operator: 'Levin', commission: 12 },
            { id: 'TXN20004', created_at: new Date(Date.now() - 480 * 60000).toISOString(), service: 'AEPS Withdrawal', amount: 1500, status: 'FAILED', operator: 'Levin', commission: 0 }
        ],
        money_transfer: [
            { id: 'TXN30001', created_at: new Date(Date.now() - 5 * 60000).toISOString(), service: 'Money Transfer', amount: 15000, status: 'SUCCESS', operator: 'DMT', commission: 15 },
            { id: 'TXN30002', created_at: new Date(Date.now() - 25 * 60000).toISOString(), service: 'Money Transfer', amount: 2000, status: 'SUCCESS', operator: 'DMT', commission: 2 },
            { id: 'TXN30003', created_at: new Date(Date.now() - 90 * 60000).toISOString(), service: 'Money Transfer', amount: 5000, status: 'PENDING', operator: 'DMT', commission: 5 }
        ],
        move_to_bank: [
            { id: 'TXN40001', created_at: new Date(Date.now() - 50 * 60000).toISOString(), service: 'Move To Bank', amount: 25000, status: 'SUCCESS', operator: 'IMPS', commission: 0 },
            { id: 'TXN40002', created_at: new Date(Date.now() - 200 * 60000).toISOString(), service: 'Move To Bank', amount: 45000, status: 'SUCCESS', operator: 'NEFT', commission: 0 }
        ],
        airtel_cms: [
            { id: 'TXN50001', created_at: new Date(Date.now() - 60 * 60000).toISOString(), service: 'Airtel CMS', amount: 12450, status: 'SUCCESS', operator: 'Airtel', commission: 12.45 },
            { id: 'TXN50002', created_at: new Date(Date.now() - 300 * 60000).toISOString(), service: 'Airtel CMS', amount: 8900, status: 'SUCCESS', operator: 'Airtel', commission: 8.9 }
        ],
        fingpay_cms: [
            { id: 'TXN60001', created_at: new Date(Date.now() - 70 * 60000).toISOString(), service: 'Fingpay CMS', amount: 18200, status: 'SUCCESS', operator: 'Fingpay', commission: 18.2 },
            { id: 'TXN60002', created_at: new Date(Date.now() - 340 * 60000).toISOString(), service: 'Fingpay CMS', amount: 3500, status: 'SUCCESS', operator: 'Fingpay', commission: 3.5 }
        ],
        bbps_bill_pay: [
            { id: 'TXN70001', created_at: new Date(Date.now() - 40 * 60000).toISOString(), service: 'Electricity Bill', amount: 1250, status: 'SUCCESS', operator: 'UPPCL', commission: 2 },
            { id: 'TXN70002', created_at: new Date(Date.now() - 150 * 60000).toISOString(), service: 'Gas Bill', amount: 950, status: 'SUCCESS', operator: 'Indane Gas', commission: 1.5 },
            { id: 'TXN70003', created_at: new Date(Date.now() - 500 * 60000).toISOString(), service: 'Water Bill', amount: 450, status: 'SUCCESS', operator: 'Jal Board', commission: 1 }
        ],
        wallet: [
            { id: 'TXN80001', created_at: new Date(Date.now() - 8 * 60000).toISOString(), service: 'Wallet Topup', amount: 10000, status: 'SUCCESS', operator: 'UPI Gateway', commission: 0 },
            { id: 'TXN80002', created_at: new Date(Date.now() - 40 * 60000).toISOString(), service: 'Wallet Debit (DMT)', amount: 1515, status: 'SUCCESS', operator: 'Remittance', commission: 0 }
        ],
        wallet_to_wallet: [
            { id: 'TXN90001', created_at: new Date(Date.now() - 95 * 60000).toISOString(), service: 'Wallet Transfer Sent', amount: 500, status: 'SUCCESS', operator: 'W2W Transfer', commission: 0 },
            { id: 'TXN90002', created_at: new Date(Date.now() - 410 * 60000).toISOString(), service: 'Wallet Transfer Received', amount: 2000, status: 'SUCCESS', operator: 'W2W Transfer', commission: 0 }
        ],
        mobile_dth_recharge: [
            { id: 'TXN11001', created_at: new Date(Date.now() - 12 * 60000).toISOString(), service: 'Jio Prepaid Recharge', amount: 299, status: 'SUCCESS', operator: 'Jio', commission: 8.97 },
            { id: 'TXN11002', created_at: new Date(Date.now() - 55 * 60000).toISOString(), service: 'Airtel DTH Recharge', amount: 450, status: 'SUCCESS', operator: 'Airtel DTH', commission: 13.5 },
            { id: 'TXN11003', created_at: new Date(Date.now() - 190 * 60000).toISOString(), service: 'Vi Recharge', amount: 199, status: 'FAILED', operator: 'Vi', commission: 0 }
        ],
        aeps_cash_deposit: [
            { id: 'TXN12001', created_at: new Date(Date.now() - 110 * 60000).toISOString(), service: 'AEPS Cash Deposit', amount: 4000, status: 'SUCCESS', operator: 'SBI', commission: 8 },
            { id: 'TXN12002', created_at: new Date(Date.now() - 380 * 60000).toISOString(), service: 'AEPS Cash Deposit', amount: 1500, status: 'SUCCESS', operator: 'PNB', commission: 3 }
        ],
        micro_atm_transactions: [
            { id: 'TXN13001', created_at: new Date(Date.now() - 130 * 60000).toISOString(), service: 'Micro ATM Withdrawal', amount: 10000, status: 'SUCCESS', operator: 'mATM', commission: 15 },
            { id: 'TXN13002', created_at: new Date(Date.now() - 420 * 60000).toISOString(), service: 'Micro ATM Withdrawal', amount: 2500, status: 'SUCCESS', operator: 'mATM', commission: 5 }
        ],
        aadhaar_pay: [
            { id: 'TXN14001', created_at: new Date(Date.now() - 140 * 60000).toISOString(), service: 'Aadhaar Pay', amount: 12000, status: 'SUCCESS', operator: 'Aadhaar Pay', commission: 24 },
            { id: 'TXN14002', created_at: new Date(Date.now() - 460 * 60000).toISOString(), service: 'Aadhaar Pay', amount: 4500, status: 'SUCCESS', operator: 'Aadhaar Pay', commission: 9 }
        ],
        payment_gateway: [
            { id: 'TXN15001', created_at: new Date(Date.now() - 160 * 60000).toISOString(), service: 'PG Deposit', amount: 5000, status: 'SUCCESS', operator: 'Razorpay', commission: 0 },
            { id: 'TXN15002', created_at: new Date(Date.now() - 520 * 60000).toISOString(), service: 'PG Deposit', amount: 10000, status: 'SUCCESS', operator: 'Cashfree', commission: 0 }
        ],
        credit_card_bill: [
            { id: 'TXN16001', created_at: new Date(Date.now() - 170 * 60000).toISOString(), service: 'CC Bill Payment', amount: 15000, status: 'SUCCESS', operator: 'HDFC CC', commission: 15 },
            { id: 'TXN16002', created_at: new Date(Date.now() - 580 * 60000).toISOString(), service: 'CC Bill Payment', amount: 8000, status: 'SUCCESS', operator: 'SBI CC', commission: 8 }
        ],
        upi_cash_withdrawal: [
            { id: 'TXN17001', created_at: new Date(Date.now() - 180 * 60000).toISOString(), service: 'UPI Cash Withdrawal', amount: 1000, status: 'SUCCESS', operator: 'UPI QR', commission: 2 },
            { id: 'TXN17002', created_at: new Date(Date.now() - 610 * 60000).toISOString(), service: 'UPI Cash Withdrawal', amount: 2000, status: 'SUCCESS', operator: 'UPI QR', commission: 4 }
        ],
        my_earnings_report: [
            { id: 'TXN18001', created_at: new Date(Date.now() - 15 * 60000).toISOString(), service: 'Jio Recharge Comm.', amount: 299, status: 'SUCCESS', operator: 'Jio Comm', commission: 8.97 },
            { id: 'TXN18002', created_at: new Date(Date.now() - 30 * 60000).toISOString(), service: 'AEPS Withdrawal Comm.', amount: 5000, status: 'SUCCESS', operator: 'Fingpay Comm', commission: 10.00 },
            { id: 'TXN18003', created_at: new Date(Date.now() - 45 * 60000).toISOString(), service: 'DMT Transfer Comm.', amount: 15000, status: 'SUCCESS', operator: 'DMT Comm', commission: 15.00 },
            { id: 'TXN18004', created_at: new Date(Date.now() - 60 * 60000).toISOString(), service: 'mATM Withdrawal Comm.', amount: 10000, status: 'SUCCESS', operator: 'mATM Comm', commission: 15.00 }
        ]
    };
    return mockData[reportType] || [];
};

// ═══════════════════════════════════════════════════════════════════════════
// SPECIALIZED VIEWS
// ═══════════════════════════════════════════════════════════════════════════

const GstEInvoiceView = () => {
    const [month, setMonth] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetched, setFetched] = useState(false);
    const [gstData, setGstData] = useState(null);

    const gstMonths = [];
    const now = new Date();
    for (let i = -12; i <= 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        gstMonths.push(`${d.toLocaleString('default', { month: 'long' })}-${d.getFullYear()}`);
    }

    const handleFetch = async () => {
        if (!month) return;
        setLoading(true);
        setFetched(false);
        
        const user = dataService.getCurrentUser();
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            // Fetch all transactions for this user
            const txns = await dataService.getUserTransactions(user.id);
            const [selMonth, selYear] = month.split('-');
            
            // Filter transactions matching selected month and year
            const filtered = txns.filter(t => {
                const date = new Date(t.created_at || t.timestamp);
                return date.toLocaleString('default', { month: 'long' }) === selMonth && 
                       date.getFullYear().toString() === selYear;
            });

            // Calculate totals
            const commission = filtered.reduce((acc, t) => {
                return acc + (parseFloat(t.commission_amount || t.commission || 0));
            }, 0);

            // Calculation logic (Simulation of real taxation)
            const tds = commission * 0.01; // 1% TDS
            const gst = commission * 0.18; // 18% GST

            setGstData({
                businessName: user.business_name || user.name || "Business Name Not Set",
                gstinNumber: user.gstin || "NA",
                panNumber: user.pan || "NA",
                totalCommission: `₹ ${commission.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                totalTDS: `₹ ${tds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                totalGST: `₹ ${gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                placeOfSupply: user.state ? `${user.state}` : "NA",
                lastDate: `28th of next month`,
                count: filtered.length
            });
        } catch (e) {
            console.error("GST Fetch Error:", e);
        } finally {
            setLoading(false);
            setFetched(true);
        }
    };

    const user = dataService.getCurrentUser();
    const hasGst = user?.gstin && user.gstin !== 'NA';

    return (
        <div className="p-4 md:p-8 space-y-6 bg-[#f1f5f9] min-h-[80vh]">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                <div className={fetched ? "xl:col-span-5" : "xl:col-span-6 xl:col-start-4"}>
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl p-8 relative overflow-hidden transition-all duration-500">
                        <div className="absolute -right-8 -top-8 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl"></div>
                        <div className="relative z-10 space-y-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-black text-cyan-600 tracking-tight">GST E-Invoice</h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] mt-1">Tax Management Portal</p>
                                </div>
                                <Icon3D icon={FileText} color="#0891b2" size={24} />
                            </div>
                            
                            {!hasGst ? (
                                <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl px-5 py-4 flex items-center gap-3 text-xs font-bold shadow-inner">
                                    <AlertCircle size={18} />
                                    GSTIN number not found in your profile
                                </div>
                            ) : (
                                <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl px-5 py-4 flex items-center gap-3 text-xs font-bold shadow-inner">
                                    <CheckCircle size={18} />
                                    Active GSTIN: {user.gstin}
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Invoice Month</label>
                                <div className="relative group">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-cyan-500 transition-colors" size={18} />
                                    <select
                                        value={month}
                                        onChange={(e) => setMonth(e.target.value)}
                                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-sm font-black text-slate-700 outline-none focus:bg-white focus:border-cyan-500/20 focus:ring-4 focus:ring-cyan-500/5 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Choose Month</option>
                                        {gstMonths.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleFetch}
                                disabled={loading || !month}
                                className="w-full bg-slate-900 hover:bg-cyan-600 text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-[2px] shadow-2xl transition-all disabled:opacity-40 active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                {loading ? 'Processing...' : <><Search size={16} /> Fetch Details</>}
                            </button>
                        </div>
                    </div>
                </div>

                {fetched && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                        className="xl:col-span-7"
                    >
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl p-8 h-full relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl -mr-24 -mt-24"></div>
                            <div className="relative z-10 h-full flex flex-col">
                                {gstData.count === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-10">
                                        <span className="text-7xl grayscale opacity-40">😔</span>
                                        <div className="text-center space-y-2">
                                            <h3 className="text-xl font-black text-slate-800 tracking-tight">No Sales History</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[2px]">No transactions found for {month}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-start justify-between mb-8 pb-6 border-b border-slate-100">
                                            <div>
                                                <h2 className="text-xl font-black text-slate-800 tracking-tight">GSTIN Detail</h2>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Generated for {month}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-rose-500 uppercase tracking-wider italic">Last Date To File</p>
                                                <p className="text-xs font-black text-slate-800 tracking-tight">{gstData.lastDate}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-x-10 gap-y-7">
                                            {[
                                                { label: 'Business Name', value: gstData.businessName },
                                                { label: 'GSTIN Number', value: gstData.gstinNumber },
                                                { label: 'Pan Number', value: gstData.panNumber },
                                                { label: 'Commission', value: gstData.totalCommission, color: 'text-orange-600' },
                                                { label: 'TDS (1%)', value: gstData.totalTDS },
                                                { label: 'GST Amount', value: gstData.totalGST, color: 'text-emerald-600' },
                                                { label: 'Place of Supply', value: gstData.placeOfSupply, span: true }
                                            ].map((item, i) => (
                                                <div key={i} className={item.span ? 'col-span-2' : ''}>
                                                    <p className="text-[10px] font-black text-cyan-600/60 uppercase tracking-widest mb-1.5">{item.label}</p>
                                                    <p className={`text-[13px] font-black ${item.color || 'text-slate-800'} tracking-tight`}>{item.value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-auto pt-10 flex gap-4">
                                            <button className="flex-1 bg-slate-50 hover:bg-white border border-slate-200 py-4 rounded-xl text-[10px] font-black uppercase tracking-[2px] text-slate-600 transition-all flex items-center justify-center gap-2">
                                                <Download size={14} /> Download PDF
                                            </button>
                                            <button className="flex-1 bg-slate-50 hover:bg-white border border-slate-200 py-4 rounded-xl text-[10px] font-black uppercase tracking-[2px] text-slate-600 transition-all flex items-center justify-center gap-2">
                                                <Share2 size={14} /> Share Report
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* ── GST E-Invoice Report History Table ── */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden mt-8"
            >
                <div className="bg-slate-50/50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-[3px] flex items-center gap-3">
                            <FileText size={18} className="text-cyan-600" />
                            GST E-Invoice Report
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-7">Consolidated Monthly Summary</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/30">
                                {[
                                    'Invoice date', 'Total Invoices Count', 'Total Invoices Approved', 
                                    'Total Amount', 'Total Txn. Count', 'Total Tax Amount', 
                                    'Total CGST', 'Total SGST', 'Total IGST', 'Total Approved Amount', 
                                    'Status', 'Action'
                                ].map((h, i) => (
                                    <th key={i} className={`px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[1.5px] border-b border-slate-100 ${i > 0 ? 'text-center' : ''}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {(!gstData || gstData.count === 0) ? (
                                <tr>
                                    <td colSpan={12} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center gap-6">
                                            <span className="text-8xl grayscale opacity-30">😔</span>
                                            <div className="space-y-2">
                                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">No Report Logs</h3>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[4px]">no data found</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <tr className="hover:bg-cyan-50/20 transition-colors">
                                    <td className="px-6 py-5 text-[11px] font-black text-slate-700">{month}</td>
                                    <td className="px-6 py-5 text-center text-[11px] font-bold text-slate-500">1</td>
                                    <td className="px-6 py-5 text-center text-[11px] font-bold text-slate-500">1</td>
                                    <td className="px-6 py-5 text-center text-[11px] font-black text-slate-800">{gstData.totalCommission}</td>
                                    <td className="px-6 py-5 text-center text-[11px] font-bold text-slate-500">{gstData.count}</td>
                                    <td className="px-6 py-5 text-center text-[11px] font-black text-emerald-600">{gstData.totalGST}</td>
                                    <td className="px-6 py-5 text-center text-[11px] font-bold text-slate-500">₹ {(parseFloat(gstData.totalGST.replace('₹ ', '').replace(/,/g, '')) / 2).toFixed(2)}</td>
                                    <td className="px-6 py-5 text-center text-[11px] font-bold text-slate-500">₹ {(parseFloat(gstData.totalGST.replace('₹ ', '').replace(/,/g, '')) / 2).toFixed(2)}</td>
                                    <td className="px-6 py-5 text-center text-[11px] font-bold text-slate-400">0.00</td>
                                    <td className="px-6 py-5 text-center text-[11px] font-black text-slate-800">{gstData.totalCommission}</td>
                                    <td className="px-6 py-5 text-center">
                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-600 text-[9px] font-black uppercase rounded-lg">Approved</span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <button className="text-cyan-600 hover:text-cyan-700 transition-colors">
                                            <Download size={16} />
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
};

const ConsolidatedLedgerView = () => {
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [ledgerData, setLedgerData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        setLoading(true);
        setHasSearched(true);
        const user = dataService.getCurrentUser();
        if (user) {
            try {
                const res = await dataService.fetchSales(user.id, fromDate); 
                const txns = res?.success ? (res.transactions || []) : (Array.isArray(res) ? res : []);
                setLedgerData(txns);
            } catch (e) { setLedgerData([]); }
        }
        setLoading(false);
    };

    const filtered = (Array.isArray(ledgerData) ? ledgerData : []).filter(row => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (row.description || '').toLowerCase().includes(s) || 
               String(row.id || '').includes(s) ||
               (row.type || '').toLowerCase().includes(s);
    });

    const totalDr = filtered.reduce((acc, row) => acc + (row.type?.toLowerCase().includes('debit') ? parseFloat(row.amount || 0) : 0), 0);
    const totalCr = filtered.reduce((acc, row) => acc + (row.type?.toLowerCase().includes('credit') ? parseFloat(row.amount || 0) : 0), 0);
    const finalBalance = filtered.length > 0 ? filtered[filtered.length - 1].balance_after : 0;

    return (
        <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-[80vh] font-['Inter',sans-serif]">
            <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden">
                <div className="bg-[#1e3a8a] px-8 py-5 flex items-center gap-3">
                    <FileText className="text-white/60" size={20} />
                    <h2 className="text-sm font-black text-white uppercase tracking-[3px]">Consolidated Ledger</h2>
                </div>
                
                <div className="p-8 space-y-6">
                    <div className="flex flex-wrap items-end gap-6 justify-between">
                        <div className="flex flex-wrap items-center gap-8">
                            {[{ label: 'From', val: fromDate, set: setFromDate }, { label: 'To', val: toDate, set: setToDate }].map((d, i) => (
                                <div key={i} className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">{d.label} Date</label>
                                    <div className="flex border-2 border-slate-50 rounded-2xl overflow-hidden bg-slate-50 focus-within:bg-white focus-within:border-blue-500/20 transition-all">
                                        <div className="px-4 py-3.5 border-r border-slate-200 flex items-center justify-center text-slate-400">
                                            <Calendar size={18} />
                                        </div>
                                        <input type="date" value={d.val} onChange={e => d.set(e.target.value)} className="px-5 py-3.5 text-xs font-black outline-none bg-transparent text-slate-700" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button 
                            onClick={handleSearch} 
                            disabled={loading}
                            className="bg-[#1e3a8a] text-white px-12 h-14 rounded-2xl text-[11px] font-black uppercase tracking-[2px] hover:bg-blue-900 transition-all shadow-xl shadow-blue-900/10 active:scale-95 disabled:opacity-50"
                        >
                            {loading ? 'Compiling...' : 'Search Ledger'}
                        </button>
                    </div>
                    <p className="text-[10px] text-amber-600 font-bold italic flex items-center gap-1.5">
                        <AlertCircle size={12} />
                        Note: Date range must be within 30 days for optimal performance.
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-3">
                    {['Xlsx', 'PDF'].map(t => (
                        <button key={t} className="bg-slate-900 text-white h-11 px-5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95">
                            {t} <Download size={14} />
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Filter current view..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-slate-300" />
                </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-50">
                                {['V. date', 'Particulars', 'Dr.', 'Cr.', 'Balance'].map((h, i) => (
                                    <th key={i} className={`px-8 py-5 text-[10px] font-extrabold text-slate-400 uppercase tracking-[2px] ${i > 1 ? 'text-right' : ''}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {!hasSearched ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center">
                                                <Calendar className="text-slate-300" size={32} />
                                            </div>
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Select dates to view ledger activity</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-32 text-center">
                                        <div className="flex flex-col items-center gap-6">
                                            <span className="text-8xl grayscale opacity-50">😔</span>
                                            <div className="space-y-2">
                                                <h3 className="text-xl font-black text-slate-800 tracking-tight">No Transactions Found</h3>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No activity recorded for this period</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    <tr className="bg-blue-50/20 group hover:bg-blue-50/40 transition-colors">
                                        <td className="px-8 py-5 text-[11px] font-bold text-slate-400">{new Date(fromDate).toLocaleDateString('en-GB').replace(/\//g, '-')}</td>
                                        <td className="px-8 py-5 text-[11px] font-black text-slate-800 uppercase tracking-tight">Opening Balance Brought Forward</td>
                                        <td className="px-8 py-5 text-right text-[11px] font-bold text-slate-400">0.00</td>
                                        <td className="px-8 py-5 text-right text-[11px] font-bold text-slate-400">0.00</td>
                                        <td className="px-8 py-5 text-right text-[11px] font-black text-slate-800 tracking-tight">0.00 Cr.</td>
                                    </tr>
                                    {filtered.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-8 py-5 text-[11px] font-bold text-slate-505 whitespace-nowrap">{new Date(row.created_at || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '-')}</td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight group-hover:text-blue-600 transition-colors">{row.description || 'Service Transaction'}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">REF: #{row.id}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right text-[11px] font-black text-rose-600 tracking-tight">{row.type?.toLowerCase().includes('debit') ? parseFloat(row.amount || 0).toFixed(2) : '0.00'}</td>
                                            <td className="px-8 py-5 text-right text-[11px] font-black text-emerald-600 tracking-tight">{row.type?.toLowerCase().includes('credit') ? parseFloat(row.amount || 0).toFixed(2) : '0.00'}</td>
                                            <td className="px-8 py-5 text-right text-[11px] font-black text-slate-800 tracking-tight">
                                                {parseFloat(row.balance_after || 0).toFixed(2)} {(row.balance_after || 0) >= 0 ? 'Cr.' : 'Dr.'}
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            )}
                        </tbody>
                        {filtered.length > 0 && (
                            <tfoot className="border-t-2 border-slate-50">
                                <tr className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest">
                                    <td className="px-8 py-6" colSpan={2}>Grand Total Statistics</td>
                                    <td className="px-8 py-6 text-right text-rose-400 font-extrabold text-sm">₹ {totalDr.toFixed(2)}</td>
                                    <td className="px-8 py-6 text-right text-emerald-400 font-extrabold text-sm">₹ {totalCr.toFixed(2)}</td>
                                    <td className="px-8 py-6 text-right text-white font-extrabold text-sm">₹ {parseFloat(finalBalance).toFixed(2)} {finalBalance >= 0 ? 'Cr.' : 'Dr.'}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

const DailyLedgerView = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        setLoading(true);
        setHasSearched(true);
        const user = dataService.getCurrentUser();
        if (user) {
            try {
                const res = await dataService.fetchSales(user.id, date);
                const txns = res?.success ? (res.transactions || []) : (Array.isArray(res) ? res : []);
                setData(txns);
            } catch (e) { setData([]); }
        }
        setLoading(false);
    };

    const filtered = (Array.isArray(data) ? data : []).filter(r => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (r.description || '').toLowerCase().includes(s) || 
               String(r.id || '').includes(s) ||
               (r.type || '').toLowerCase().includes(s);
    });

    return (
        <div className="p-4 md:p-8 space-y-6 bg-[#f1f5f9] min-h-[80vh] font-['Inter',sans-serif]">
            <div className="bg-slate-900 rounded-[2rem] px-8 py-6 flex items-center justify-between shadow-2xl overflow-hidden relative">
                <div className="absolute left-0 top-0 w-64 h-full bg-blue-600/10 blur-3xl -ml-20"></div>
                <div className="relative z-10">
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <span className="text-blue-400 italic font-medium uppercase tracking-[4px] text-xs self-center">Live</span>
                        Daily Ledger
                    </h2>
                </div>
                <Icon3D icon={Clock} color="#2563eb" size={24} />
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex flex-wrap items-end gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Select Statement Date</label>
                        <div className="relative group w-full md:w-64">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" size={18} />
                            <input 
                                type="date" 
                                value={date} 
                                onChange={e => setDate(e.target.value)} 
                                className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-[13px] font-black text-slate-700 outline-none focus:bg-white focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 transition-all" 
                            />
                        </div>
                    </div>
                    <button 
                        onClick={handleSearch} 
                        disabled={loading} 
                        className="bg-slate-900 hover:bg-blue-600 text-white h-[60px] px-12 rounded-2xl text-[11px] font-black uppercase tracking-[2px] shadow-xl transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Fetching...' : 'View Records'}
                    </button>
                    <div className="flex-1"></div>
                    <div className="flex items-center gap-3">
                        {['Xlsx', 'PDF'].map(t => (
                            <button key={t} className="bg-white border border-slate-200 text-slate-600 h-14 px-6 rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:border-slate-400 hover:text-slate-900 transition-all shadow-sm active:scale-95">
                                {t} <Printer size={16} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="px-4 py-2 bg-blue-50 rounded-full text-[10px] font-black text-blue-600 uppercase tracking-wider inline-block">
                        Total {filtered.length} Records Found
                    </div>
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records by ID..." className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-2xl text-[11px] font-bold focus:bg-white focus:border-blue-500/10 outline-none transition-all placeholder:text-slate-300" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                {['Transaction Date', 'Ref. TXN ID', 'Service Particulars', 'Debit (Dr.)', 'Credit (Cr.)', 'Running Balance'].map((h, i) => (
                                    <th key={i} className={`px-8 py-5 text-[10px] font-extrabold text-slate-400 uppercase tracking-[2.5px] ${i > 2 ? 'text-right' : ''}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {!hasSearched ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-50">
                                            <Calendar size={48} className="text-slate-300" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[3px]">Choose a date to load audit logs</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-32 text-center">
                                        <div className="flex flex-col items-center gap-6">
                                            <span className="text-8xl grayscale-0">😔</span>
                                            <div className="space-y-2">
                                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Statement Empty</h3>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[3px] mt-1">No transaction history found for selected date</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    <tr className="bg-emerald-50/20">
                                        <td colSpan={2}></td>
                                        <td className="px-8 py-4 text-[11px] font-black text-emerald-600 uppercase tracking-tight">Brought Forward (Opening)</td>
                                        <td className="px-8 py-4 text-[11px] text-slate-300 text-right">-</td>
                                        <td className="px-8 py-4 text-[11px] text-slate-300 text-right">-</td>
                                        <td className="px-8 py-4 text-[13px] font-black text-slate-800 text-right tracking-tight">
                                           ₹ {parseFloat((filtered[0]?.balance_after || 0) - (filtered[0]?.amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                    {filtered.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-8 py-6 text-[11px] font-bold text-slate-500 italic">{new Date(row.created_at || Date.now()).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' })}</td>
                                            <td className="px-8 py-6">
                                                <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">#{row.id}</span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight leading-tight">{row.description || 'System Utility'}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[2px] mt-1">{row.type}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right font-black text-[13px] text-rose-600 tracking-tight">{row.type?.toLowerCase().includes('credit') ? '-' : `₹ ${parseFloat(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</td>
                                            <td className="px-8 py-6 text-right font-black text-[13px] text-emerald-600 tracking-tight">{row.type?.toLowerCase().includes('credit') ? `₹ ${parseFloat(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
                                            <td className="px-8 py-6 text-sm font-black text-slate-800 text-right tracking-tight">₹ {parseFloat(row.balance_after || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-blue-50/30 border-t border-blue-100">
                                        <td colSpan={2}></td>
                                        <td className="px-8 py-5 text-[11px] font-black text-blue-600 uppercase tracking-[2px]">Carried Forward (Closing)</td>
                                        <td className="px-8 py-5 text-[11px] text-slate-300 text-right">-</td>
                                        <td className="px-8 py-5 text-[11px] text-slate-300 text-right">-</td>
                                        <td className="px-8 py-5 text-lg font-black text-blue-700 text-right tracking-tighter">
                                           ₹ {parseFloat(filtered[filtered.length - 1]?.balance_after || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN REPORTS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Reports = () => {
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [salesData, setSalesData] = useState(null);
    const location = useLocation();
    
    // Hooks must be at the top level
    const queryParams = new URLSearchParams(location.search);
    const reportType = queryParams.get('report') || 'all';

    useEffect(() => {
        const fetchBaseData = async () => {
            setLoading(true);
            const user = dataService.getCurrentUser();
            if (user) {
                try {
                    const txns = await dataService.getUserTransactions(user.id);
                    setTransactions(txns || []);
                } catch (e) { setTransactions([]); }
            }
            setLoading(false);
        };
        fetchBaseData();
    }, [reportType]);

    const reportConfigs = {
        all: { title: "Audit Reports", subtitle: "Comprehensive transaction logs", color: "#4a148c", icon: FileText },
        sale_report: { title: "Executive Sales", subtitle: "Daily revenue performance", color: "#059669", icon: FileText },
        
        aeps_1: { title: "AEPS 1 History", subtitle: "Fingpay Aadhaar Enabled Payment System transaction logs", color: "#2563eb", icon: Fingerprint },
        aeps_2: { title: "AEPS 2 History", subtitle: "Levin Aadhaar Enabled Payment System transaction logs", color: "#4f46e5", icon: Fingerprint },
        money_transfer: { title: "Money Transfer History", subtitle: "Domestic money remittance transactions", color: "#0d9488", icon: IndianRupee },
        move_to_bank: { title: "Move To Bank Logs", subtitle: "Settlements to registered bank accounts", color: "#0284c7", icon: Landmark },
        airtel_cms: { title: "Airtel CMS History", subtitle: "Airtel Cash Management Services transaction logs", color: "#dc2626", icon: FileText },
        fingpay_cms: { title: "Fingpay CMS History", subtitle: "Fingpay Cash Management Services transaction logs", color: "#ea580c", icon: FileText },
        bbps_bill_pay: { title: "BBPS Bill Payments", subtitle: "Bharat Bill Payment System transaction logs", color: "#2563eb", icon: RefreshCw },
        wallet: { title: "Wallet Ledger", subtitle: "Wallet deposits, top-ups, and debit logs", color: "#4f46e5", icon: Coins },
        wallet_to_wallet: { title: "Wallet To Wallet", subtitle: "Inter-wallet fund transfer transaction logs", color: "#0891b2", icon: Coins },
        mobile_dth_recharge: { title: "Mobile & DTH Recharge", subtitle: "Mobile top-ups and DTH connection recharge history", color: "#059669", icon: Smartphone },
        aeps_cash_deposit: { title: "AEPS Cash Deposits", subtitle: "Aadhaar cash deposit transaction history", color: "#0891b2", icon: Fingerprint },
        micro_atm_transactions: { title: "Micro ATM Transactions", subtitle: "Micro ATM card withdrawal logs", color: "#1e293b", icon: FileText },
        aadhaar_pay: { title: "Aadhaar Pay Transactions", subtitle: "Aadhaar Pay merchant payment logs", color: "#4f46e5", icon: Fingerprint },
        payment_gateway: { title: "Payment Gateway Logs", subtitle: "Online payment gateway deposit transactions", color: "#0ea5e9", icon: Coins },
        credit_card_bill: { title: "Credit Card Bill Payments", subtitle: "Credit card bill payment transaction logs", color: "#059669", icon: CreditCard },
        upi_cash_withdrawal: { title: "UPI Cash Withdrawal", subtitle: "UPI QR and cardless cash withdrawal logs", color: "#0d9488", icon: IndianRupee },
        my_earnings_report: { title: "My Earnings Report", subtitle: "Commission earned across all banking and utility services", color: "#059669", icon: ArrowUpRight }
    };

    const currentConfig = reportConfigs[reportType] || reportConfigs.all;

    // Derived State and Filtering logic
    const rawTxns = transactions.length > 0 ? transactions : generateMockTransactions(reportType);

    const filteredTxns = rawTxns.filter((txn) => {
        // If we are using the live transactions array, we filter it by category
        if (transactions.length > 0 && reportType !== 'all') {
            const service = String(txn.service || '').toLowerCase();
            const txnType = String(txn.type || '').toLowerCase();
            const operator = String(txn.operator || '').toLowerCase();
            const description = String(txn.description || '').toLowerCase();
            
            switch (reportType) {
                case 'aeps_1':
                    if (!((service.includes('aeps') && (service.includes('fingpay') || operator.includes('fingpay') || service.includes('1'))) || description.includes('fingpay') || description.includes('aeps1'))) return false;
                    break;
                case 'aeps_2':
                    if (!((service.includes('aeps') && (service.includes('levin') || operator.includes('levin') || service.includes('2'))) || description.includes('levin') || description.includes('aeps2'))) return false;
                    break;
                case 'money_transfer':
                    if (!(service.includes('transfer') || service.includes('dmt') || service.includes('money') || service.includes('remit') || description.includes('dmt') || description.includes('transfer'))) return false;
                    break;
                case 'move_to_bank':
                    if (!(service.includes('move to bank') || service.includes('payout') || service.includes('settlement') || service.includes('move_to_bank') || description.includes('move to bank') || description.includes('payout'))) return false;
                    break;
                case 'airtel_cms':
                    if (!(service.includes('airtel') && service.includes('cms'))) return false;
                    break;
                case 'fingpay_cms':
                    if (!(service.includes('fingpay') && service.includes('cms'))) return false;
                    break;
                case 'bbps_bill_pay':
                    if (!(service.includes('bill') || service.includes('bbps') || service.includes('utility') || description.includes('bill') || description.includes('bbps'))) return false;
                    break;
                case 'wallet':
                    if (!(service.includes('wallet') || txnType.includes('wallet') || service.includes('deposit') || service.includes('withdrawal') || description.includes('wallet'))) return false;
                    break;
                case 'wallet_to_wallet':
                    if (!(service.includes('wallet to wallet') || service.includes('w2w') || service.includes('wallet_to_wallet') || description.includes('w2w') || description.includes('wallet to wallet'))) return false;
                    break;
                case 'mobile_dth_recharge':
                    if (!(service.includes('recharge') || service.includes('mobile') || service.includes('dth') || service.includes('topup') || description.includes('recharge') || description.includes('mobile'))) return false;
                    break;
                case 'aeps_cash_deposit':
                    if (!(service.includes('deposit') && service.includes('aeps'))) return false;
                    break;
                case 'micro_atm_transactions':
                    if (!(service.includes('matm') || service.includes('micro atm') || service.includes('atm') || description.includes('matm') || description.includes('micro atm'))) return false;
                    break;
                case 'aadhaar_pay':
                    if (!(service.includes('aadhaar pay') || service.includes('aadhaarpay') || description.includes('aadhaar pay') || description.includes('aadhaarpay'))) return false;
                    break;
                case 'payment_gateway':
                    if (!(service.includes('pg') || service.includes('gateway') || service.includes('payment gateway') || description.includes('pg') || description.includes('gateway'))) return false;
                    break;
                case 'credit_card_bill':
                    if (!(service.includes('credit card') || service.includes('cc bill') || service.includes('card bill') || description.includes('credit card'))) return false;
                    break;
                case 'upi_cash_withdrawal':
                    if (!(service.includes('upi cash') || service.includes('upi withdrawal') || (service.includes('upi') && service.includes('withdrawal')) || description.includes('upi cash'))) return false;
                    break;
                case 'my_earnings_report':
                    if (!(parseFloat(txn.commission_amount || txn.commission || 0) > 0 || service.includes('commission') || service.includes('earning'))) return false;
                    break;
                case 'sale_report':
                    break;
                default:
                    break;
            }
        }

        const matchesSearch = 
            String(txn.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(txn.service || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(txn.operator || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = activeTab === 'all' || txn.status?.toUpperCase() === activeTab.toUpperCase();
        return matchesSearch && matchesTab;
    });

    const handleFetchSales = async () => {
        setLoading(true);
        const user = dataService.getCurrentUser();
        if (user) {
            try {
                const res = await dataService.fetchSales(user.id, selectedDate);
                const data = res?.success ? (res.transactions || []) : (Array.isArray(res) ? res : []);
                setSalesData(data);
            } catch (e) { setSalesData([]); }
        }
        setLoading(false);
    };

    const tabs = [
        { id: 'all', label: 'All Audits', icon: FileText },
        { id: 'SUCCESS', label: 'Successful', icon: CheckCircle },
        { id: 'PENDING', label: 'Pending', icon: Clock },
        { id: 'FAILED', label: 'Failed', icon: AlertCircle },
    ];

    // Early Returns for specialized views
    if (['gst_einvoice', 'gst_einvoice_report', 'gstin_invoice', 'cons_gstin_invoice'].includes(reportType)) {
        return <GstEInvoiceView />;
    }
    if (reportType === 'consolidated_ledger') {
        return <ConsolidatedLedgerView />;
    }
    if (reportType === 'daily_ledger') {
        return <DailyLedgerView />;
    }

    // Default: Audit / Sale Report / Transaction History View
    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-20 font-['Inter',sans-serif]">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-64 bg-[#4a148c]/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="flex items-center gap-6 relative z-10">
                    <Icon3D icon={currentConfig.icon || FileText} color={currentConfig.color || '#4a148c'} size={28} />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[5px] mb-1.5 opacity-60" style={{ color: currentConfig.color || '#4a148c' }}>Operations Intelligence</p>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">{currentConfig.title}</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{currentConfig.subtitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 relative z-10">
                    <button className="flex items-center gap-3 px-8 h-14 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[3px] shadow-2xl hover:bg-black transition-all active:scale-95 group">
                        <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />
                        Master Export
                    </button>
                    <button onClick={() => window.location.reload()}
                        className="w-14 h-14 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-center hover:shadow-md transition-all active:rotate-180 hover:border-[#4a148c]">
                        <RefreshCw size={22} className="text-[#4a148c]" />
                    </button>
                </div>
            </div>

            {reportType === 'sale_report' ? (
                <div className="space-y-8">
                    {/* ── Sale Date Picker ── */}
                    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="space-y-2 flex-1 md:flex-none">
                                <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Daily Performance Date</label>
                                <div className="relative group w-full md:w-80">
                                    <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-emerald-500 transition-colors" size={20} />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-full h-16 pl-14 pr-6 bg-slate-50 border-2 border-slate-50 rounded-2xl text-[14px] font-black text-slate-700 outline-none focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleFetchSales}
                                disabled={loading}
                                className="h-16 px-12 bg-emerald-600 text-white rounded-2xl text-[12px] font-black uppercase tracking-[3px] shadow-xl shadow-emerald-500/10 hover:bg-emerald-700 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 mt-auto md:mt-0"
                            >
                                {loading ? 'Analyzing...' : 'Generate Report'}
                            </button>
                        </div>
                    </div>

                    {/* ── Results ── */}
                    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-sm min-h-[400px] flex items-center justify-center relative overflow-hidden">
                        <AnimatePresence mode="wait">
                            {loading ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-[11px] font-black uppercase tracking-[4px] text-slate-400">Syncing sales cloud...</p>
                                </motion.div>
                            ) : salesData === null ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
                                    <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto">
                                        <Search size={40} className="text-slate-200" />
                                    </div>
                                    <p className="text-[11px] font-black text-slate-300 uppercase tracking-[4px]">Query a date to see volume details</p>
                                </motion.div>
                            ) : salesData.length === 0 ? (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-8">
                                    <span className="text-9xl filter grayscale opacity-60">😔</span>
                                    <div className="text-center space-y-3">
                                        <h3 className="text-3xl font-black text-slate-800 tracking-tight">Zero Sales Found</h3>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[3px] leading-relaxed"> No transactions recorded for {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-slate-50">
                                                    {['ID', 'Timestamp', 'Particulars', 'Amount (INR)', 'Status'].map(h => (
                                                        <th key={h} className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[3px]">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {salesData.map((t) => (
                                                    <tr key={t.id} className="hover:bg-emerald-50/20 transition-colors group">
                                                        <td className="px-8 py-6">
                                                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-all">#{t.id}</span>
                                                        </td>
                                                        <td className="px-8 py-6 whitespace-nowrap">
                                                            <span className="text-[11px] font-bold text-slate-600">{new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{t.type}</span>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <div className="text-[15px] font-black text-slate-800 tracking-tighter">
                                                                ₹{parseFloat(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <StatusBadge status={t.status} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-slate-900 text-white font-black uppercase text-[11px] tracking-[3px]">
                                                    <td colSpan="3" className="px-8 py-8 text-right opacity-60">Daily Volume Summation</td>
                                                    <td colSpan="2" className="px-8 py-8 text-left text-2xl font-black text-emerald-400 tracking-tighter">
                                                        ₹{salesData.reduce((acc, curr) => acc + parseFloat(curr.amount), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            ) : (
                <>
                    {/* ── Stats Row ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { 
                                label: reportType === 'my_earnings_report' ? 'Total Earnings' : 'Cumulative Sales', 
                                val: filteredTxns.reduce((acc, t) => acc + parseFloat((reportType === 'my_earnings_report' ? (t.commission || t.commission_amount || 0) : (t.amount || 0))), 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }), 
                                icon: reportType === 'my_earnings_report' ? Coins : IndianRupee, 
                                col: currentConfig.color || '#4a148c' 
                            },
                            { label: 'Platform Success', val: filteredTxns.length > 0 ? '100%' : 'N/A', icon: CheckCircle, col: '#10b981' },
                            { label: 'Total Records', val: filteredTxns.length, icon: FileText, col: '#0ea5e9' },
                            { label: 'Critical Errors', val: '0', icon: Clock, col: '#f43f5e' },
                        ].map((s, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                                className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
                            >
                                <div className="absolute right-0 top-0 w-24 h-24 rounded-full blur-3xl opacity-5" style={{ backgroundColor: s.col }}></div>
                                <div className="flex items-center justify-between mb-4 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all" style={{ background: `${s.col}10` }}>
                                        <s.icon size={22} style={{ color: s.col }} />
                                    </div>
                                    <ArrowUpRight className="text-slate-200 group-hover:text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" size={18} />
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[3px]">{s.label}</p>
                                <p className="text-xl font-black text-slate-800 mt-1 tracking-tighter">{s.val}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* ── Main Data View ── */}
                    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-4 shadow-sm space-y-6">
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 p-4">
                            <div className="flex p-2 bg-slate-50/80 rounded-2xl border border-slate-100 w-full lg:w-auto overflow-x-auto no-scrollbar shadow-inner">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[2.5px] transition-all whitespace-nowrap"
                                        style={{
                                            backgroundColor: activeTab === tab.id ? (currentConfig.color || '#4a148c') : 'transparent',
                                            color: activeTab === tab.id ? '#white' : '#94a3b8'
                                        }}
                                    >
                                        <tab.icon size={14} className={activeTab === tab.id ? 'text-white' : ''} />
                                        <span className={activeTab === tab.id ? 'text-white' : ''}>{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-3 w-full lg:w-auto">
                                <div className="relative flex-1 lg:w-80">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Quick lookup by Transaction ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-[11px] font-black focus:bg-white focus:border-[#4a148c20] outline-none transition-all placeholder:text-slate-300"
                                    />
                                </div>
                                <button className="p-4 bg-slate-50 border border-transparent rounded-2xl text-slate-400 hover:bg-white hover:border-[#4a148c40] hover:text-[#4a148c] transition-all shadow-sm active:scale-95">
                                    <Filter size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-50">
                                        {(reportType === 'my_earnings_report'
                                            ? ['Transaction Profile', 'Chronology', 'Domain/Service', 'Txn Amount', 'Commission Earned', 'Status']
                                            : ['Transaction Profile', 'Chronology', 'Domain/Service', 'Quantum', 'Progress', 'Ops']
                                        ).map((h, i) => (
                                            <th key={h} className={`px-8 py-5 text-[10px] font-black text-slate-300 uppercase tracking-[3px] ${i === 5 ? 'text-center' : 'text-left'}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    <AnimatePresence mode="popLayout">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="6" className="px-8 py-32 text-center">
                                                    <div className="flex flex-col items-center gap-4">
                                                        <div className="w-12 h-12 border-4 border-[#4a148c20] border-t-[#4a148c] rounded-full animate-spin"></div>
                                                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[5px]">Compiling Logs...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredTxns.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-8 py-32 text-center">
                                                    <div className="flex flex-col items-center gap-8">
                                                        <span className="text-9xl grayscale opacity-40">😔</span>
                                                        <div className="space-y-2">
                                                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">No Transactions Found</h3>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[3px]">No matching records exist in current scope</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTxns.map((t) => (
                                                <motion.tr
                                                    key={t.id}
                                                    layout
                                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                    className="hover:bg-[#4a148c03] transition-colors group cursor-default"
                                                >
                                                    <td className="px-8 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest group-hover:text-[#4a148c] transition-colors">#{t.id}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">CORE-TXN-SYS</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-bold text-slate-600 tracking-tight">{new Date(t.timestamp || t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{new Date(t.timestamp || t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-white transition-colors relative">
                                                                {t.service?.toLowerCase().includes('recharge') ? <Smartphone size={16} className="text-blue-500" /> :
                                                                    t.service?.toLowerCase().includes('bill') ? <RefreshCw size={16} className="text-orange-500" /> :
                                                                        t.service?.toLowerCase().includes('aeps') ? <Fingerprint size={16} className="text-emerald-500" /> :
                                                                            <Coins size={16} className="text-purple-500" />}
                                                            </div>
                                                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-[2px]">{t.service || 'Utility'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="text-[15px] font-black text-slate-800 tracking-tighter">
                                                            ₹{(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </div>
                                                    </td>
                                                    {reportType === 'my_earnings_report' ? (
                                                        <td className="px-8 py-6">
                                                            <div className="text-[15px] font-black text-emerald-600 tracking-tighter">
                                                                + ₹{(t.commission || t.commission_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                            </div>
                                                        </td>
                                                    ) : null}
                                                    <td className="px-8 py-6">
                                                        <StatusBadge status={t.status} />
                                                    </td>
                                                    {reportType !== 'my_earnings_report' ? (
                                                        <td className="px-8 py-6 text-center">
                                                            <button className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-[#4a148c] flex items-center justify-center hover:bg-white hover:border-[#4a148c] hover:shadow-lg transition-all active:scale-90">
                                                                <Printer size={16} />
                                                            </button>
                                                        </td>
                                                    ) : null}
                                                </motion.tr>
                                            ))
                                        )}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        {!loading && filteredTxns.length > 0 && (
                            <div className="pt-6 border-t border-slate-50 flex items-center justify-between p-4">
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[3px]">
                                    Showing <span className="text-slate-800">{filteredTxns.length}</span> results of {rawTxns.length} entries
                                </p>
                                <div className="flex gap-2">
                                    <button className="h-10 px-5 bg-slate-50 rounded-xl text-[10px] font-black uppercase text-slate-300 tracking-widest cursor-not-allowed border border-slate-100">Previous</button>
                                    <button className="h-10 px-5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Next</button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default Reports;

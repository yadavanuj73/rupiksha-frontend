import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import {
    CheckCircle2, Search, RefreshCcw, Download, FileSpreadsheet,
    FileText, IndianRupee, ExternalLink, X, Printer, Calendar
} from 'lucide-react';
import { fmtINR, fmtDateTime, fetchAPI, sanitizeCsvCell } from './walletShared';

const FundRequestHistoryTab = ({ onToast }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    const loadApprovedRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchAPI('/admin/wallet/fund-requests');
            if (res && res.success && Array.isArray(res.requests)) {
                setRequests(res.requests.filter(r => (r.status || '').toUpperCase() === 'APPROVED'));
            } else {
                setRequests([]);
            }
        } catch (_) {
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadApprovedRequests();
    }, [loadApprovedRequests]);

    const filtered = requests.filter(r => {
        const matchesSearch =
            (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (r.username || '').toLowerCase().includes(search.toLowerCase()) ||
            String(r.mobile || '').includes(search) ||
            String(r.utrNumber || '').toLowerCase().includes(search.toLowerCase());

        const matchesRole = roleFilter === 'ALL' || (r.role || '').toUpperCase() === roleFilter;
        return matchesSearch && matchesRole;
    });

    const totalApprovedVolume = filtered.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    // Export to Excel
    const handleExportExcel = () => {
        try {
            const dataToExport = filtered.map(r => ({
                'Request ID': sanitizeCsvCell(r.id),
                'User Name': sanitizeCsvCell(r.name),
                'Mobile / User ID': sanitizeCsvCell(r.mobile || r.username),
                'Role': sanitizeCsvCell(r.role),
                'Credited Amount (INR)': parseFloat(r.amount) || 0,
                'UTR / Ref Number': sanitizeCsvCell(r.utrNumber),
                'Payment Mode': sanitizeCsvCell(r.method),
                'Bank Account': sanitizeCsvCell(r.bankName),
                'Approved At': fmtDateTime(r.approvedAt || r.created_at),
                'Approved By': sanitizeCsvCell(r.approvedBy || 'Admin'),
                'Admin Remark': sanitizeCsvCell(r.admin_remark || 'Approved'),
                'Status': 'APPROVED'
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Approved_Fund_Requests');
            XLSX.writeFile(wb, `Rupiksha_Approved_Fund_Requests_${new Date().toISOString().slice(0, 10)}.xlsx`);
            onToast({ type: 'success', message: 'Excel report downloaded successfully' });
        } catch (err) {
            onToast({ type: 'error', message: 'Failed to export Excel report' });
        }
    };

    // Export to PDF
    const handleExportPdf = () => {
        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();

            // Header Banner
            doc.setFillColor(15, 23, 42); // slate-900
            doc.rect(0, 0, pageW, 20, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('Rupiksha — Approved Fund Requests Report', 14, 13);
            doc.setFontSize(8);
            doc.text(`Generated: ${fmtDateTime(new Date().toISOString())} | Total Volume: INR ${totalApprovedVolume.toLocaleString('en-IN')}`, pageW - 14, 13, { align: 'right' });

            let y = 30;
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(9);
            doc.text(`Total Approved Requests: ${filtered.length} entries`, 14, y);
            y += 8;

            // Table header
            doc.setFillColor(241, 245, 249);
            doc.rect(14, y, pageW - 28, 7, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);

            doc.text('REQ ID', 16, y + 5);
            doc.text('USER & ROLE', 45, y + 5);
            doc.text('AMOUNT', 100, y + 5);
            doc.text('UTR NUMBER', 130, y + 5);
            doc.text('MODE', 180, y + 5);
            doc.text('APPROVED AT', 210, y + 5);
            doc.text('STATUS', 260, y + 5);
            y += 9;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);

            filtered.slice(0, 30).forEach(r => {
                if (y > 185) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(String(r.id || '—'), 16, y);
                doc.text(`${r.name || 'User'} (${r.role || 'Member'})`, 45, y);
                doc.text(`INR ${(parseFloat(r.amount) || 0).toLocaleString('en-IN')}`, 100, y);
                doc.text(String(r.utrNumber || '—').slice(0, 25), 130, y);
                doc.text(String(r.method || 'NEFT'), 180, y);
                doc.text(fmtDateTime(r.approvedAt || r.created_at).slice(0, 18), 210, y);
                doc.text('CREDITED', 260, y);
                y += 6;
            });

            doc.save(`Rupiksha_Approved_Fund_Requests_${new Date().toISOString().slice(0, 10)}.pdf`);
            onToast({ type: 'success', message: 'PDF report downloaded successfully' });
        } catch (err) {
            onToast({ type: 'error', message: 'Failed to generate PDF' });
        }
    };

    const getRoleBadge = (role) => {
        const r = (role || 'RETAILER').toUpperCase();
        if (r.includes('SUPER')) return 'bg-purple-100 text-purple-700 border-purple-200';
        if (r.includes('DIST')) return 'bg-blue-100 text-blue-700 border-blue-200';
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    };

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-7 text-white shadow-xl flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                            <CheckCircle2 size={24} className="text-emerald-400" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Fund Request History</h2>
                    </div>
                    <p className="text-slate-400 text-xs font-semibold max-w-xl">
                        Audit trail of all successfully processed fund requests where float funds were credited to user wallets.
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-2xl font-black text-emerald-400">{fmtINR(totalApprovedVolume)}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Credited Float</p>
                    </div>
                </div>
            </div>

            {/* Filter and Export Bar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    {/* Search */}
                    <div className="relative min-w-[240px] flex-1 max-w-md">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-medium"
                            placeholder="Search by user, mobile, or UTR..."
                        />
                    </div>

                    {/* Role Filter */}
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-400"
                    >
                        <option value="ALL">All Roles</option>
                        <option value="RETAILER">Retailers</option>
                        <option value="DISTRIBUTOR">Distributors</option>
                        <option value="SUPER_DISTRIBUTOR">Super Distributors</option>
                    </select>

                    <button
                        onClick={loadApprovedRequests}
                        title="Refresh"
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    >
                        <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Export Buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportExcel}
                        className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                        <FileSpreadsheet size={14} /> Export Excel
                    </button>
                    <button
                        onClick={handleExportPdf}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                        <Download size={14} /> Export PDF
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                {['Req ID', 'Beneficiary User', 'Role', 'Credited Amount', 'UTR / Ref No.', 'Method & Bank', 'Approved Date', 'Status & Receipt'].map(h => (
                                    <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                                    <td className="px-5 py-4 whitespace-nowrap font-mono text-xs font-bold text-slate-500">
                                        {req.id}
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <p className="text-xs font-black text-slate-900">{req.name}</p>
                                        <p className="text-[10px] text-slate-400">{req.mobile || req.username}</p>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase border ${getRoleBadge(req.role)}`}>
                                            {req.role}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <span className="text-sm font-black text-emerald-600">
                                            +{fmtINR(req.amount)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap font-mono text-xs font-semibold text-slate-700">
                                        {req.utrNumber || '—'}
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <p className="text-xs font-bold text-slate-800">{req.method || 'NEFT'}</p>
                                        <p className="text-[10px] text-slate-400">{req.bankName || 'Company Float'}</p>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                                        {fmtDateTime(req.approvedAt || req.created_at)}
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-black uppercase flex items-center gap-1">
                                                <CheckCircle2 size={11} className="text-emerald-500" /> Credited
                                            </span>
                                            <button
                                                onClick={() => setSelectedReceipt(req)}
                                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-colors"
                                                title="View Receipt"
                                            >
                                                <ExternalLink size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-14 text-center text-xs text-slate-400 font-bold">
                                        No approved fund request records found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Receipt Modal */}
            {selectedReceipt && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Deposit Voucher</h3>
                                <p className="text-xs text-slate-400">Rupiksha Float Credit Confirmation</p>
                            </div>
                            <button onClick={() => setSelectedReceipt(null)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-4 space-y-3 text-xs border border-slate-100">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Voucher / Request ID:</span>
                                <span className="font-mono font-bold text-slate-800">{selectedReceipt.id}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Beneficiary:</span>
                                <span className="font-bold text-slate-800">{selectedReceipt.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Mobile / ID:</span>
                                <span className="font-bold text-slate-800">{selectedReceipt.mobile || selectedReceipt.username}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Role:</span>
                                <span className="font-bold text-indigo-600">{selectedReceipt.role}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Bank UTR / Ref:</span>
                                <span className="font-mono font-bold text-slate-800">{selectedReceipt.utrNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Payment Channel:</span>
                                <span className="font-bold text-slate-800">{selectedReceipt.method}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Approved Date:</span>
                                <span className="font-semibold text-slate-800">{fmtDateTime(selectedReceipt.approvedAt || selectedReceipt.created_at)}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                                <span className="font-black text-slate-800 uppercase text-xs">Float Credited:</span>
                                <span className="text-xl font-black text-emerald-600">{fmtINR(selectedReceipt.amount)}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => window.print()}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                            >
                                <Printer size={14} /> Print Voucher
                            </button>
                            <button
                                onClick={() => setSelectedReceipt(null)}
                                className="flex-1 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FundRequestHistoryTab;

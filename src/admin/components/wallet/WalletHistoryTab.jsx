import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import {
    History, Search, RefreshCcw, Download, FileSpreadsheet,
    FileText, ArrowDownRight, ArrowUpRight, Filter, Calendar
} from 'lucide-react';
import { fetchAPI, fmtINR, fmtDateTime, sanitizeCsvCell } from './walletShared';

// Helper: build history API params
const buildHistoryParams = ({ type, context, status, search, startDate, endDate, page, size }) => {
    const params = new URLSearchParams();
    params.set('type', type);
    params.set('context', context);
    params.set('status', status);
    if (search && search.trim()) params.set('search', search.trim());
    if (startDate) {
        const start = new Date(startDate + 'T00:00:00+05:30');
        params.set('startDate', start.toISOString());
    }
    if (endDate) {
        const end = new Date(endDate + 'T23:59:59.999+05:30');
        params.set('endDate', end.toISOString());
    }
    if (page != null) params.set('page', String(page));
    if (size != null) params.set('size', String(size));
    return params;
};

const WalletHistoryTab = ({ onToast }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    // Filters
    const [type, setType] = useState('ALL');
    const [context, setContext] = useState('ALL');
    const [status, setStatus] = useState('ALL');
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [exportingCsv, setExportingCsv] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [exportingXlsx, setExportingXlsx] = useState(false);

    const loadHistory = useCallback(async () => {
        setLoading(true);
        try {
            const params = buildHistoryParams({ type, context, status, search, startDate, endDate, page, size: 15 });
            const res = await fetchAPI(`/wallet/history?${params.toString()}`);
            if (res && res.success) {
                setHistory(res.history || []);
                setTotalPages(res.totalPages || 0);
                setTotalElements(res.totalElements || 0);
                setLoading(false);
                return;
            }
        } catch (_) {}

        try {
            const appData = dataService.getData() || {};
            let localTxns = (appData.transactions || []).filter(t =>
                t.service?.startsWith('ADMIN_WALLET') || t.ledgerType || t.type
            );

            if (type && type !== 'ALL') {
                localTxns = localTxns.filter(t => (t.ledgerType || t.type || '').toUpperCase() === type);
            }
            if (status && status !== 'ALL') {
                localTxns = localTxns.filter(t => (t.status || '').toUpperCase() === status);
            }
            if (search && search.trim()) {
                const q = search.trim().toLowerCase();
                localTxns = localTxns.filter(t =>
                    String(t.referenceNumber || t.id || '').toLowerCase().includes(q) ||
                    String(t.narration || t.remark || '').toLowerCase().includes(q) ||
                    String(t.targetUsername || t.userId || '').toLowerCase().includes(q)
                );
            }
            if (startDate) {
                const start = new Date(startDate + 'T00:00:00+05:30');
                localTxns = localTxns.filter(t => new Date(t.createdAt || t.created_at) >= start);
            }
            if (endDate) {
                const end = new Date(endDate + 'T23:59:59+05:30');
                localTxns = localTxns.filter(t => new Date(t.createdAt || t.created_at) <= end);
            }

            const pageSize = 15;
            const totalItems = localTxns.length;
            const pageSlice = localTxns.slice(page * pageSize, (page + 1) * pageSize);

            setHistory(pageSlice);
            setTotalPages(Math.ceil(totalItems / pageSize) || 1);
            setTotalElements(totalItems);
        } catch (localErr) {
            setHistory([]);
        } finally {
            setLoading(false);
        }
    }, [type, context, status, search, startDate, endDate, page]);

    useEffect(() => { setPage(0); }, [type, context, status, search, startDate, endDate]);
    useEffect(() => { loadHistory(); }, [page, loadHistory]);

    // CSV Export
    const handleExportCsv = () => {
        try {
            const rows = history.map(row => [
                sanitizeCsvCell(row.referenceNumber || row.id),
                row.ledgerType || row.type || 'CREDIT',
                row.amount || 0,
                row.openingBalance || 0,
                row.closingBalance || 0,
                sanitizeCsvCell(row.targetUsername || row.userId),
                sanitizeCsvCell(row.narration || row.remark),
                fmtDateTime(row.createdAt || row.created_at),
                row.status || 'SUCCESS'
            ]);
            const header = ['Ref No', 'Type', 'Amount', 'Opening Bal', 'Closing Bal', 'Target User', 'Narration', 'Date', 'Status'];
            const csvContent = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `wallet_history_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            onToast({ type: 'success', message: 'CSV downloaded successfully' });
        } catch (e) {
            onToast({ type: 'error', message: 'Failed to export CSV' });
        }
    };

    // PDF Export
    const handleExportPdf = () => {
        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();

            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageW, 20, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('Rupiksha Wallet Transaction History', 14, 13);
            doc.setFontSize(8);
            doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, pageW - 14, 13, { align: 'right' });

            let y = 30;
            doc.setFillColor(241, 245, 249);
            doc.rect(14, y, pageW - 28, 7, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);

            doc.text('REF NO', 16, y + 5);
            doc.text('USER', 60, y + 5);
            doc.text('TYPE', 105, y + 5);
            doc.text('AMOUNT', 135, y + 5);
            doc.text('CLOSING BAL', 170, y + 5);
            doc.text('DATE', 205, y + 5);
            doc.text('STATUS', 255, y + 5);
            y += 9;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);

            history.slice(0, 25).forEach(row => {
                if (y > 185) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(String(row.referenceNumber || row.id || '—').slice(0, 20), 16, y);
                doc.text(String(row.targetUsername || row.userId || '—').slice(0, 20), 60, y);
                doc.text(String(row.ledgerType || row.type || 'CREDIT'), 105, y);
                doc.text(`INR ${Number(row.amount || 0).toLocaleString('en-IN')}`, 135, y);
                doc.text(`INR ${Number(row.closingBalance || 0).toLocaleString('en-IN')}`, 170, y);
                doc.text(fmtDateTime(row.createdAt || row.created_at).slice(0, 18), 205, y);
                doc.text(String(row.status || 'SUCCESS'), 255, y);
                y += 6;
            });

            doc.save(`wallet_history_${new Date().toISOString().slice(0, 10)}.pdf`);
            onToast({ type: 'success', message: 'PDF downloaded successfully' });
        } catch (_) {
            onToast({ type: 'error', message: 'Failed to export PDF' });
        }
    };

    // Excel Export
    const handleExportXlsx = () => {
        try {
            const dataToExport = history.map(r => ({
                'Ref No': sanitizeCsvCell(r.referenceNumber || r.id),
                'Target User': sanitizeCsvCell(r.targetUsername || r.userId),
                'Type': (r.ledgerType || r.type || 'CREDIT').toUpperCase(),
                'Amount (INR)': parseFloat(r.amount) || 0,
                'Opening Balance': parseFloat(r.openingBalance) || 0,
                'Closing Balance': parseFloat(r.closingBalance) || 0,
                'Narration': sanitizeCsvCell(r.narration || r.remark),
                'Date & Time': fmtDateTime(r.createdAt || r.created_at),
                'Status': sanitizeCsvCell(r.status || 'SUCCESS')
            }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Wallet_History');
            XLSX.writeFile(wb, `wallet_history_${new Date().toISOString().slice(0, 10)}.xlsx`);
            onToast({ type: 'success', message: 'Excel downloaded successfully' });
        } catch (_) {
            onToast({ type: 'error', message: 'Failed to export Excel' });
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 rounded-3xl p-7 text-white shadow-xl flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                            <History size={24} className="text-slate-300" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Wallet History</h2>
                    </div>
                    <p className="text-slate-400 text-xs font-semibold max-w-xl">
                        Complete chronological audit record of all user wallet debits, credits, charges, and reversals.
                    </p>
                </div>

                <div className="text-right">
                    <p className="text-2xl font-black text-slate-100">{totalElements}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Operations Logged</p>
                </div>
            </div>

            {/* Filter and Export Bar */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="relative min-w-[260px] flex-1 max-w-md">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-medium"
                            placeholder="Search by ref no, user, narration..."
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportCsv}
                            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                        >
                            <FileText size={14} /> CSV
                        </button>
                        <button
                            onClick={handleExportXlsx}
                            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                        >
                            <FileSpreadsheet size={14} /> Excel
                        </button>
                        <button
                            onClick={handleExportPdf}
                            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                        >
                            <Download size={14} /> PDF
                        </button>
                        <button
                            onClick={loadHistory}
                            title="Refresh"
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Type</label>
                        <select
                            value={type}
                            onChange={e => setType(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-400"
                        >
                            <option value="ALL">All Types</option>
                            <option value="CREDIT">Credits (+)</option>
                            <option value="DEBIT">Debits (-)</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</label>
                        <select
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-400"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="SUCCESS">Success</option>
                            <option value="PENDING">Pending</option>
                            <option value="FAILED">Failed</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:border-indigo-400"
                        />
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:border-indigo-400"
                        />
                    </div>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                {['Ref No', 'Type', 'Amount', 'Opening Bal', 'Closing Bal', 'Target User', 'Narration', 'Date & Time', 'Status'].map(h => (
                                    <th key={h} className="px-4 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {history.map(row => {
                                const isCredit = (row.ledgerType || row.type || '').toUpperCase() === 'CREDIT';
                                return (
                                    <tr key={row.id || row.referenceNumber} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-4 py-3 font-mono font-bold text-slate-600 whitespace-nowrap">
                                            {row.referenceNumber || row.id}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1 font-black ${isCredit ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                {isCredit ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                                                {isCredit ? 'CREDIT' : 'DEBIT'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap font-black text-right">
                                            <span className={isCredit ? 'text-emerald-600' : 'text-rose-600'}>
                                                {isCredit ? '+' : '-'}{fmtINR(row.amount)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-slate-400">
                                            {fmtINR(row.openingBalance || 0)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-slate-700">
                                            {fmtINR(row.closingBalance || 0)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-800">
                                            {row.targetUsername || row.userId || '—'}
                                        </td>
                                        <td className="px-4 py-3 max-w-[200px] truncate text-slate-500" title={row.narration || row.remark}>
                                            {row.narration || row.remark || '—'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                                            {fmtDateTime(row.createdAt || row.created_at)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase">
                                                {row.status || 'SUCCESS'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {history.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="py-14 text-center text-xs text-slate-400 font-bold">
                                        No history records found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-slate-600">
                        <span>Page {page + 1} of {totalPages} · {totalElements} total entries</span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page === 0}
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40"
                            >
                                Previous
                            </button>
                            <button
                                disabled={page >= totalPages - 1}
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WalletHistoryTab;

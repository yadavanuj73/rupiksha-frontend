import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import {
    BookOpen, Search, RefreshCcw, Download, FileSpreadsheet,
    IndianRupee, Filter, Calendar, ArrowDownRight, ArrowUpRight, CheckCircle2
} from 'lucide-react';
import { fetchAPI, fmtINR, fmtDateTime, sanitizeCsvCell } from './walletShared';
import { dataService } from '../../../services/dataService';

const RupikshaLedgerTab = ({ onToast }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL'); // ALL | CREDIT | DEBIT
    const [serviceFilter, setServiceFilter] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(15);

    const loadLedger = useCallback(async () => {
        setLoading(true);
        let list = [];

        // 1. Try backend history
        try {
            const res = await fetchAPI('/wallet/history?page=0&size=1000');
            if (res && res.success && Array.isArray(res.history) && res.history.length > 0) {
                list = res.history;
            }
        } catch (_) {}

        // 2. Merge with dataService transactions
        try {
            const localTxns = dataService.getData()?.transactions || [];
            localTxns.forEach(tx => {
                if (!list.some(l => l.id == tx.id || l.referenceNumber === tx.referenceNumber)) {
                    list.push(tx);
                }
            });
        } catch (_) {}

        // Sort descending by date
        list.sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));

        setTransactions(list);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadLedger();
    }, [loadLedger]);

    // Apply quick date preset
    const applyDatePreset = (preset) => {
        const today = new Date();
        const fmt = d => d.toISOString().slice(0, 10);

        if (preset === 'TODAY') {
            const t = fmt(today);
            setStartDate(t);
            setEndDate(t);
        } else if (preset === 'YESTERDAY') {
            const y = new Date(today);
            y.setDate(y.getDate() - 1);
            const str = fmt(y);
            setStartDate(str);
            setEndDate(str);
        } else if (preset === '7DAYS') {
            const past = new Date(today);
            past.setDate(past.getDate() - 7);
            setStartDate(fmt(past));
            setEndDate(fmt(today));
        } else if (preset === 'THIS_MONTH') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            setStartDate(fmt(start));
            setEndDate(fmt(today));
        } else if (preset === 'ALL') {
            setStartDate('');
            setEndDate('');
        }
    };

    // Filtered data
    const filtered = transactions.filter(t => {
        // Type filter
        const tType = (t.ledgerType || t.type || '').toUpperCase();
        if (typeFilter !== 'ALL' && tType !== typeFilter) return false;

        // Service filter
        const srv = (t.service || t.transactionContext || '').toUpperCase();
        if (serviceFilter !== 'ALL' && !srv.includes(serviceFilter)) return false;

        // Search query
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            const matches =
                String(t.referenceNumber || t.id || '').toLowerCase().includes(q) ||
                String(t.targetUsername || t.userId || '').toLowerCase().includes(q) ||
                String(t.narration || t.remark || '').toLowerCase().includes(q) ||
                String(t.operatorUsername || '').toLowerCase().includes(q);
            if (!matches) return false;
        }

        // Date range
        const tDate = new Date(t.createdAt || t.created_at || 0);
        if (startDate) {
            const start = new Date(startDate + 'T00:00:00+05:30');
            if (tDate < start) return false;
        }
        if (endDate) {
            const end = new Date(endDate + 'T23:59:59+05:30');
            if (tDate > end) return false;
        }

        return true;
    });

    const totalCredits = filtered
        .filter(t => (t.ledgerType || t.type || '').toUpperCase() === 'CREDIT')
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

    const totalDebits = filtered
        .filter(t => (t.ledgerType || t.type || '').toUpperCase() === 'DEBIT')
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

    const netTurnover = totalCredits - totalDebits;

    // Pagination
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    const paginatedRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

    // Export to Excel
    const handleExportExcel = () => {
        try {
            const dataToExport = filtered.map(t => ({
                'Transaction ID': sanitizeCsvCell(t.referenceNumber || t.id),
                'Date & Time': fmtDateTime(t.createdAt || t.created_at),
                'Target User / ID': sanitizeCsvCell(t.targetUsername || t.userId),
                'Service / Channel': sanitizeCsvCell(t.service || t.transactionContext),
                'Type': (t.ledgerType || t.type || '').toUpperCase(),
                'Amount (INR)': parseFloat(t.amount) || 0,
                'Opening Balance': parseFloat(t.openingBalance) || 0,
                'Closing Balance': parseFloat(t.closingBalance) || 0,
                'Status': sanitizeCsvCell(t.status || 'SUCCESS'),
                'Narration': sanitizeCsvCell(t.narration || t.remark)
            }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Rupiksha_Ledger');
            XLSX.writeFile(wb, `Rupiksha_Master_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
            onToast({ type: 'success', message: 'Master Ledger Excel downloaded successfully' });
        } catch (_) {
            onToast({ type: 'error', message: 'Failed to export Excel' });
        }
    };

    // Export to PDF
    const handleExportPdf = () => {
        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();

            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageW, 20, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('Rupiksha Complete Financial Ledger', 14, 13);
            doc.setFontSize(8);
            doc.text(`Generated: ${fmtDateTime(new Date().toISOString())} | Entries: ${filtered.length}`, pageW - 14, 13, { align: 'right' });

            let y = 30;
            doc.setFillColor(241, 245, 249);
            doc.rect(14, y, pageW - 28, 7, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);

            doc.text('TXN ID / REF', 16, y + 5);
            doc.text('DATE & TIME', 55, y + 5);
            doc.text('USER / PARTY', 95, y + 5);
            doc.text('SERVICE', 135, y + 5);
            doc.text('TYPE', 175, y + 5);
            doc.text('AMOUNT', 200, y + 5);
            doc.text('CLOSING BAL', 230, y + 5);
            doc.text('STATUS', 265, y + 5);
            y += 9;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);

            paginatedRows.slice(0, 25).forEach(t => {
                if (y > 185) {
                    doc.addPage();
                    y = 20;
                }
                const isCredit = (t.ledgerType || t.type || '').toUpperCase() === 'CREDIT';
                doc.text(String(t.referenceNumber || t.id || '—').slice(0, 18), 16, y);
                doc.text(fmtDateTime(t.createdAt || t.created_at).slice(0, 18), 55, y);
                doc.text(String(t.targetUsername || t.userId || 'User').slice(0, 18), 95, y);
                doc.text(String(t.service || 'WALLET').slice(0, 18), 135, y);
                doc.text(isCredit ? 'CREDIT' : 'DEBIT', 175, y);
                doc.text(`INR ${Number(t.amount || 0).toLocaleString('en-IN')}`, 200, y);
                doc.text(`INR ${Number(t.closingBalance || 0).toLocaleString('en-IN')}`, 230, y);
                doc.text(String(t.status || 'SUCCESS'), 265, y);
                y += 6;
            });

            doc.save(`Rupiksha_Master_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
            onToast({ type: 'success', message: 'Master Ledger PDF downloaded successfully' });
        } catch (_) {
            onToast({ type: 'error', message: 'Failed to generate PDF' });
        }
    };

    return (
        <div className="space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Credits</p>
                        <p className="text-lg font-black text-emerald-600 mt-0.5">+{fmtINR(totalCredits)}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        ↓
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Debits</p>
                        <p className="text-lg font-black text-rose-600 mt-0.5">-{fmtINR(totalDebits)}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                        ↑
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Flow</p>
                        <p className="text-lg font-black text-indigo-600 mt-0.5">{fmtINR(netTurnover)}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        ⇄
                    </div>
                </div>
            </div>

            {/* Filter Controls */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Search */}
                    <div className="relative min-w-[260px] flex-1 max-w-md">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(0); }}
                            className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-medium"
                            placeholder="Search by Txn ID, User, Narration..."
                        />
                    </div>

                    {/* Quick Date Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                        {[
                            { id: 'ALL', label: 'All Time' },
                            { id: 'TODAY', label: 'Today' },
                            { id: 'YESTERDAY', label: 'Yesterday' },
                            { id: '7DAYS', label: '7 Days' },
                            { id: 'THIS_MONTH', label: 'This Month' }
                        ].map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => applyDatePreset(preset.id)}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Export Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportExcel}
                            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <FileSpreadsheet size={14} /> Excel
                        </button>
                        <button
                            onClick={handleExportPdf}
                            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <Download size={14} /> PDF
                        </button>
                        <button
                            onClick={loadLedger}
                            title="Refresh"
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Secondary Filters: Type & Service */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Type</label>
                        <select
                            value={typeFilter}
                            onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-400"
                        >
                            <option value="ALL">All Types (Credit & Debit)</option>
                            <option value="CREDIT">Credit Only (+)</option>
                            <option value="DEBIT">Debit Only (-)</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Service Channel</label>
                        <select
                            value={serviceFilter}
                            onChange={e => { setServiceFilter(e.target.value); setPage(0); }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-400"
                        >
                            <option value="ALL">All Services</option>
                            <option value="WALLET">Wallet Transfers & Loads</option>
                            <option value="CMS">CMS Collections & Refunds</option>
                            <option value="COMMISSION">Commission Payouts</option>
                            <option value="PAYOUT">Payouts / Settlement</option>
                            <option value="AEPS">AePS Transactions</option>
                            <option value="DMT">Money Transfer (DMT)</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">From Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => { setStartDate(e.target.value); setPage(0); }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:border-indigo-400"
                        />
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">To Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => { setEndDate(e.target.value); setPage(0); }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:border-indigo-400"
                        />
                    </div>
                </div>
            </div>

            {/* Master Ledger Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                {['Txn ID / Ref', 'Date & Time', 'User / Party', 'Channel', 'Type', 'Amount', 'Opening Bal', 'Closing Bal', 'Narration', 'Status'].map(h => (
                                    <th key={h} className="px-4 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {paginatedRows.map(tx => {
                                const isCredit = (tx.ledgerType || tx.type || '').toUpperCase() === 'CREDIT';
                                return (
                                    <tr key={tx.id || tx.referenceNumber} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-4 py-3 font-mono font-bold text-slate-600 whitespace-nowrap">
                                            {tx.referenceNumber || tx.id}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                                            {fmtDateTime(tx.createdAt || tx.created_at)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-800">
                                            {tx.targetUsername || tx.userId || '—'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[9px] uppercase">
                                                {tx.service || tx.transactionContext || 'WALLET'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1 font-black ${isCredit ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                {isCredit ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                                                {isCredit ? 'CREDIT' : 'DEBIT'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap font-black text-right">
                                            <span className={isCredit ? 'text-emerald-600' : 'text-rose-600'}>
                                                {isCredit ? '+' : '-'}{fmtINR(tx.amount)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-slate-400">
                                            {fmtINR(tx.openingBalance || 0)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-slate-700">
                                            {fmtINR(tx.closingBalance || 0)}
                                        </td>
                                        <td className="px-4 py-3 max-w-[200px] truncate text-slate-500" title={tx.narration || tx.remark}>
                                            {tx.narration || tx.remark || '—'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase">
                                                {tx.status || 'SUCCESS'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {paginatedRows.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="py-14 text-center text-xs text-slate-400 font-bold">
                                        No ledger records match the selected filters
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-slate-600">
                        <span>
                            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} entries
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page === 0}
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 transition-colors"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl">
                                Page {page + 1} of {totalPages}
                            </span>
                            <button
                                disabled={page >= totalPages - 1}
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 transition-colors"
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

export default RupikshaLedgerTab;

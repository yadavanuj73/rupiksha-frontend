import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import {
    FileSpreadsheet, Download, Search, RefreshCcw, ShieldCheck,
    IndianRupee, Calendar, Copy, Check, Filter
} from 'lucide-react';
import { fmtINR, fmtDateTime, sanitizeCsvCell, fetchAPI, WalletTabSkeleton } from './walletShared';

const TDSReportTab = ({ onToast }) => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [fyFilter, setFyFilter] = useState('2025-26');
    const [quarterFilter, setQuarterFilter] = useState('ALL');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [copiedPan, setCopiedPan] = useState(null);
    const [taxSummary, setTaxSummary] = useState(null);

    useEffect(() => {
        setLoading(true);
        fetchAPI('/admin/tax-summary')
            .then(res => {
                if (res && res.success && res.wallet) {
                    setTaxSummary(res.wallet);
                }
            })
            .catch(() => {});

        fetchAPI('/wallet/history?page=0&size=500')
            .then(res => {
                if (res && res.success && Array.isArray(res.history)) {
                    const tdsList = res.history
                        .filter(t => (t.tdsAmount && t.tdsAmount > 0) || (t.tds && t.tds > 0))
                        .map(t => ({
                            id: t.referenceNumber || t.id,
                            name: t.name || t.targetUsername || 'Taxpayer',
                            username: t.targetUsername || t.userId,
                            mobile: t.mobile || '',
                            role: t.role || 'RETAILER',
                            panNumber: t.panNumber || '—',
                            grossAmount: t.amount,
                            sectionCode: '194H (Commission / Brokerage)',
                            tdsRate: t.tdsRate || 2.0,
                            tdsAmount: t.tdsAmount || t.tds || ((t.amount * 2) / 100),
                            date: t.createdAt || new Date().toISOString(),
                            quarter: 'Q4',
                            financialYear: '2025-26',
                            challanStatus: 'DEPOSITED',
                            refTxn: t.referenceNumber || t.id
                        }));
                    setRecords(tdsList);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleCopyPan = (pan) => {
        if (!pan) return;
        navigator.clipboard?.writeText(pan);
        setCopiedPan(pan);
        setTimeout(() => setCopiedPan(null), 2000);
    };

    const filtered = records.filter(r => {
        const q = search.trim().toLowerCase();
        const matchesSearch = !q ||
            (r.name || '').toLowerCase().includes(q) ||
            (r.username || '').toLowerCase().includes(q) ||
            String(r.panNumber || '').toLowerCase().includes(q) ||
            String(r.mobile || '').includes(q) ||
            String(r.id || '').toLowerCase().includes(q);

        const matchesFy = !fyFilter || r.financialYear === fyFilter;
        const matchesQtr = quarterFilter === 'ALL' || r.quarter === quarterFilter;
        const matchesRole = roleFilter === 'ALL' || (r.role || '').toUpperCase() === roleFilter;

        return matchesSearch && matchesFy && matchesQtr && matchesRole;
    });

    const totalTds = filtered.reduce((s, r) => s + (parseFloat(r.tdsAmount) || 0), 0);
    const totalGross = filtered.reduce((s, r) => s + (parseFloat(r.grossAmount) || 0), 0);
    const uniquePans = new Set(filtered.map(r => r.panNumber)).size;

    const handleExportExcel = () => {
        try {
            const dataToExport = filtered.map(r => ({
                'TDS Record ID': sanitizeCsvCell(r.id),
                'Deductee Name': sanitizeCsvCell(r.name),
                'PAN Number': sanitizeCsvCell(r.panNumber),
                'Role': sanitizeCsvCell(r.role),
                'Mobile / User ID': sanitizeCsvCell(r.mobile || r.username),
                'Gross Amount (INR)': parseFloat(r.grossAmount) || 0,
                'Section Code': sanitizeCsvCell(r.sectionCode),
                'TDS Rate (%)': r.tdsRate,
                'TDS Deducted (INR)': parseFloat(r.tdsAmount) || 0,
                'Financial Year': r.financialYear,
                'Quarter': r.quarter,
                'Deduction Date': fmtDateTime(r.date),
                'Ref Transaction': sanitizeCsvCell(r.refTxn),
                'Challan Status': sanitizeCsvCell(r.challanStatus)
            }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'TDS_Report');
            XLSX.writeFile(wb, `Rupiksha_TDS_Report_${fyFilter}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            onToast({ type: 'success', message: 'TDS Report downloaded in Excel' });
        } catch (_) {
            onToast({ type: 'error', message: 'Failed to export Excel report' });
        }
    };

    const handleExportPdf = () => {
        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();

            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageW, 20, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text(`Rupiksha Statutory TDS Report (FY ${fyFilter})`, 14, 13);
            doc.setFontSize(8);
            doc.text(`Generated: ${fmtDateTime(new Date().toISOString())} | Total TDS: INR ${totalTds.toLocaleString('en-IN')}`, pageW - 14, 13, { align: 'right' });

            let y = 30;
            doc.setFillColor(241, 245, 249);
            doc.rect(14, y, pageW - 28, 7, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);

            doc.text('DEDUCTEE NAME', 16, y + 5);
            doc.text('PAN NUMBER', 65, y + 5);
            doc.text('ROLE', 105, y + 5);
            doc.text('GROSS AMOUNT', 140, y + 5);
            doc.text('SECTION', 180, y + 5);
            doc.text('TDS (2%)', 225, y + 5);
            doc.text('CHALLAN', 255, y + 5);
            y += 9;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);

            filtered.forEach(r => {
                if (y > 185) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(String(r.name || 'User').slice(0, 22), 16, y);
                doc.text(String(r.panNumber || '—'), 65, y);
                doc.text(String(r.role || 'Member'), 105, y);
                doc.text(`INR ${Number(r.grossAmount || 0).toLocaleString('en-IN')}`, 140, y);
                doc.text('194H', 180, y);
                doc.text(`INR ${Number(r.tdsAmount || 0).toLocaleString('en-IN')}`, 225, y);
                doc.text(r.challanStatus === 'DEPOSITED' ? 'DEPOSITED' : 'PENDING', 255, y);
                y += 6;
            });

            doc.save(`Rupiksha_TDS_Report_${fyFilter}.pdf`);
            onToast({ type: 'success', message: 'TDS Report downloaded in PDF' });
        } catch (_) {
            onToast({ type: 'error', message: 'Failed to generate PDF' });
        }
    };

    if (loading && records.length === 0) {
        return (
            <WalletTabSkeleton
                title="TDS Report"
                subtitle="Fetching TDS deductions, challan status and tax ledger..."
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total TDS Deducted</p>
                        <p className="text-lg font-black text-emerald-600 mt-0.5">{fmtINR(totalTds)}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        ₹
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxable Base</p>
                        <p className="text-lg font-black text-slate-900 mt-0.5">{fmtINR(totalGross)}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                        Σ
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deductees (PANs)</p>
                        <p className="text-lg font-black text-teal-600 mt-0.5">{uniquePans}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                        #
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    <div className="relative min-w-[240px] flex-1 max-w-md">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-400 font-medium"
                            placeholder="Search deductee, mobile, or PAN..."
                        />
                    </div>

                    {/* Financial Year */}
                    <select
                        value={fyFilter}
                        onChange={e => setFyFilter(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-teal-400"
                    >
                        <option value="2025-26">FY 2025-26</option>
                        <option value="2024-25">FY 2024-25</option>
                        <option value="2026-27">FY 2026-27</option>
                    </select>

                    {/* Quarter */}
                    <select
                        value={quarterFilter}
                        onChange={e => setQuarterFilter(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-teal-400"
                    >
                        <option value="ALL">All Quarters</option>
                        <option value="Q1">Q1 (Apr - Jun)</option>
                        <option value="Q2">Q2 (Jul - Sep)</option>
                        <option value="Q3">Q3 (Oct - Dec)</option>
                        <option value="Q4">Q4 (Jan - Mar)</option>
                    </select>

                    {/* Role Filter */}
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-teal-400"
                    >
                        <option value="ALL">All Roles</option>
                        <option value="RETAILER">Retailers</option>
                        <option value="DISTRIBUTOR">Distributors</option>
                        <option value="SUPER_DISTRIBUTOR">Super Distributors</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportExcel}
                        className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                    >
                        <FileSpreadsheet size={14} /> Export Excel
                    </button>
                    <button
                        onClick={handleExportPdf}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                    >
                        <Download size={14} /> Export PDF
                    </button>
                </div>
            </div>

            {/* TDS Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                {['Deductee Name', 'PAN Number', 'Role', 'Gross Commission', 'Section', 'Rate', 'TDS Deducted', 'Deduction Date', 'Challan Status'].map(h => (
                                    <th key={h} className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(rec => (
                                <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                        <p className="text-xs font-black text-slate-900">{rec.name}</p>
                                        <p className="text-[10px] text-slate-400">{rec.mobile || rec.username}</p>
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                {rec.panNumber}
                                            </span>
                                            <button
                                                onClick={() => handleCopyPan(rec.panNumber)}
                                                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors"
                                                title="Copy PAN"
                                            >
                                                {copiedPan === rec.panNumber ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-black uppercase">
                                            {rec.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap text-xs font-black text-slate-800">
                                        {fmtINR(rec.grossAmount)}
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap text-xs font-semibold text-slate-600">
                                        194H
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap text-xs font-bold text-slate-500">
                                        {rec.tdsRate.toFixed(1)}%
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap text-xs font-black text-emerald-700">
                                        {fmtINR(rec.tdsAmount)}
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-400">
                                        {fmtDateTime(rec.date)}
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                            rec.challanStatus === 'DEPOSITED'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {rec.challanStatus.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-xs text-slate-400 font-bold">
                                        No TDS deduction records match your filters
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TDSReportTab;

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import {
    IndianRupee, Search, RefreshCcw, Download, FileSpreadsheet,
    Plus, Filter, Calendar, CheckCircle2, X
} from 'lucide-react';
import { UserSelector, fmtINR, fmtDateTime, sanitizeCsvCell, fetchAPI, fireCelebration, WalletTabSkeleton } from './walletShared';
import { dataService } from '../../../services/dataService';

const RupikshaCommissionLedgerTab = ({ users = [], loading = false, onToast, onRefresh }) => {
    if (loading && users.length === 0) {
        return (
            <WalletTabSkeleton
                title="Rupiksha Commission Ledger"
                subtitle="Fetching distributor commission records and tax ledger..."
            />
        );
    }

    const [records, setRecords] = useState(() => {
        try {
            const appTx = dataService.getData()?.transactions || [];
            return appTx
                .filter(t => (t.service || '').includes('COMMISSION') || t.ledgerType === 'COMMISSION' || t.transactionContext === 'COMMISSION')
                .map(t => ({
                    id: t.referenceNumber || t.id,
                    userId: t.userId || t.targetUsername,
                    username: t.targetUsername || t.userId,
                    name: t.name || t.targetUsername || 'User',
                    role: t.role || 'RETAILER',
                    mobile: t.mobile || '',
                    service: t.service || 'AEPS_COMMISSION',
                    grossAmount: t.grossAmount || t.amount,
                    tdsRate: t.tdsRate || 2,
                    tdsAmount: t.tdsAmount || 0,
                    gstRate: t.gstRate || 0,
                    gstAmount: t.gstAmount || 0,
                    netAmount: t.netAmount || t.amount,
                    date: t.createdAt || new Date().toISOString(),
                    status: 'CREDITED',
                    remark: t.narration || t.remark || 'Commission disbursement'
                }));
        } catch (_) {
            return [];
        }
    });
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [serviceFilter, setServiceFilter] = useState('ALL');

    // Distribute Commission Modal
    const [showDistributeModal, setShowDistributeModal] = useState(false);
    const [distForm, setDistForm] = useState({
        userId: '',
        grossAmount: '',
        gstRate: '0',
        service: 'AEPS_COMMISSION',
        remark: ''
    });
    const [distributing, setDistributing] = useState(false);

    // Distribute commission submission
    const handleDistributeSubmit = async (e) => {
        e.preventDefault();
        if (!distForm.userId) return onToast({ type: 'error', message: 'Please select a beneficiary user' });
        const gross = parseFloat(distForm.grossAmount);
        if (!gross || gross <= 0) return onToast({ type: 'error', message: 'Please enter a valid gross commission amount' });

        setDistributing(true);
        const selectedUser = users.find(u => u.username === distForm.userId || u.id == distForm.userId);
        const targetId = selectedUser ? (selectedUser.id || selectedUser.username) : distForm.userId;
        const targetName = selectedUser?.name || selectedUser?.fullName || targetId;

        const tds = (gross * 2) / 100;
        const gst = (gross * parseFloat(distForm.gstRate || 0)) / 100;
        const net = gross - tds - gst;

        try {
            await fetchAPI('/wallet/give-commission', {
                method: 'POST',
                body: JSON.stringify({
                    userId: targetId,
                    amount: gross,
                    gstPercentage: parseFloat(distForm.gstRate || 0),
                    remark: distForm.remark || 'Commission credit'
                })
            });
        } catch (_) {}

        // Credit net payable to user's wallet
        const note = `Commission Payout (${distForm.service.replace(/_/g, ' ')}) - Gross: ₹${gross}, TDS: ₹${tds}, Net: ₹${net}`;
        dataService.adjustUserWalletBalance(targetId, net, 'CREDIT', note);

        const newRec = {
            id: `COMM-${Date.now().toString().slice(-5)}`,
            userId: targetId,
            username: selectedUser?.username || targetId,
            name: targetName,
            role: selectedUser?.role || 'RETAILER',
            mobile: selectedUser?.mobile || '',
            service: distForm.service,
            grossAmount: gross,
            tdsRate: 2,
            tdsAmount: tds,
            gstRate: parseFloat(distForm.gstRate || 0),
            gstAmount: gst,
            netAmount: net,
            date: new Date().toISOString(),
            status: 'CREDITED',
            remark: distForm.remark || 'Manual commission disbursement by Admin'
        };

        setRecords(prev => [newRec, ...prev]);

        fireCelebration();
        onToast({
            type: 'success',
            message: `Commission of ${fmtINR(net)} (Net) successfully credited to ${targetName}!`
        });

        setShowDistributeModal(false);
        setDistForm({ userId: '', grossAmount: '', gstRate: '0', service: 'AEPS_COMMISSION', remark: '' });
        setDistributing(false);
        if (onRefresh) onRefresh();
        window.dispatchEvent(new CustomEvent('walletUpdated'));
    };

    const filtered = records.filter(r => {
        const q = search.trim().toLowerCase();
        const matchesSearch = !q ||
            (r.name || '').toLowerCase().includes(q) ||
            (r.username || '').toLowerCase().includes(q) ||
            String(r.id || '').toLowerCase().includes(q) ||
            String(r.mobile || '').includes(q);

        const matchesRole = roleFilter === 'ALL' || (r.role || '').toUpperCase() === roleFilter;
        const matchesService = serviceFilter === 'ALL' || (r.service || '').toUpperCase().includes(serviceFilter);

        return matchesSearch && matchesRole && matchesService;
    });

    const totalGross = filtered.reduce((s, r) => s + (parseFloat(r.grossAmount) || 0), 0);
    const totalTds = filtered.reduce((s, r) => s + (parseFloat(r.tdsAmount) || 0), 0);
    const totalGst = filtered.reduce((s, r) => s + (parseFloat(r.gstAmount) || 0), 0);
    const totalNet = filtered.reduce((s, r) => s + (parseFloat(r.netAmount) || 0), 0);

    const handleExportExcel = () => {
        try {
            const dataToExport = filtered.map(r => ({
                'Commission Ref': sanitizeCsvCell(r.id),
                'Beneficiary User': sanitizeCsvCell(r.name),
                'User Mobile / ID': sanitizeCsvCell(r.mobile || r.username),
                'Role': sanitizeCsvCell(r.role),
                'Service Channel': sanitizeCsvCell(r.service),
                'Gross Commission (INR)': parseFloat(r.grossAmount) || 0,
                'TDS Deducted (2%)': parseFloat(r.tdsAmount) || 0,
                'GST Deducted': parseFloat(r.gstAmount) || 0,
                'Net Amount Paid (INR)': parseFloat(r.netAmount) || 0,
                'Date & Time': fmtDateTime(r.date),
                'Status': 'CREDITED',
                'Remark': sanitizeCsvCell(r.remark)
            }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Commission_Ledger');
            XLSX.writeFile(wb, `Rupiksha_Commission_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
            onToast({ type: 'success', message: 'Commission Ledger exported to Excel' });
        } catch (_) {
            onToast({ type: 'error', message: 'Failed to export Excel' });
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
            doc.text('Rupiksha Commission Ledger Report', 14, 13);
            doc.setFontSize(8);
            doc.text(`Generated: ${fmtDateTime(new Date().toISOString())} | Total Net Paid: INR ${totalNet.toLocaleString('en-IN')}`, pageW - 14, 13, { align: 'right' });

            let y = 30;
            doc.setFillColor(241, 245, 249);
            doc.rect(14, y, pageW - 28, 7, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);

            doc.text('REF ID', 16, y + 5);
            doc.text('BENEFICIARY', 50, y + 5);
            doc.text('ROLE', 95, y + 5);
            doc.text('SERVICE', 130, y + 5);
            doc.text('GROSS', 175, y + 5);
            doc.text('TDS (2%)', 205, y + 5);
            doc.text('NET PAID', 235, y + 5);
            doc.text('STATUS', 265, y + 5);
            y += 9;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);

            filtered.slice(0, 25).forEach(r => {
                if (y > 185) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(String(r.id || '—'), 16, y);
                doc.text(String(r.name || 'User').slice(0, 18), 50, y);
                doc.text(String(r.role || 'Member'), 95, y);
                doc.text(String(r.service || 'AEPS').slice(0, 16), 130, y);
                doc.text(`INR ${Number(r.grossAmount || 0).toLocaleString('en-IN')}`, 175, y);
                doc.text(`INR ${Number(r.tdsAmount || 0).toLocaleString('en-IN')}`, 205, y);
                doc.text(`INR ${Number(r.netAmount || 0).toLocaleString('en-IN')}`, 235, y);
                doc.text('CREDITED', 265, y);
                y += 6;
            });

            doc.save(`Rupiksha_Commission_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
            onToast({ type: 'success', message: 'Commission Ledger exported to PDF' });
        } catch (_) {
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
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross Commission</p>
                        <p className="text-lg font-black text-slate-900 mt-0.5">{fmtINR(totalGross)}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center font-bold">
                        ₹
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TDS Withheld (2%)</p>
                        <p className="text-lg font-black text-rose-600 mt-0.5">-{fmtINR(totalTds)}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                        %
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Paid Float</p>
                        <p className="text-lg font-black text-emerald-600 mt-0.5">{fmtINR(totalNet)}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        ✓
                    </div>
                </div>
            </div>

            {/* Filter and Action Bar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    <div className="relative min-w-[240px] flex-1 max-w-md">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-pink-400 font-medium"
                            placeholder="Search beneficiary, mobile, ref ID..."
                        />
                    </div>

                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-pink-400"
                    >
                        <option value="ALL">All Member Roles</option>
                        <option value="RETAILER">Retailers</option>
                        <option value="DISTRIBUTOR">Distributors</option>
                        <option value="SUPER_DISTRIBUTOR">Super Distributors</option>
                    </select>

                    <select
                        value={serviceFilter}
                        onChange={e => setServiceFilter(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-pink-400"
                    >
                        <option value="ALL">All Services</option>
                        <option value="AEPS">AePS Commission</option>
                        <option value="DMT">Money Transfer (DMT)</option>
                        <option value="BBPS">BBPS Utilities</option>
                        <option value="CMS">CMS Collection</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowDistributeModal(true)}
                        className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
                    >
                        <Plus size={14} /> Distribute Commission
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                    >
                        <FileSpreadsheet size={14} /> Excel
                    </button>
                    <button
                        onClick={handleExportPdf}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                    >
                        <Download size={14} /> PDF
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                {['Commission Ref', 'Beneficiary User', 'Role', 'Service', 'Gross (₹)', 'TDS (2%)', 'GST (₹)', 'Net Paid (₹)', 'Date', 'Status'].map(h => (
                                    <th key={h} className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(rec => (
                                <tr key={rec.id} className="hover:bg-pink-50/20 transition-colors">
                                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-slate-500 whitespace-nowrap">{rec.id}</td>
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                        <p className="text-xs font-black text-slate-900">{rec.name}</p>
                                        <p className="text-[10px] text-slate-400">{rec.mobile || rec.username}</p>
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase border ${getRoleBadge(rec.role)}`}>
                                            {rec.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                                            {rec.service}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap text-xs font-black text-slate-800">
                                        {fmtINR(rec.grossAmount)}
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap text-xs font-bold text-rose-600">
                                        -{fmtINR(rec.tdsAmount)}
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap text-xs font-bold text-slate-400">
                                        {rec.gstAmount > 0 ? `-${fmtINR(rec.gstAmount)}` : '₹0.00'}
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap text-sm font-black text-emerald-600">
                                        +{fmtINR(rec.netAmount)}
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500">
                                        {fmtDateTime(rec.date)}
                                    </td>
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase">
                                            {rec.status || 'CREDITED'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-xs text-slate-400 font-bold">
                                        No commission records found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Distribute Commission Modal */}
            {showDistributeModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden">
                        <div className="p-6 bg-gradient-to-r from-pink-600 to-rose-600 text-white flex items-center justify-between">
                            <h3 className="font-black text-base uppercase tracking-tight">Distribute Commission</h3>
                            <button onClick={() => setShowDistributeModal(false)} className="text-white/80 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleDistributeSubmit} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Beneficiary User *</label>
                                <UserSelector
                                    users={users}
                                    value={distForm.userId}
                                    onChange={v => setDistForm(p => ({ ...p, userId: v }))}
                                    placeholder="Select user..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross Amount (₹) *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        value={distForm.grossAmount}
                                        onChange={e => setDistForm(p => ({ ...p, grossAmount: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-black outline-none focus:border-pink-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GST Rate (%)</label>
                                    <select
                                        value={distForm.gstRate}
                                        onChange={e => setDistForm(p => ({ ...p, gstRate: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-pink-500"
                                    >
                                        <option value="0">0% (Exempt)</option>
                                        <option value="18">18% GST</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Channel</label>
                                <select
                                    value={distForm.service}
                                    onChange={e => setDistForm(p => ({ ...p, service: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-pink-500"
                                >
                                    <option value="AEPS_COMMISSION">AePS Cash Withdrawal Commission</option>
                                    <option value="DMT_OVERRIDE">DMT Money Transfer Override</option>
                                    <option value="BBPS_COMMISSION">BBPS Utility Bill Commission</option>
                                    <option value="CMS_COLLECTION">CMS Cash Collection Commission</option>
                                    <option value="MANUAL_INCENTIVE">Admin Special Incentive / Target Reward</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remark / Description</label>
                                <input
                                    type="text"
                                    value={distForm.remark}
                                    onChange={e => setDistForm(p => ({ ...p, remark: e.target.value }))}
                                    placeholder="Optional remark..."
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-pink-500"
                                />
                            </div>

                            {/* Live Breakdown */}
                            {parseFloat(distForm.grossAmount) > 0 && (
                                <div className="p-3 bg-pink-50 rounded-xl border border-pink-100 text-xs space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 font-bold">Gross Commission:</span>
                                        <span className="font-black text-slate-900">{fmtINR(distForm.grossAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-rose-600">
                                        <span>TDS (2% Section 194H):</span>
                                        <span className="font-bold">-{fmtINR((parseFloat(distForm.grossAmount) * 2) / 100)}</span>
                                    </div>
                                    {parseFloat(distForm.gstRate) > 0 && (
                                        <div className="flex justify-between text-rose-600">
                                            <span>GST ({distForm.gstRate}%):</span>
                                            <span className="font-bold">-{fmtINR((parseFloat(distForm.grossAmount) * parseFloat(distForm.gstRate)) / 100)}</span>
                                        </div>
                                    )}
                                    <div className="pt-1.5 border-t border-pink-200 flex justify-between items-center text-sm">
                                        <span className="font-black text-slate-800">Net Credited to Wallet:</span>
                                        <span className="font-black text-emerald-600">
                                            {fmtINR(parseFloat(distForm.grossAmount) - ((parseFloat(distForm.grossAmount) * 2) / 100) - ((parseFloat(distForm.grossAmount) * parseFloat(distForm.gstRate)) / 100))}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={distributing}
                                className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all"
                            >
                                {distributing ? 'Processing...' : 'Authorize Commission Payout'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RupikshaCommissionLedgerTab;

import React, { useState, useEffect } from 'react';
import ReportTable from './ReportTable';
import { commissionService } from '../../../services/commissionService';
import { sharedDataService } from '../../../services/sharedDataService';

const fmtCur = (n) =>
    Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return String(d);
    }
};

const CommissionReport = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadCommissionData = async () => {
        setLoading(true);
        try {
            const res = await commissionService.getRetailerHistory({ size: 100 });
            const list = res?.content || (Array.isArray(res) ? res : []);
            const formatted = list.map(item => ({
                id: item.id || item.commissionReference,
                date: fmtDate(item.createdAt),
                retailer: item.retailerName || item.retailerUsername || 'Retailer',
                service: (item.serviceType || 'AEPS 1').replace(/_/g, ' '),
                planCode: item.planCode || 'FREE',
                ref: item.commissionReference || item.originalTransactionId || '—',
                amt: fmtCur(item.transactionAmount),
                comm: fmtCur(item.commissionAmount),
                status: item.status || 'SUCCESS'
            }));
            setData(formatted);
        } catch (err) {
            console.error('Failed to load commission report:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCommissionData();
    }, []);

    return (
        <ReportTable
            title="Commission Report"
            columns={[
                { label: 'Date / Time', key: 'date' },
                { label: 'Retailer', key: 'retailer' },
                { label: 'Service', key: 'service' },
                { label: 'Plan', key: 'planCode', render: (v) => <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">{v}</span> },
                { label: 'Commission Ref', key: 'ref' },
                { label: 'Txn Amount', key: 'amt', render: (v) => <span className="font-bold text-slate-700">₹ {v}</span> },
                { label: 'Commission Credited', key: 'comm', render: (v) => <span className="text-emerald-600 font-black">₹ {v}</span> },
                { label: 'Status', key: 'status', render: (v) => <span className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full border border-emerald-100">{v || 'Settled'}</span> }
            ]}
            data={data}
        />
    );
};

export default CommissionReport;

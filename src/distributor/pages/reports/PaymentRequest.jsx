import React from 'react';
import FundRequestHistoryView from '../../../components/shared/FundRequestHistoryView';

const PaymentRequest = () => (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-16 font-['Inter',sans-serif]">
        <FundRequestHistoryView
            title="Payment Request Report"
            subtitle="Official log of manual bank deposit requests and company float verification"
        />
    </div>
);

export default PaymentRequest;

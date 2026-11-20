import React, { useState, useEffect } from 'react';
import { payoutService, userService } from '../../services/apiService';
import { payoutChargeService } from '../../services/payoutChargeService';
import DisabledServiceBanner from '../../components/shared/DisabledServiceBanner';
import PayoutOtpModal from '../../components/payout/PayoutOtpModal';

const Payout = () => {
  const [formData, setFormData] = useState({
    payoutPipe: 'QUICKZAPS',
    amount: '',
    beneficiaryName: '',
    accountNumber: '',
    ifsc: '',
    bankName: '',
    transferMode: 'IMPS',
    remarks: '',
    mobileNumber: '',
    accountType: 'Savings'
  });

  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [serviceDisabled, setServiceDisabled] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showTransactions, setShowTransactions] = useState(false);

  // Dynamic Payout Limit Settings (per transaction)
  const [payoutLimits, setPayoutLimits] = useState({ minimumPayoutAmount: 100, maximumPayoutAmount: 100000 });

  // Mandatory Payout OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpChallengeData, setOtpChallengeData] = useState(null);
  const [pendingPayoutData, setPendingPayoutData] = useState(null);
  const [pendingIdempotencyKey, setPendingIdempotencyKey] = useState(null);

  useEffect(() => {
    const checkService = async () => {
      try {
        const services = await userService.getUserServices();
        if (services && services.PAYOUT === false) {
          setServiceDisabled(true);
        }
      } catch (e) {
        console.warn("Could not verify payout service status", e);
      }
    };
    checkService();
    generateOrderId();
    payoutChargeService.getLimits().then(res => {
      if (res && res.minimumPayoutAmount != null && res.maximumPayoutAmount != null) {
        setPayoutLimits(res);
      }
    }).catch(err => {
      console.warn("Could not fetch payout limits:", err);
    });
  }, []);

  if (serviceDisabled) {
    return <DisabledServiceBanner serviceName="Payout" />;
  }

  const generateOrderId = async () => {
    try {
      const result = await payoutService.generateOrderId();
      setOrderId(result.orderId);
    } catch (err) {
      console.error('Failed to generate order ID:', err);
      setOrderId(`PO${Date.now()}`);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const minLimit = payoutLimits.minimumPayoutAmount != null ? Number(payoutLimits.minimumPayoutAmount) : 100;
    const maxLimit = payoutLimits.maximumPayoutAmount != null ? Number(payoutLimits.maximumPayoutAmount) : 100000;
    if (!formData.amount || parseFloat(formData.amount) < minLimit) {
      setError(`Minimum payout amount is ₹${minLimit.toLocaleString('en-IN')}.`);
      return false;
    }
    if (parseFloat(formData.amount) > maxLimit) {
      setError(`Maximum payout amount per transaction is ₹${maxLimit.toLocaleString('en-IN')}. Please initiate a separate payout for any additional amount.`);
      return false;
    }
    if (!formData.beneficiaryName || formData.beneficiaryName.length < 3) {
      setError('Beneficiary name must be at least 3 characters');
      return false;
    }
    if (!formData.accountNumber || !/^[0-9]{9,18}$/.test(formData.accountNumber)) {
      setError('Invalid account number (9-18 digits)');
      return false;
    }
    if (!formData.ifsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifsc.toUpperCase())) {
      setError('Invalid IFSC code');
      return false;
    }
    if (formData.mobileNumber && !/^[6-9][0-9]{9}$/.test(formData.mobileNumber)) {
      setError('Invalid mobile number');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResponse(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const payoutData = {
        PayoutPipe: formData.payoutPipe,
        OrderId: orderId,
        Amount: parseFloat(formData.amount),
        BeneficiaryName: formData.beneficiaryName,
        AccountNumber: formData.accountNumber,
        Ifsc: formData.ifsc.toUpperCase(),
        BankName: formData.bankName || '',
        TransferMode: formData.transferMode,
        Remarks: formData.remarks || '',
        MobileNumber: formData.mobileNumber || '',
        AccountType: formData.accountType
      };

      const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : (`po_idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

      const sendPayload = {
        amount: parseFloat(formData.amount),
        beneficiaryName: formData.beneficiaryName.trim(),
        accountNumber: formData.accountNumber.trim(),
        ifsc: formData.ifsc.toUpperCase().trim(),
        bankName: formData.bankName || '',
        transferMode: formData.transferMode,
        remarks: formData.remarks || ''
      };

      // Stage A: Call Send OTP
      const otpRes = await payoutService.sendOtp(sendPayload);

      if (otpRes && otpRes.success) {
        setOtpChallengeData({
          ...otpRes,
          beneficiaryName: formData.beneficiaryName.trim(),
          accountNumber: formData.accountNumber.trim(),
          ifsc: formData.ifsc.toUpperCase().trim(),
          transferMode: formData.transferMode
        });
        setPendingPayoutData(payoutData);
        setPendingIdempotencyKey(idempotencyKey);
        setShowOtpModal(true);
      } else {
        setError(otpRes?.message || 'Failed to dispatch verification OTP. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Failed to dispatch verification OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndConfirmPayout = async (otpCode) => {
    if (!otpChallengeData || !pendingPayoutData) {
      throw new Error('Payout session expired. Please retry.');
    }

    const verifyPayload = {
      challengeId: otpChallengeData.challengeId,
      payoutIntentId: otpChallengeData.payoutIntentId,
      otp: otpCode,
      amount: pendingPayoutData.Amount,
      accountNumber: pendingPayoutData.AccountNumber,
      ifsc: pendingPayoutData.Ifsc,
      transferMode: pendingPayoutData.TransferMode
    };

    const verifyRes = await payoutService.verifyOtp(verifyPayload);

    if (!verifyRes || !verifyRes.success || !verifyRes.authorizationReference) {
      throw new Error(verifyRes?.message || 'OTP verification failed.');
    }

    // Call existing payout API only after OTP verification
    const finalPayload = {
      ...pendingPayoutData,
      authorizationReference: verifyRes.authorizationReference,
      payoutIntentId: otpChallengeData.payoutIntentId
    };

    const result = await payoutService.initiatePayout(finalPayload, pendingIdempotencyKey);
    setShowOtpModal(false);
    setResponse(result);

    if (result.statusCode === '200' || result.status === 'SUCCESS' || result.status === 'PENDING') {
      setFormData({
        payoutPipe: 'QUICKZAPS',
        amount: '',
        beneficiaryName: '',
        accountNumber: '',
        ifsc: '',
        bankName: '',
        transferMode: 'IMPS',
        remarks: '',
        mobileNumber: '',
        accountType: 'Savings'
      });
      generateOrderId();
    }
  };

  const handleResendPayoutOtp = async () => {
    if (!pendingPayoutData) throw new Error('Session expired');
    const sendPayload = {
      amount: pendingPayoutData.Amount,
      beneficiaryName: pendingPayoutData.BeneficiaryName,
      accountNumber: pendingPayoutData.AccountNumber,
      ifsc: pendingPayoutData.Ifsc,
      bankName: pendingPayoutData.BankName,
      transferMode: pendingPayoutData.TransferMode,
      remarks: pendingPayoutData.Remarks
    };
    const res = await payoutService.sendOtp(sendPayload);
    if (res && res.success) {
      setOtpChallengeData(prev => ({ ...prev, ...res }));
      return res;
    }
    throw new Error(res?.message || 'Failed to resend OTP');
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const result = await payoutService.getTransactions();
      setTransactions(result);
      setShowTransactions(true);
    } catch (err) {
      setError('Failed to fetch transactions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'SUCCESS':
        return 'text-green-600 bg-green-100';
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-100';
      case 'FAILED':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Payout Service</h1>
          <p className="text-gray-600 mb-6">Transfer money to bank accounts instantly</p>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {response && (
            <div className={`border px-4 py-3 rounded mb-4 ${
              response.statusCode === '200' || response.status === 'SUCCESS'
                ? 'bg-green-100 border-green-400 text-green-700'
                : 'bg-red-100 border-red-400 text-red-700'
            }`}>
              <p className="font-semibold">Status: {response.statusCode}</p>
              <p>{response.message}</p>
              {response.utr && <p className="mt-2">UTR: {response.utr}</p>}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order ID
                </label>
                <input
                  type="text"
                  value={orderId}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Amount (₹) *
                  </label>
                  <span className="text-xs text-gray-500 font-medium">
                    Min: ₹{(Number(payoutLimits.minimumPayoutAmount) || 100).toLocaleString('en-IN')} | Max Per Txn: ₹{(Number(payoutLimits.maximumPayoutAmount) || 100000).toLocaleString('en-IN')}
                  </span>
                </div>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  min={Number(payoutLimits.minimumPayoutAmount) || 100}
                  max={Number(payoutLimits.maximumPayoutAmount) || 100000}
                  step="0.01"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder={`Enter amount (Min ₹${(Number(payoutLimits.minimumPayoutAmount) || 100).toLocaleString('en-IN')})`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beneficiary Name *
                </label>
                <input
                  type="text"
                  name="beneficiaryName"
                  value={formData.beneficiaryName}
                  onChange={handleInputChange}
                  required
                  minLength="3"
                  maxLength="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter beneficiary name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Number *
                </label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  required
                  pattern="[0-9]{9,18}"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter account number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IFSC Code *
                </label>
                <input
                  type="text"
                  name="ifsc"
                  value={formData.ifsc}
                  onChange={handleInputChange}
                  required
                  pattern="[A-Z]{4}0[A-Z0-9]{6}"
                  maxLength="11"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 uppercase"
                  placeholder="e.g., SBIN0001234"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter bank name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transfer Mode *
                </label>
                <select
                  name="transferMode"
                  value={formData.transferMode}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="IMPS">IMPS (Instant)</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Type *
                </label>
                <select
                  name="accountType"
                  value={formData.accountType}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  onChange={handleInputChange}
                  pattern="[6-9][0-9]{9}"
                  maxLength="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="10-digit mobile number"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleInputChange}
                  maxLength="200"
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional remarks"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                {loading ? 'Processing...' : 'Initiate Payout'}
              </button>

              <button
                type="button"
                onClick={fetchTransactions}
                disabled={loading}
                className="bg-gray-600 text-white py-3 px-6 rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                View History
              </button>
            </div>
          </form>
        </div>

        {showTransactions && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Transaction History</h2>
              <button
                onClick={() => setShowTransactions(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                ✕
              </button>
            </div>

            {transactions.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No transactions found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Beneficiary</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.map((txn) => (
                      <tr key={txn.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{txn.orderId}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{txn.beneficiaryName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">₹{txn.amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(txn.status)}`}>
                            {txn.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(txn.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <PayoutOtpModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        challengeData={otpChallengeData}
        onVerifyAndConfirm={handleVerifyAndConfirmPayout}
        onResendOtp={handleResendPayoutOtp}
      />
    </div>
  );
};

export default Payout;

// Made with Bob

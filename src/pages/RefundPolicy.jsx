import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function RefundPolicy() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#0f172a] flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar />

      {/* Hero Header */}
      <header className="bg-white border-b border-slate-200/90 pt-28 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-4 tracking-wider uppercase">
            <button onClick={() => navigate('/')} className="hover:text-blue-600 transition-colors">Home</button>
            <span>/</span>
            <span className="text-slate-900">Legal</span>
            <span>/</span>
            <span className="text-blue-600 font-bold">Refund Policy</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0f172a] tracking-tight">
                RUPIKSHA
              </h1>
              <p className="mt-2 text-base sm:text-lg text-slate-700 font-bold uppercase tracking-wide">
                REFUND AND CANCELLATION POLICY
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2 sm:self-start">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Cancellation & Refund
              </span>
            </div>
          </div>

          {/* Policy Navigation Tabs */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-2 sm:gap-3 flex-wrap text-xs sm:text-sm">
            <button 
              onClick={() => { navigate('/privacy-policy'); window.scrollTo(0, 0); }}
              className="px-4 py-2 rounded-lg font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200/80 transition-all"
            >
              Privacy Policy
            </button>
            <button 
              onClick={() => { navigate('/terms-and-conditions'); window.scrollTo(0, 0); }}
              className="px-4 py-2 rounded-lg font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200/80 transition-all"
            >
              Terms & Condition
            </button>
            <button 
              onClick={() => { navigate('/refund-policy'); window.scrollTo(0, 0); }}
              className="px-4 py-2 rounded-lg font-bold bg-[#0f172a] text-white shadow-sm transition-all"
            >
              Refund Policy
            </button>
            <span className="ml-auto text-xs text-slate-600 font-medium hidden md:inline-block">
              Website: <a href="https://rupiksha.in" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold hover:underline">https://rupiksha.in</a>
            </span>
          </div>
        </div>
      </header>

      {/* Main Legal Document Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 lg:p-12 space-y-9 text-[#0f172a]">

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">1.</span>
              Introduction
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-2 font-normal">
              <p>
                Rupiksha provides digital financial and business services, including AEPS, mobile and DTH recharge, BBPS, money transfer, payout services, wallet transactions, and other services available through its platform.
              </p>
              <p>
                This Refund and Cancellation Policy explains the circumstances under which refunds, reversals, and transaction adjustments may be provided. By using Rupiksha, users agree to this policy and the applicable terms of the relevant service.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">2.</span>
              Wallet Recharge and Payment Gateway Transactions
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              <li>Payments made through an integrated payment gateway, including Razorpay, are subject to transaction verification and settlement confirmation.</li>
              <li>If a payment is successful and the corresponding service or wallet credit is delivered, the payment is generally non-refundable unless required by applicable law or approved under the applicable service terms.</li>
              <li>If money is deducted from a user's bank account but the payment fails or the wallet is not credited, the transaction will be verified and the eligible amount will be credited or refunded through the appropriate payment channel.</li>
              <li>Duplicate payments for the same transaction will be investigated and, if confirmed, the duplicate amount will be refunded or reversed.</li>
              <li>Refund timelines may depend on the payment gateway, bank, card issuer, or other payment provider.</li>
              <li>Users should retain their payment reference, transaction ID, and payment confirmation for investigation.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">3.</span>
              ID Registration Charges
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              <li>Certain Rupiksha accounts may require payment of an ID registration or activation charge before portal access is enabled.</li>
              <li>The applicable charge will be displayed to the user before payment.</li>
              <li>Where an administrator-issued coupon is valid, eligible users may apply the discount before completing payment.</li>
              <li>Coupons are account-specific, valid for 24 hours from generation, and subject to the displayed terms.</li>
              <li>A successful payment will be recorded against the relevant user account.</li>
              <li>If payment succeeds but account activation is not completed due to a technical issue, the user should contact support for verification and resolution.</li>
              <li>Registration charges are generally non-refundable once the registration or activation service has been successfully provided, except where a refund is required by applicable law or approved under the applicable terms.</li>
              <li>Duplicate payments or verified payment failures will be handled according to Section 2.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">4.</span>
              AEPS, Recharge, BBPS, and Other Service Transactions
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-2.5 font-normal">
              <p>Service transactions are processed through the relevant service provider or banking partner.</p>
              <ul className="list-disc pl-5 space-y-2 text-slate-900 font-normal">
                <li><strong>Successful transactions:</strong> Generally not eligible for cancellation or refund after the service has been successfully delivered.</li>
                <li><strong>Failed transactions:</strong> If a transaction fails and the amount has been debited, the transaction will be checked against the provider's status and settlement records. Eligible amounts will be reversed or refunded.</li>
                <li><strong>Pending transactions:</strong> A pending transaction must be verified before a refund or reversal is initiated. Users should not repeatedly submit the same transaction while its status remains unresolved.</li>
                <li><strong>Duplicate transactions:</strong> Confirmed duplicate debits will be investigated and eligible amounts will be reversed or refunded.</li>
                <li><strong>Incorrect transaction details:</strong> Transactions initiated using incorrect recipient details may not be refundable. Resolution depends on the transaction type, provider rules, and applicable law.</li>
              </ul>
              <p className="italic text-slate-600">Provider confirmation may be required before the final resolution of a disputed transaction.</p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">5.</span>
              Wallet-to-Wallet Transfers
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              <li>Wallet-to-wallet transfers between Rupiksha users are intended to be completed using the recipient details confirmed by the sender.</li>
              <li>Once a transfer has been successfully completed, it generally cannot be cancelled or automatically refunded.</li>
              <li>Users must verify the recipient's name, party code, and transfer amount before confirming the transaction.</li>
              <li>If a transfer is duplicated, incorrectly processed, or affected by a technical failure, the user may raise a support request for investigation.</li>
              <li>Transfers made to the wrong recipient are subject to investigation and applicable recovery procedures. Recovery is not guaranteed.</li>
              <li>Rupiksha will not promise a reversal until the transaction has been verified and the appropriate resolution has been authorized.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">6.</span>
              Payout and Money Transfer Transactions
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              <li>Payouts and money transfers are subject to the relevant banking and payment provider's processing rules.</li>
              <li>If a payout is marked failed but the amount has been debited from the user's wallet, Rupiksha will verify the final provider status before processing a reversal.</li>
              <li>If the payout is pending or the provider's response is uncertain, the amount may remain under investigation until the outcome is confirmed. This helps prevent duplicate payouts and incorrect refunds.</li>
              <li>Confirmed failed transactions will be handled through the applicable reversal or refund process.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">7.</span>
              Refund Processing Time
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              <li>Refund and reversal timelines vary by transaction type, payment method, and service provider.</li>
              <li>Rupiksha will initiate an eligible refund or reversal after the transaction has been verified and approved.</li>
              <li>Bank, card, UPI, and payment gateway refunds may take additional time to appear in the user's account.</li>
              <li>Wallet adjustments may be reflected after the applicable internal verification and processing steps.</li>
              <li>If a refund has not appeared within the communicated timeframe, users should contact support with the original transaction reference.</li>
              <li>Any timeline communicated by Rupiksha is subject to the applicable provider's processing requirements and regulatory obligations.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">8.</span>
              How to Request a Refund
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-3 font-normal">
              <p>
                Users can submit a refund or transaction-dispute request through the Rupiksha Help & Support section or the official support contact published on the website.
              </p>
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 sm:p-5">
                <p className="font-bold text-slate-900 mb-2">Please provide:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-800">
                  <li>Full name and registered mobile number.</li>
                  <li>Rupiksha user ID or party code.</li>
                  <li>Transaction ID or order reference.</li>
                  <li>Transaction date and amount.</li>
                  <li>Payment reference, where applicable.</li>
                  <li>A short explanation of the issue.</li>
                  <li>Relevant payment confirmation or transaction receipt.</li>
                </ul>
                <p className="text-xs font-bold text-red-600 mt-3 pt-3 border-t border-slate-200">
                  ⚠️ Never share your password, wallet PIN, OTP, or complete payment-card credentials when raising a request.
                </p>
              </div>
            </div>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">9.</span>
              Review and Resolution
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              <li>Rupiksha may review transaction records, wallet ledger entries, payment gateway records, and service-provider responses to establish the actual transaction status.</li>
              <li>Users must provide accurate information and reasonable cooperation during the investigation.</li>
              <li>Refunds will not be issued solely on the basis of a screenshot if the underlying transaction records do not support the claim. Fraudulent, duplicate, or misleading claims may be investigated in accordance with applicable law.</li>
              <li>Nothing in this policy excludes any consumer rights or remedies that cannot legally be excluded.</li>
            </ul>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">10.</span>
              Changes to This Policy
            </h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              Rupiksha may update this policy to reflect changes in its services, payment arrangements, provider requirements, or applicable law. The latest version will be published on the official website with its effective date.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">11.</span>
              Contact and Support
            </h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              For refund requests, failed transactions, duplicate payments, or account activation issues, please contact Rupiksha through the official Help & Support section on <a href="https://rupiksha.in" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold underline underline-offset-2">https://rupiksha.in</a>.
            </p>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-medium">
              Please include the transaction reference and registered account details needed to investigate your request.
            </p>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
}

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
    <div className="min-h-screen bg-white text-[#0f172a] flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar />

      {/* Hero Header */}
      <section className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-200/80 pt-28 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-4 uppercase tracking-wider">
            <button onClick={() => navigate('/')} className="hover:text-blue-600 transition-colors">Home</button>
            <span>/</span>
            <span className="text-slate-900">Refund Policy</span>
          </nav>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60 mb-3">
            Financial Transparency
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0f172a] tracking-tight leading-tight">
            RUPIKSHA
          </h1>
          <p className="mt-2 text-xl sm:text-2xl text-slate-800 font-bold uppercase tracking-wide">
            REFUND AND CANCELLATION POLICY
          </p>
          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <span>Official Website: <a href="https://rupiksha.in" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold underline underline-offset-2">https://rupiksha.in</a></span>
            <span className="font-semibold text-slate-700">Effective: 2026</span>
          </div>
        </div>
      </section>

      {/* Main Content Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-10 space-y-8 text-[#0f172a]">

          {/* Section 1 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">1</span>
              Introduction
            </h2>
            <div className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify space-y-2">
              <p>
                Rupiksha provides digital financial and business services, including AEPS, mobile and DTH recharge, BBPS, money transfer, payout services, wallet transactions, and other services available through its platform.
              </p>
              <p>
                This Refund and Cancellation Policy explains the circumstances under which refunds, reversals, and transaction adjustments may be provided. By using Rupiksha, users agree to this policy and the applicable terms of the relevant service.
              </p>
            </div>
          </article>

          {/* Section 2 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">2</span>
              Wallet Recharge and Payment Gateway Transactions
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              <li>Payments made through an integrated payment gateway, including Razorpay, are subject to transaction verification and settlement confirmation.</li>
              <li>If a payment is successful and the corresponding service or wallet credit is delivered, the payment is generally non-refundable unless required by applicable law or approved under the applicable service terms.</li>
              <li>If money is deducted from a user's bank account but the payment fails or the wallet is not credited, the transaction will be verified and the eligible amount will be credited or refunded through the appropriate payment channel.</li>
              <li>Duplicate payments for the same transaction will be investigated and, if confirmed, the duplicate amount will be refunded or reversed.</li>
              <li>Refund timelines may depend on the payment gateway, bank, card issuer, or other payment provider.</li>
              <li>Users should retain their payment reference, transaction ID, and payment confirmation for investigation.</li>
            </ul>
          </article>

          {/* Section 3 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">3</span>
              ID Registration Charges
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              <li>Certain Rupiksha accounts may require payment of an ID registration or activation charge before portal access is enabled.</li>
              <li>The applicable charge will be displayed to the user before payment.</li>
              <li>Where an administrator-issued coupon is valid, eligible users may apply the discount before completing payment.</li>
              <li>Coupons are account-specific, valid for 24 hours from generation, and subject to the displayed terms.</li>
              <li>A successful payment will be recorded against the relevant user account.</li>
              <li>If payment succeeds but account activation is not completed due to a technical issue, the user should contact support for verification and resolution.</li>
              <li>Registration charges are generally non-refundable once the registration or activation service has been successfully provided, except where a refund is required by applicable law or approved under the applicable terms.</li>
              <li>Duplicate payments or verified payment failures will be handled according to Section 2.</li>
            </ul>
          </article>

          {/* Section 4 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">4</span>
              AEPS, Recharge, BBPS, and Other Service Transactions
            </h2>
            <div className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify space-y-2.5">
              <p>Service transactions are processed through the relevant service provider or banking partner.</p>
              <ul className="list-disc pl-5 space-y-2 text-slate-900">
                <li><strong>Successful transactions:</strong> Generally not eligible for cancellation or refund after the service has been successfully delivered.</li>
                <li><strong>Failed transactions:</strong> If a transaction fails and the amount has been debited, the transaction will be checked against the provider's status and settlement records. Eligible amounts will be reversed or refunded.</li>
                <li><strong>Pending transactions:</strong> A pending transaction must be verified before a refund or reversal is initiated. Users should not repeatedly submit the same transaction while its status remains unresolved.</li>
                <li><strong>Duplicate transactions:</strong> Confirmed duplicate debits will be investigated and eligible amounts will be reversed or refunded.</li>
                <li><strong>Incorrect transaction details:</strong> Transactions initiated using incorrect recipient details may not be refundable. Resolution depends on the transaction type, provider rules, and applicable law.</li>
              </ul>
              <p className="italic text-slate-700">Provider confirmation may be required before the final resolution of a disputed transaction.</p>
            </div>
          </article>

          {/* Section 5 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">5</span>
              Wallet-to-Wallet Transfers
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              <li>Wallet-to-wallet transfers between Rupiksha users are intended to be completed using the recipient details confirmed by the sender.</li>
              <li>Once a transfer has been successfully completed, it generally cannot be cancelled or automatically refunded.</li>
              <li>Users must verify the recipient's name, party code, and transfer amount before confirming the transaction.</li>
              <li>If a transfer is duplicated, incorrectly processed, or affected by a technical failure, the user may raise a support request for investigation.</li>
              <li>Transfers made to the wrong recipient are subject to investigation and applicable recovery procedures. Recovery is not guaranteed.</li>
              <li>Rupiksha will not promise a reversal until the transaction has been verified and the appropriate resolution has been authorized.</li>
            </ul>
          </article>

          {/* Section 6 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">6</span>
              Payout and Money Transfer Transactions
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              <li>Payouts and money transfers are subject to the relevant banking and payment provider's processing rules.</li>
              <li>If a payout is marked failed but the amount has been debited from the user's wallet, Rupiksha will verify the final provider status before processing a reversal.</li>
              <li>If the payout is pending or the provider's response is uncertain, the amount may remain under investigation until the outcome is confirmed. This helps prevent duplicate payouts and incorrect refunds.</li>
              <li>Confirmed failed transactions will be handled through the applicable reversal or refund process.</li>
            </ul>
          </article>

          {/* Section 7 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">7</span>
              Refund Processing Time
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              <li>Refund and reversal timelines vary by transaction type, payment method, and service provider.</li>
              <li>Rupiksha will initiate an eligible refund or reversal after the transaction has been verified and approved.</li>
              <li>Bank, card, UPI, and payment gateway refunds may take additional time to appear in the user's account.</li>
              <li>Wallet adjustments may be reflected after the applicable internal verification and processing steps.</li>
              <li>If a refund has not appeared within the communicated timeframe, users should contact support with the original transaction reference.</li>
              <li>Any timeline communicated by Rupiksha is subject to the applicable provider's processing requirements and regulatory obligations.</li>
            </ul>
          </article>

          {/* Section 8 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">8</span>
              How to Request a Refund
            </h2>
            <div className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify space-y-3">
              <p>
                Users can submit a refund or transaction-dispute request through the Rupiksha Help & Support section or the official support contact published on the website.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <p className="font-bold text-slate-900 mb-2">Please provide the following details:</p>
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
          </article>

          {/* Section 9 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">9</span>
              Review and Resolution
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              <li>Rupiksha may review transaction records, wallet ledger entries, payment gateway records, and service-provider responses to establish the actual transaction status.</li>
              <li>Users must provide accurate information and reasonable cooperation during the investigation.</li>
              <li>Refunds will not be issued solely on the basis of a screenshot if the underlying transaction records do not support the claim. Fraudulent, duplicate, or misleading claims may be investigated in accordance with applicable law.</li>
              <li>Nothing in this policy excludes any consumer rights or remedies that cannot legally be excluded.</li>
            </ul>
          </article>

          {/* Section 10 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">10</span>
              Changes to This Policy
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              Rupiksha may update this policy to reflect changes in its services, payment arrangements, provider requirements, or applicable law. The latest version will be published on the official website with its effective date.
            </p>
          </article>

          {/* Section 11 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">11</span>
              Contact and Support
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              For refund requests, failed transactions, duplicate payments, or account activation issues, please contact Rupiksha through the official Help & Support section on <a href="https://rupiksha.in" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold underline underline-offset-2">https://rupiksha.in</a>.
            </p>
            <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify font-medium">
              Please include the transaction reference and registered account details needed to investigate your request.
            </p>
          </article>

        </div>
      </main>

      <Footer />
    </div>
  );
}

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function PrivacyPolicy() {
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
            <span className="text-slate-900">Privacy Policy</span>
          </nav>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60 mb-3">
            Legal & Compliance
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0f172a] tracking-tight leading-tight">
            Our Privacy
          </h1>
          <p className="mt-2 text-base sm:text-lg text-slate-600 font-medium">
            Comprehensive financial solutions for businesses and individuals
          </p>
          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <span>Official Policy Document</span>
            <span className="font-semibold text-slate-700">Last updated: February 2026</span>
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
            <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              Welcome to Rupiksha. We are committed to protecting your privacy and ensuring that your personal information is handled in a safe and responsible manner. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our services, or make a payment through our platform. Please read this policy carefully. If you do not agree with the terms of this Privacy Policy, please do not access or use our website or services. Rupiksha Privacy
            </p>
          </article>

          {/* Section 2 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">2</span>
              What personal information do we collect?
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              We collect personal information from you when you visit our website, sign up for our services, or contact us. This information includes your name, email address, phone number, address, pincode, and business/company affiliation.
            </p>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
              <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify font-medium">
                <strong className="text-[#0f172a] font-bold">Financial & KYC Information:</strong> To comply with RBI regulations and provide our financial services (like AEPS and DMT), we securely collect Know Your Customer (KYC) details such as your PAN card, Aadhaar number (or Virtual ID), bank account details, and transaction history. We may also collect your IP address and other information about your device and browser for security purposes.
              </p>
            </div>
          </article>

          {/* Section 3 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">3</span>
              Why Explicit App Permissions?
            </h2>
            <ul className="space-y-2 text-sm sm:text-base text-[#0f172a]">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-1">•</span>
                <span>We collect precise location data to prevent fraud and comply with AEPS/banking geo-tagging guidelines.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-1">•</span>
                <span>We request camera access for KYC document uploads and profile picture updates.</span>
              </li>
            </ul>
          </article>

          {/* Section 4 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">4</span>
              How to delete data?
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              Users can request the deletion of their account and personal information by emailing <a href="mailto:info@rupiksha.com" className="text-blue-600 font-semibold underline underline-offset-2">info@rupiksha.com</a>. Please note that while we will delete your profile access, we are legally required by the Reserve Bank of India (RBI) and other regulatory bodies to retain certain financial transaction records and KYC data for a specified period to prevent fraud and money laundering.
            </p>
          </article>

          {/* Section 5 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">5</span>
              How do we use your personal information?
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              We use your personal information to provide you with our services, to intercommunicate with you, and to enhance our website and services. We may also use your private information to send you promotional emails or to contact you about career possibilities.
            </p>
          </article>

          {/* Section 6 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">6</span>
              How do we share your personal information?
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              We do not sell your personal information to unauthorized third parties. However, to facilitate your payments and provide our services, it is strictly necessary to share your information with trusted third parties. This includes our partner sponsor banks, payment gateways, the National Payments Corporation of India (NPCI), and our web/server hosting providers. We will also disclose your personal information to law enforcement, regulatory authorities (such as the RBI or UIDAI), or courts when strictly required to do so by law or to prevent fraud.
            </p>
          </article>

          {/* Section 7 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">7</span>
              How do we protect your personal information?
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              We use a variety of security measures to protect your private information from unauthorized access, use, or disclosure. We also limit access to your private information to employees who have a legitimate need to know.
            </p>
          </article>

          {/* Section 8 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">8</span>
              Your choices
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              You have the right to access, correct, or delete your private information. You also have the right to opt out of receiving promotional emails from us. To exercise these rights, please contact us at <a href="mailto:info@rupiksha.com" className="text-blue-600 font-semibold underline underline-offset-2">info@rupiksha.com</a>
            </p>
          </article>

          {/* Section 9 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">9</span>
              Changes to this Privacy Policy
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              We may update this Privacy Policy from time to time to reflect changes in our practices, operational requirements, or legal obligations. Any updates will be posted on this page with a revised date. We encourage you to review this Privacy Policy periodically.
            </p>
          </article>

          {/* Section 10 */}
          <article className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-black">10</span>
              Contact us
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              If you have any questions about this Privacy Policy, please contact us at <a href="mailto:info@rupiksha.com" className="text-blue-600 font-semibold underline underline-offset-2">info@rupiksha.com</a>
            </p>
          </article>

          {/* Conclusion */}
          <article className="pt-6 border-t border-slate-200 space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a]">
              Conclusion
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[#0f172a] text-justify">
              Rupiksha Services Pvt. Ltd. is committed to protecting the privacy of our users and our clients. We have implemented a number of security measures to protect your data, and we only collect and use your information in accordance with this Privacy Policy.
            </p>

            {/* Grievance Officer Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 mt-4">
              <h3 className="text-base font-extrabold text-[#0f172a] uppercase tracking-wide mb-3 flex items-center gap-2">
                <span>🛡️</span> Grievance Officer
              </h3>
              <div className="space-y-1.5 text-sm sm:text-base text-[#0f172a]">
                <p className="font-bold text-slate-900 text-base">Saurav Anand</p>
                <p><a href="mailto:saurav.anand@rupiksha.com" className="text-blue-600 font-medium hover:underline">saurav.anand@rupiksha.com</a></p>
                <p className="font-semibold text-slate-800">Rupiksha Services Private Limited</p>
                <p className="text-slate-700">Prakash Path, Ahiyapur, Muzaffarpur, Bihar, 842001</p>
                <p><span className="font-semibold">Email:</span> <a href="mailto:info@rupiksha.com" className="text-blue-600 font-medium hover:underline">info@rupiksha.com</a></p>
                <p><span className="font-semibold">Phone:</span> <a href="tel:7004128310" className="text-blue-600 font-medium hover:underline">7004128310</a></p>
              </div>
            </div>

            <p className="text-xs text-slate-600 italic pt-2">
              Changes to this privacy notice. We keep our privacy notice under regular review. This privacy notice was last updated in February 2026.
            </p>
          </article>

        </div>
      </main>

      <Footer />
    </div>
  );
}

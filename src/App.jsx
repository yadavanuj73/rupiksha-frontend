import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// --- Loading Component ---
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-[#f7f9fc]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Module...</p>
    </div>
  </div>
);

// --- Lazy Loads ---
const Login = lazy(() => import('./auth/Login'));
const AdminLogin = lazy(() => import('./auth/AdminLogin'));
const Home = lazy(() => import('./landing/Home'));
const About = lazy(() => import('./landing/About'));
const Contact = lazy(() => import('./landing/Contact'));
const ServiceDetail = lazy(() => import('./landing/ServiceDetail'));
const Leadership = lazy(() => import('./landing/Leadership'));
const CompleteKyc = lazy(() => import('./pages/CompleteKyc'));

// Retailer
const RetailerLayout = lazy(() => import('./retailer/components/RetailerLayout'));
const Dashboard = lazy(() => import('./retailer/pages/Dashboard'));
const Profile = lazy(() => import('./retailer/pages/Profile'));
const Travel = lazy(() => import('./retailer/pages/Travel'));
const Utility = lazy(() => import('./retailer/pages/Utility'));
const BharatConnect = lazy(() => import('./retailer/pages/BharatConnect'));
const PayoutHub = lazy(() => import('./retailer/pages/PayoutHub'));
const AEPS = lazy(() => import('./retailer/pages/AEPS'));
const CMS = lazy(() => import('./retailer/pages/CMS'));
const AllServices = lazy(() => import('./retailer/pages/AllServices'));
const Reports = lazy(() => import('./retailer/pages/Reports'));
const Plans = lazy(() => import('./retailer/pages/Plans'));
const MATM = lazy(() => import('./retailer/pages/MATM'));
const AddMoneyComponent = lazy(() => import('./retailer/components/banking/AddMoney'));
const Loans = lazy(() => import('./retailer/pages/Loans'));
const SaleReport = lazy(() => import('./retailer/pages/reports/SaleReport'));
const ConsolidatedLedger = lazy(() => import('./retailer/pages/reports/ConsolidatedLedger'));
const DailyLedger = lazy(() => import('./retailer/pages/reports/DailyLedger'));
const GSTInvoiceReport = lazy(() => import('./retailer/pages/reports/GstInvoiceReport'));
const AuditReport = lazy(() => import('./retailer/pages/reports/AuditReport'));

// Admin Core
const Admin = lazy(() => import('./admin/Admin'));
const RetailerDetails = lazy(() => import('./admin/components/RetailerDetails'));
const DistributorDetails = lazy(() => import('./admin/components/DistributorDetails'));
const KYCVerification = lazy(() => import('./retailer/pages/KYCVerification'));
const AepsOnboarding = lazy(() => import('./retailer/pages/AepsOnboarding'));

// Distributor
const DistributorLayout = lazy(() => import('./distributor/components/DistributorLayout'));
const DistributorDashboard = lazy(() => import('./distributor/pages/DistributorDashboard'));
const Retailers = lazy(() => import('./distributor/pages/Retailers'));
const DistributorReceipt = lazy(() => import('./distributor/pages/Receipts').then(m => ({ default: m.DistributorReceipt })));
const RetailerReceipt = lazy(() => import('./distributor/pages/Receipts').then(m => ({ default: m.RetailerReceipt })));
const AddMoney = lazy(() => import('./distributor/pages/AddMoney'));
const DistributorPlaceholder = lazy(() => import('./distributor/pages/DistributorPlaceholder'));
const DistributorPlans = lazy(() => import('./distributor/pages/DistributorPlans'));
const PlansRates = lazy(() => import('./distributor/pages/PlansRates'));
const Invoice = lazy(() => import('./distributor/pages/Invoice'));
const OldReports = lazy(() => import('./distributor/pages/OldReports'));

// Distributor Reports
const RetailerBalance = lazy(() => import('./distributor/pages/reports/RetailerBalance'));
const PaymentRequest = lazy(() => import('./distributor/pages/reports/PaymentRequest'));
const PurchaseReport = lazy(() => import('./distributor/pages/reports/PurchaseReport'));
const ChargeReport = lazy(() => import('./distributor/pages/reports/ChargeReport'));
const CommissionReport = lazy(() => import('./distributor/pages/reports/CommissionReport'));
const AepsReport = lazy(() => import('./distributor/pages/reports/AepsReport'));
const DmtReport = lazy(() => import('./distributor/pages/reports/DmtReport'));
const BbpsReport = lazy(() => import('./distributor/pages/reports/BbpsReport'));
const CmsReport = lazy(() => import('./distributor/pages/reports/CmsReport'));

// Distributor Accounts
const MyLedger = lazy(() => import('./distributor/pages/Accounts').then(m => ({ default: m.MyLedger })));
const RetailerLedger = lazy(() => import('./distributor/pages/Accounts').then(m => ({ default: m.RetailerLedger })));
const AccountsCommission = lazy(() => import('./distributor/pages/Accounts').then(m => ({ default: m.AccountsCommission })));

// Distributor Promotions
const PromotionsList = lazy(() => import('./distributor/pages/Promotions').then(m => ({ default: m.PromotionsList })));
const PromotionAssets = lazy(() => import('./distributor/pages/Promotions').then(m => ({ default: m.PromotionAssets })));

// Distributor Support
const SupportLeads = lazy(() => import('./distributor/pages/Support').then(m => ({ default: m.SupportLeads })));
const EcollectComplaints = lazy(() => import('./distributor/pages/Support').then(m => ({ default: m.EcollectComplaints })));
const RetailerComplaints = lazy(() => import('./distributor/pages/Support').then(m => ({ default: m.RetailerComplaints })));
const TrainingVideos = lazy(() => import('./distributor/pages/Support').then(m => ({ default: m.TrainingVideos })));

// SUPER_DISTRIBUTOR
const SuperDistributorLayout = lazy(() => import('./super-distributor/components/SuperDistributorLayout'));
const SuperDistributorDashboard = lazy(() => import('./super-distributor/pages/SuperDistributorDashboard'));
const SuperDistributorMembers = lazy(() => import('./super-distributor/pages/AllMembers'));
const SuperDistributorRetailers = lazy(() => import('./super-distributor/pages/Retailers'));
const SuperDistributorWalletControl = lazy(() => import('./super-distributor/pages/WalletControl'));
const SuperDistributorAddMoney = lazy(() => import('./super-distributor/pages/AddMoney'));
const SuperDistributorReceipt = lazy(() => import('./super-distributor/pages/Receipts').then(m => ({ default: m.SuperDistributorReceipt })));
const SuperDistributorRetailerReceipt = lazy(() => import('./super-distributor/pages/Receipts').then(m => ({ default: m.RetailerReceipt })));
const SuperDistributorApprovals = lazy(() => import('./super-distributor/pages/Approvals'));
const SuperDistributorLoans = lazy(() => import('./super-distributor/pages/LoanApprovals'));
const SuperDistributorDistributors = lazy(() => import('./super-distributor/pages/Distributors'));
const SuperDistributorsPage = lazy(() => import('./super-distributor/pages/SuperDistributors'));
const SuperDistributorSettings = lazy(() => import('./super-distributor/pages/SuperDistributorSettings'));
const SuperDistributorPlaceholder = lazy(() => import('./super-distributor/pages/SuperDistributorPlaceholder'));
const SuperDistributorPlans = lazy(() => import('./super-distributor/pages/SuperDistributorPlans'));
const SuperDistributorPlansRates = lazy(() => import('./super-distributor/pages/PlansRates'));
const SuperDistributorInvoice = lazy(() => import('./super-distributor/pages/Invoice'));
const SuperDistributorOldReports = lazy(() => import('./super-distributor/pages/OldReports'));

// SUPER_DISTRIBUTOR Reports
const SARetailerBalance = lazy(() => import('./super-distributor/pages/Reports').then(m => ({ default: m.RetailerBalance })));
const SAPaymentRequest = lazy(() => import('./super-distributor/pages/Reports').then(m => ({ default: m.PaymentRequest })));
const SAPurchaseReport = lazy(() => import('./super-distributor/pages/Reports').then(m => ({ default: m.PurchaseReport })));
const SAChargeReport = lazy(() => import('./super-distributor/pages/Reports').then(m => ({ default: m.ChargeReport })));
const SACommissionReport = lazy(() => import('./super-distributor/pages/Reports').then(m => ({ default: m.CommissionReport })));
const SAAepsReport = lazy(() => import('./super-distributor/pages/Reports').then(m => ({ default: m.AepsReport })));
const SADmtReport = lazy(() => import('./super-distributor/pages/Reports').then(m => ({ default: m.DmtReport })));
const SABbpsReport = lazy(() => import('./super-distributor/pages/Reports').then(m => ({ default: m.BbpsReport })));
const SACmsReport = lazy(() => import('./super-distributor/pages/Reports').then(m => ({ default: m.CmsReport })));
const SAUserSaleReport = lazy(() => import('./super-distributor/pages/Reports').then(m => ({ default: m.DailyLedger })));
const ReportsAnalyst = lazy(() => import('./super-distributor/pages/ReportsAnalyst'));

// SUPER_DISTRIBUTOR Accounts
const SAMyLedger = lazy(() => import('./super-distributor/pages/Accounts').then(m => ({ default: m.MyLedger })));
const SARetailerLedger = lazy(() => import('./super-distributor/pages/Accounts').then(m => ({ default: m.RetailerLedger })));
const SAAccountsCommission = lazy(() => import('./super-distributor/pages/Accounts').then(m => ({ default: m.AccountsCommission })));

// SUPER_DISTRIBUTOR Promotions
const SAPromotionsList = lazy(() => import('./super-distributor/pages/Promotions').then(m => ({ default: m.PromotionsList })));
const SAPromotionAssets = lazy(() => import('./super-distributor/pages/Promotions').then(m => ({ default: m.PromotionAssets })));

// SUPER_DISTRIBUTOR Support
const SASupportLeads = lazy(() => import('./super-distributor/pages/Support').then(m => ({ default: m.SupportLeads })));
const SAEcollectComplaints = lazy(() => import('./super-distributor/pages/Support').then(m => ({ default: m.EcollectComplaints })));
const SARetailerComplaints = lazy(() => import('./super-distributor/pages/Support').then(m => ({ default: m.RetailerComplaints })));
const SATrainingVideos = lazy(() => import('./super-distributor/pages/Support').then(m => ({ default: m.TrainingVideos })));
const SuperDistributorOldReports_SA = lazy(() => import('./super-distributor/pages/OldReports'));

import ProtectedRoute from './components/ProtectedRoute';
import LockScreen from './components/LockScreen';
import { useAuth } from './context/AuthContext';

// Smart catch-all: route authenticated users to their role's home instead of
// dumping everyone on /login (which used to cause confusion — e.g. refreshing
// a deep link or mistyping a URL would silently send admins to the portal
// selector).
function SmartFallback() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f7f9fc]">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  const roles = (Array.isArray(user?.roles) && user.roles.length ? user.roles : [user?.role])
    .map((r) => String(typeof r === 'string' ? r : r?.name || ''))
    .map((r) => r.trim().replace(/^ROLE_/i, '').replace(/[\s-]+/g, '_').toUpperCase())
    .filter(Boolean);
  if (roles.some((r) => ['ADMIN', 'NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER', 'EMPLOYEE'].includes(r))) {
    return <Navigate to="/admin" replace />;
  }
  if (roles.includes('SUPER_DISTRIBUTOR')) return <Navigate to="/super-distributor" replace />;
  if (roles.includes('DISTRIBUTOR')) return <Navigate to="/distributor" replace />;
  if (roles.includes('RETAILER')) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
      <LanguageProvider>
        <Router>
          <LockScreen />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Landing (Now Public) */}
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/leadership" element={<Leadership />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/services/:slug" element={<ServiceDetail />} />
              <Route path="/portal" element={<Login />} />
              <Route path="/portal/retailer" element={<Login />} />
              <Route path="/portal/distributor" element={<Login />} />
              <Route path="/portal/super-distributor" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/adin" element={<Navigate to="/admin" replace />} />
              <Route path="/kyc-verification" element={<ProtectedRoute><KYCVerification /></ProtectedRoute>} />
              <Route path="/aeps-kyc" element={<ProtectedRoute><AepsOnboarding /></ProtectedRoute>} />
              <Route path="/aeps-onboarding" element={<ProtectedRoute><AepsOnboarding /></ProtectedRoute>} />
              <Route path="/complete-kyc" element={<ProtectedRoute allowKycPending><CompleteKyc /></ProtectedRoute>} />

              {/* Protected Retailer Routes */}
              <Route element={<ProtectedRoute role="RETAILER"><RetailerLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/travel" element={<Travel />} />
                <Route path="/travel-hub" element={<Navigate to="/travel" replace />} />
                <Route path="/retailer/travel" element={<Navigate to="/travel" replace />} />
                <Route path="/utility" element={<Utility />} />
                <Route path="/bharat-connect" element={<BharatConnect />} />
                <Route path="/payout-hub" element={<PayoutHub />} />
                <Route path="/aeps" element={<AEPS />} />
                <Route path="/cms" element={<CMS />} />
                <Route path="/all-services" element={<AllServices />} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/matm" element={<MATM />} />
                <Route path="/add-money" element={<AddMoneyComponent />} />
                <Route path="/loans" element={<Loans />} />
                <Route path="/personal_loan" element={<Loans />} />
                <Route path="/home_loan" element={<Loans />} />
                <Route path="/gold_loan" element={<Loans />} />
                <Route path="/instant_loan" element={<Loans />} />
                <Route path="/loan_status" element={<Loans />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/reports/sale-report" element={<SaleReport />} />
                <Route path="/reports/consolidated-ledger" element={<ConsolidatedLedger />} />
                <Route path="/reports/daily-ledger" element={<DailyLedger />} />
                <Route path="/reports/gst-invoice" element={<GSTInvoiceReport />} />
                <Route path="/reports/audit-report" element={<AuditReport />} />
                <Route path="/gst-invoice-report" element={<GSTInvoiceReport />} />
              </Route>

              {/* Protected Admin Routes */}
              <Route path="/admin/dashboard" element={<ProtectedRoute role="ADMIN_OR_EMPLOYEE"><Admin /></ProtectedRoute>} />
              <Route path="/admin/retailer/:username" element={<ProtectedRoute role="ADMIN_OR_EMPLOYEE"><RetailerDetails /></ProtectedRoute>} />
              <Route path="/admin/distributor/:id" element={<ProtectedRoute role="ADMIN_OR_EMPLOYEE"><DistributorDetails /></ProtectedRoute>} />
              {/* Any other /admin/* sub-path falls back to the main admin dashboard so
                  refreshes on deep links stay within the admin area instead of being
                  captured by the global 404 catch-all below. */}
              <Route path="/admin/*" element={<ProtectedRoute role="ADMIN_OR_EMPLOYEE"><Admin /></ProtectedRoute>} />

              {/* Protected Distributor Routes */}
              <Route path="/distributor-plans" element={<ProtectedRoute role="DISTRIBUTOR"><DistributorPlans /></ProtectedRoute>} />
              <Route path="/distributor" element={<ProtectedRoute role="DISTRIBUTOR"><DistributorLayout /></ProtectedRoute>}>
                <Route index element={<DistributorDashboard />} />
                <Route path="all-services" element={<AllServices readOnly />} />
                <Route path="distributors" element={<SuperDistributorDistributors />} />
                <Route path="retailers" element={<Retailers />} />
                <Route path="retailers/details" element={<Retailers />} />
                <Route path="retailers/share" element={<DistributorPlaceholder title="Share" />} />
                <Route path="retailers/workflow" element={<DistributorPlaceholder title="Workflow" />} />
                <Route path="transactions" element={<DistributorReceipt />} />
                <Route path="transactions/distributor-receipt" element={<DistributorReceipt />} />
                <Route path="transactions/retailer-receipt" element={<RetailerReceipt />} />
                <Route path="transactions/add-money" element={<AddMoney />} />
                <Route path="transactions/axis-cdm" element={<DistributorPlaceholder title="Axis CDM" />} />
                <Route path="transactions/axis-mapping" element={<DistributorPlaceholder title="Axis Mapping" />} />
                <Route path="reports" element={<CommissionReport />} />
                <Route path="reports/retailer-balance" element={<RetailerBalance />} />
                <Route path="reports/payment-request" element={<PaymentRequest />} />
                <Route path="reports/purchase" element={<PurchaseReport />} />
                <Route path="reports/charges" element={<ChargeReport />} />
                <Route path="reports/commission" element={<CommissionReport />} />
                <Route path="reports/aeps" element={<AepsReport />} />
                <Route path="reports/dmt" element={<DmtReport />} />
                <Route path="reports/bbps" element={<BbpsReport />} />
                <Route path="reports/cms" element={<CmsReport />} />
                <Route path="plans" element={<PlansRates />} />
                <Route path="invoice" element={<Invoice />} />
                <Route path="accounts" element={<MyLedger />} />
                <Route path="accounts/my-ledger" element={<MyLedger />} />
                <Route path="accounts/retailer-ledger" element={<RetailerLedger />} />
                <Route path="accounts/commission" element={<AccountsCommission />} />
                <Route path="promotions" element={<PromotionsList />} />
                <Route path="promotions/list" element={<PromotionsList />} />
                <Route path="promotions/assets" element={<PromotionAssets />} />
                <Route path="support" element={<TrainingVideos />} />
                <Route path="support/leads" element={<SupportLeads />} />
                <Route path="support/complaints-ecollect" element={<EcollectComplaints />} />
                <Route path="support/retailer-complaints" element={<RetailerComplaints />} />
                <Route path="support/videos" element={<TrainingVideos />} />
                <Route path="old-reports" element={<OldReports />} />
                <Route path="*" element={<DistributorPlaceholder title="Not Found" />} />
              </Route>

              {/* Protected SUPER_DISTRIBUTOR Routes */}
              <Route path="/super-distributor-plans" element={<ProtectedRoute role="SUPER_DISTRIBUTOR"><SuperDistributorPlans /></ProtectedRoute>} />
              <Route path="/super-distributor" element={<ProtectedRoute role="SUPER_DISTRIBUTOR"><SuperDistributorLayout /></ProtectedRoute>}>
                <Route index element={<SuperDistributorDashboard />} />
                <Route path="all-services" element={<AllServices readOnly />} />
                <Route path="members" element={<SuperDistributorMembers />} />
                <Route path="distributors" element={<SuperDistributorDistributors />} />
                <Route path="super-distributors" element={<SuperDistributorsPage />} />
                <Route path="retailers" element={<SuperDistributorRetailers />} />
                <Route path="retailers/details" element={<SuperDistributorRetailers />} />
                <Route path="retailers/share" element={<SuperDistributorPlaceholder title="Share" />} />
                <Route path="retailers/workflow" element={<SuperDistributorPlaceholder title="Workflow" />} />
                <Route path="approvals" element={<SuperDistributorApprovals />} />
                <Route path="loans" element={<SuperDistributorLoans />} />
                <Route path="wallet" element={<SuperDistributorWalletControl />} />
                <Route path="wallet/credit" element={<SuperDistributorWalletControl initialTab="credit" />} />
                <Route path="wallet/debit" element={<SuperDistributorWalletControl initialTab="debit" />} />
                <Route path="wallet/requests" element={<SuperDistributorWalletControl initialTab="requests" />} />
                <Route path="wallet/lock" element={<SuperDistributorWalletControl initialTab="lock" />} />
                <Route path="wallet/release" element={<SuperDistributorWalletControl initialTab="release-lock" />} />
                <Route path="transactions" element={<SuperDistributorReceipt />} />
                <Route path="transactions/super-distributor-receipt" element={<SuperDistributorReceipt />} />
                <Route path="transactions/retailer-receipt" element={<SuperDistributorRetailerReceipt />} />
                <Route path="transactions/add-money" element={<SuperDistributorAddMoney />} />
                <Route path="transactions/axis-cdm" element={<SuperDistributorPlaceholder title="Axis CDM" />} />
                <Route path="transactions/axis-mapping" element={<SuperDistributorPlaceholder title="Axis Mapping" />} />
                <Route path="reports" element={<SACommissionReport />} />
                <Route path="reports/retailer-balance" element={<SARetailerBalance />} />
                <Route path="reports/payment-request" element={<SAPaymentRequest />} />
                <Route path="reports/purchase" element={<SAPurchaseReport />} />
                <Route path="reports/charges" element={<SAChargeReport />} />
                <Route path="reports/commission" element={<SACommissionReport />} />
                <Route path="reports/aeps" element={<SAAepsReport />} />
                <Route path="reports/dmt" element={<SADmtReport />} />
                <Route path="reports/bbps" element={<SABbpsReport />} />
                <Route path="reports/cms" element={<SACmsReport />} />
                <Route path="reports/user-sales" element={<SAUserSaleReport />} />
                <Route path="reports/analyst" element={<ReportsAnalyst />} />
                <Route path="plans" element={<SuperDistributorPlansRates />} />
                <Route path="invoice" element={<SuperDistributorInvoice />} />
                <Route path="accounts" element={<SAMyLedger />} />
                <Route path="accounts/my-ledger" element={<SAMyLedger />} />
                <Route path="accounts/retailer-ledger" element={<SARetailerLedger />} />
                <Route path="accounts/commission" element={<SAAccountsCommission />} />
                <Route path="promotions" element={<SAPromotionsList />} />
                <Route path="promotions/list" element={<SAPromotionsList />} />
                <Route path="promotions/assets" element={<SAPromotionAssets />} />
                <Route path="support" element={<SATrainingVideos />} />
                <Route path="support/leads" element={<SASupportLeads />} />
                <Route path="support/complaints-ecollect" element={<SAEcollectComplaints />} />
                <Route path="support/retailer-complaints" element={<SARetailerComplaints />} />
                <Route path="support/videos" element={<SATrainingVideos />} />
                <Route path="old-reports" element={<SuperDistributorOldReports />} />
                <Route path="settings" element={<SuperDistributorSettings />} />
                <Route path="*" element={<SuperDistributorPlaceholder title="Not Found" />} />
              </Route>
              {/* Global Catch-all: smart-route to the user's home when logged in,
                  otherwise send them to the portal selector (not About/Home). */}
              <Route path="*" element={<SmartFallback />} />
            </Routes>
          </Suspense>
        </Router>
      </LanguageProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

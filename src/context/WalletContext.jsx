import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { walletService, userService } from '../services/apiService';

const WalletContext = createContext({
  wallet: null,
  balance: "0.00",
  lockedBalance: "0.00",
  availableBalance: "0.00",
  status: "ACTIVE",
  isWalletLoading: true,
  walletError: null,
  refreshWallet: async () => {}
});

/**
 * Read the best available local balance for a user object.
 * Checks rupiksha_wallet_* keys by every user identifier,
 * then session keys, then rupiksha_data.users[].
 */
function readLocalBalance(user) {
  if (!user) return null;
  try {
    const ids = [user.id, user._id, user.userId, user.username, user.mobile, user.phone]
      .filter(Boolean).map(String);

    // 1. Per-user wallet cache (written by adjustUserWalletBalance in admin tab)
    for (const id of ids) {
      const cached = localStorage.getItem(`rupiksha_wallet_${id}`);
      if (cached !== null && parseFloat(cached) > 0) return parseFloat(cached);
    }

    // 2. Session keys
    for (const key of ['rupiksha_user', 'rupiksha_imp_user']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const u = JSON.parse(raw);
        const match = ids.some(id =>
          String(u.id || '') === id || String(u.username || '') === id || String(u.mobile || '') === id
        );
        if (match) {
          const bal = parseFloat(String(u.balance || u.walletBalance || 0));
          if (bal > 0) return bal;
        }
      } catch (_) {}
    }

    // 3. rupiksha_data.users[]
    const rawData = localStorage.getItem('rupiksha_data');
    if (rawData) {
      const appData = JSON.parse(rawData);
      const found = (appData.users || []).find(u =>
        ids.some(id =>
          String(u.id || '') === id || String(u._id || '') === id ||
          String(u.username || '') === id || String(u.mobile || '') === id ||
          String(u.userId || '') === id
        )
      );
      if (found) {
        const bal = parseFloat(String(found.balance || found.walletBalance || 0));
        return bal; // return even if 0 (data was found)
      }
    }
  } catch (e) {
    console.warn('[WalletContext] readLocalBalance error:', e);
  }
  return null;
}

export function WalletProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState("0.00");
  const [lockedBalance, setLockedBalance] = useState("0.00");
  const [availableBalance, setAvailableBalance] = useState("0.00");
  const [status, setStatus] = useState("ACTIVE");
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState(null);

  // Ref so event handlers always see the current user without stale closures
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const applyBalance = useCallback((bal, locked, available, s) => {
    setBalance(parseFloat(bal || 0).toFixed(2));
    setLockedBalance(parseFloat(locked || 0).toFixed(2));
    setAvailableBalance(parseFloat(available ?? bal ?? 0).toFixed(2));
    setStatus(s || "ACTIVE");
  }, []);

  const fetchWallet = useCallback(async (userId) => {
    if (!userId) return;
    setIsWalletLoading(true);
    setWalletError(null);

    // 1. Try to fetch the live user profile from the backend to get their database balance
    try {
      const profile = await userService.getProfile();
      if (profile && (profile.balance !== undefined || profile.walletBalance !== undefined || profile.availableBalance !== undefined)) {
        const liveBal = parseFloat(String(profile.balance ?? profile.walletBalance ?? profile.availableBalance ?? 0).replace(/,/g, '')) || 0;
        
        applyBalance(
          liveBal,
          profile.lockedBalance ?? profile.lockedAmount ?? 0,
          profile.availableBalance ?? liveBal,
          profile.status ?? "ACTIVE"
        );

        // Synchronize local session storage cache so Header / other parts see the live balance
        try {
          localStorage.setItem(`rupiksha_wallet_${userId}`, liveBal.toFixed(2));
          if (profile.username) localStorage.setItem(`rupiksha_wallet_${profile.username}`, liveBal.toFixed(2));
          if (profile.mobile) localStorage.setItem(`rupiksha_wallet_${profile.mobile}`, liveBal.toFixed(2));
          
          const sessionRaw = localStorage.getItem('rupiksha_user');
          if (sessionRaw) {
            const sessionUser = JSON.parse(sessionRaw);
            if (sessionUser.id == userId || sessionUser.username === profile.username) {
              const mergedSession = {
                ...sessionUser,
                ...profile,
                balance: liveBal.toFixed(2),
                walletBalance: liveBal.toFixed(2)
              };
              localStorage.setItem('rupiksha_user', JSON.stringify(mergedSession));
            }
          }
        } catch (_) {}

        setIsWalletLoading(false);
        return;
      }
    } catch (err) {
      console.warn('[WalletContext] Live profile fetch failed, trying backend balance endpoint:', err?.message || err);
    }

    // 2. Try backend wallet balance endpoint
    try {
      const data = await walletService.getBalance(userId);
      if (data && (data.balance !== undefined || data.availableBalance !== undefined)) {
        const backendBal = parseFloat(String(data.balance ?? data.availableBalance ?? 0)) || 0;
        if (backendBal > 0) {
          setWallet(data);
          applyBalance(backendBal, data.lockedBalance, data.availableBalance, data.status);
          try { localStorage.setItem(`rupiksha_wallet_${userId}`, backendBal.toFixed(2)); } catch (_) {}
          setIsWalletLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('[WalletContext] Backend wallet fetch failed, using local fallback:', err?.message || err);
    }

    // 3. Local fallback — reads all possible identifier keys
    const localBal = readLocalBalance(userRef.current);
    applyBalance(localBal ?? 0);
    setIsWalletLoading(false);
  }, [applyBalance]);

  const refreshWallet = useCallback(async () => {
    if (userRef.current?.id) await fetchWallet(userRef.current.id);
  }, [fetchWallet]);

  // Initial wallet load after auth
  useEffect(() => {
    if (authLoading) { setIsWalletLoading(true); return; }
    if (user?.id) {
      fetchWallet(user.id);
    } else {
      setWallet(null);
      applyBalance(0);
      setIsWalletLoading(false);
      setWalletError(null);
    }
  }, [user?.id, authLoading, fetchWallet, applyBalance]);

  // ── CROSS-TAB SYNC via native browser storage event ──────────────────
  // The browser fires 'storage' in ALL OTHER TABS when localStorage changes.
  // So when admin writes rupiksha_wallet_* or rupiksha_data from the admin tab,
  // this retailer tab immediately reads the new balance WITHOUT any page refresh.
  useEffect(() => {
    const handleStorage = (e) => {
      const u = userRef.current;
      if (!u) return;
      const trackedKeys = [
        'rupiksha_data', 'rupiksha_user', 'rupiksha_imp_user',
        ...[u.id, u._id, u.username, u.mobile, u.phone]
          .filter(Boolean).map(id => `rupiksha_wallet_${id}`)
      ];
      if (!e.key || !trackedKeys.includes(e.key)) return;
      // Re-read local balance immediately
      const localBal = readLocalBalance(u);
      if (localBal !== null) applyBalance(localBal);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [applyBalance]);

  // ── SAME-TAB SYNC via walletUpdated custom event ──────────────────────
  useEffect(() => {
    const handle = () => {
      const u = userRef.current;
      if (u?.id) fetchWallet(u.id);
    };
    window.addEventListener('walletUpdated', handle);
    return () => window.removeEventListener('walletUpdated', handle);
  }, [fetchWallet]);

  const isUserFrozen = (u) => {
    if (!u) return false;
    const ids = [u.id, u._id, u.userId, u.username, u.mobile, u.phone].filter(Boolean).map(String);
    if (u.isFrozen || u.walletStatus === 'FROZEN' || u.status === 'FROZEN') return true;
    for (const id of ids) {
      if (localStorage.getItem(`rupiksha_frozen_${id}`) === 'true') return true;
    }
    return false;
  };

  const isFrozen = Boolean(
    status === 'FROZEN' ||
    wallet?.status === 'FROZEN' ||
    isUserFrozen(userRef.current)
  );

  const [frozenModalOpen, setFrozenModalOpen] = useState(false);
  const [frozenModalMessage, setFrozenModalMessage] = useState('Your wallet is frozen. Please contact admin.');

  const triggerFrozenModal = useCallback((msg) => {
    if (msg) setFrozenModalMessage(msg);
    setFrozenModalOpen(true);
  }, []);

  // Listen to global walletFrozenAlert events
  useEffect(() => {
    const handleAlert = (e) => {
      const msg = e?.detail?.message || 'Your wallet is frozen. Please contact admin.';
      setFrozenModalMessage(msg);
      setFrozenModalOpen(true);
    };
    window.addEventListener('walletFrozenAlert', handleAlert);
    return () => window.removeEventListener('walletFrozenAlert', handleAlert);
  }, []);

  return (
    <WalletContext.Provider value={{
      wallet, balance, lockedBalance, availableBalance,
      status, isFrozen, isWalletLoading, walletError, refreshWallet,
      triggerFrozenModal
    }}>
      {children}

      {/* Global Frozen Wallet Modal Alert */}
      {frozenModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-rose-100 max-w-md w-full overflow-hidden text-center p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border-2 border-rose-200 flex items-center justify-center mx-auto text-rose-600 shadow-inner">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                Security & Compliance Notice
              </span>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight pt-2">
                Wallet Frozen
              </h3>
              <p className="text-sm font-bold text-rose-600">
                {frozenModalMessage}
              </p>
            </div>

            <p className="text-xs text-slate-500 font-medium leading-relaxed px-2">
              All balance transactions, float usage, and wallet-to-wallet transfers are disabled on this account while placed on hold. Please reach out to Rupiksha Support or Administrator.
            </p>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFrozenModalOpen(false)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-slate-900/20 transition-all cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);

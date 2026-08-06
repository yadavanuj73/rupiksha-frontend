import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { walletService } from '../services/apiService';

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

    // 1. Try backend
    try {
      const data = await walletService.getBalance(userId);
      if (data && (data.balance !== undefined || data.availableBalance !== undefined)) {
        const backendBal = parseFloat(String(data.balance ?? data.availableBalance ?? 0)) || 0;
        if (backendBal > 0) {
          setWallet(data);
          applyBalance(backendBal, data.lockedBalance, data.availableBalance, data.status);
          // Persist to local cache so cross-tab fallback has fresh data
          try { localStorage.setItem(`rupiksha_wallet_${userId}`, backendBal.toFixed(2)); } catch (_) {}
          setIsWalletLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('[WalletContext] Backend wallet fetch failed, using local fallback:', err?.message || err);
    }

    // 2. Local fallback — reads all possible identifier keys
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

  return (
    <WalletContext.Provider value={{
      wallet, balance, lockedBalance, availableBalance,
      status, isWalletLoading, walletError, refreshWallet
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);

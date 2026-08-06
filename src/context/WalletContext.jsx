import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

export function WalletProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState("0.00");
  const [lockedBalance, setLockedBalance] = useState("0.00");
  const [availableBalance, setAvailableBalance] = useState("0.00");
  const [status, setStatus] = useState("ACTIVE");
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState(null);

  const fetchWallet = useCallback(async (userId) => {
    if (!userId) return;
    setIsWalletLoading(true);
    setWalletError(null);
    try {
      const data = await walletService.getBalance(userId);
      if (data && (data.balance !== undefined || data.availableBalance !== undefined)) {
        const backendBal = parseFloat(String(data.balance ?? data.availableBalance ?? 0)) || 0;
        if (backendBal > 0) {
          // Backend has real data — use it and persist to local cache
          setWallet(data);
          setBalance(String(backendBal.toFixed(2)));
          setLockedBalance(String(data.lockedBalance ?? "0.00"));
          setAvailableBalance(String(data.availableBalance ?? backendBal.toFixed(2)));
          setStatus(data.status ?? "ACTIVE");
          localStorage.setItem(`rupiksha_wallet_${userId}`, String(backendBal.toFixed(2)));
          setIsWalletLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("[WalletContext] Backend wallet fetch failed, using local fallback:", err?.message || err);
    }

    // ── Local fallback: backend failed or returned 0 ─────────────────────
    // Priority: per-user cache → session rupiksha_user → rupiksha_data user list
    try {
      const cached = localStorage.getItem(`rupiksha_wallet_${userId}`);
      if (cached && parseFloat(cached) > 0) {
        const bal = parseFloat(cached).toFixed(2);
        setBalance(bal);
        setAvailableBalance(bal);
        setLockedBalance("0.00");
        setStatus("ACTIVE");
        setIsWalletLoading(false);
        return;
      }

      // Check rupiksha_user session
      const sessionRaw = localStorage.getItem('rupiksha_user');
      if (sessionRaw) {
        const sessionUser = JSON.parse(sessionRaw);
        if (sessionUser.id == userId || sessionUser.username == userId || sessionUser.mobile == userId) {
          const bal = parseFloat(String(sessionUser.balance || sessionUser.walletBalance || 0)) || 0;
          if (bal > 0) {
            setBalance(bal.toFixed(2));
            setAvailableBalance(bal.toFixed(2));
            setLockedBalance("0.00");
            setStatus("ACTIVE");
            setIsWalletLoading(false);
            return;
          }
        }
      }

      // Check rupiksha_data user list (written by adjustUserWalletBalance)
      const rawData = localStorage.getItem('rupiksha_data');
      if (rawData) {
        const appData = JSON.parse(rawData);
        const found = (appData.users || []).find(u =>
          u.id == userId || u._id == userId || u.username == userId || u.mobile == userId || u.userId == userId
        );
        if (found) {
          const bal = parseFloat(String(found.balance || found.walletBalance || 0)) || 0;
          setBalance(bal.toFixed(2));
          setAvailableBalance(bal.toFixed(2));
          setLockedBalance("0.00");
          setStatus("ACTIVE");
          setIsWalletLoading(false);
          return;
        }
      }
    } catch (localErr) {
      console.warn("[WalletContext] Local fallback read error:", localErr);
    }

    // Ultimate fallback: 0
    setBalance("0.00");
    setLockedBalance("0.00");
    setAvailableBalance("0.00");
    setStatus("ACTIVE");
    setWalletError(null);
    setIsWalletLoading(false);
  }, []);

  const refreshWallet = useCallback(async () => {
    if (user?.id) {
      await fetchWallet(user.id);
    }
  }, [user?.id, fetchWallet]);

  // Load wallet immediately after auth restoration completes
  useEffect(() => {
    if (authLoading) {
      setIsWalletLoading(true);
      return;
    }
    if (user?.id) {
      fetchWallet(user.id);
    } else {
      // Clear wallet state on logout or no session
      setWallet(null);
      setBalance("0.00");
      setLockedBalance("0.00");
      setAvailableBalance("0.00");
      setStatus("ACTIVE");
      setIsWalletLoading(false);
      setWalletError(null);
    }
  }, [user?.id, authLoading, fetchWallet]);

  // Auto-refresh wallet balance whenever admin performs a wallet operation
  // (WalletManager dispatches 'walletUpdated' after every credit/debit/commission)
  useEffect(() => {
    const handleWalletUpdated = () => {
      if (user?.id) fetchWallet(user.id);
    };
    window.addEventListener('walletUpdated', handleWalletUpdated);
    return () => window.removeEventListener('walletUpdated', handleWalletUpdated);
  }, [user?.id, fetchWallet]);

  return (
    <WalletContext.Provider value={{
      wallet,
      balance,
      lockedBalance,
      availableBalance,
      status,
      isWalletLoading,
      walletError,
      refreshWallet
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);

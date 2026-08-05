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
        setWallet(data);
        setBalance(String(data.balance ?? data.availableBalance ?? "0.00"));
        setLockedBalance(String(data.lockedBalance ?? "0.00"));
        setAvailableBalance(String(data.availableBalance ?? "0.00"));
        setStatus(data.status ?? "ACTIVE");
      } else {
        setBalance("0.00");
        setLockedBalance("0.00");
        setAvailableBalance("0.00");
        setStatus("ACTIVE");
      }
    } catch (err) {
      console.warn("[WalletContext] Wallet fetch warning, using fallback balance 0.00:", err);
      setBalance("0.00");
      setLockedBalance("0.00");
      setAvailableBalance("0.00");
      setStatus("ACTIVE");
      setWalletError(null);
    } finally {
      setIsWalletLoading(false);
    }
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

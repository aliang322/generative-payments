import { useState, useCallback } from "react";

interface UseFernOnrampOptions {
  planId: string;
  senderEmail: string;
  amountUsd: string;
  agentChain: string;
  agentWalletAddress: string;
}

interface UseFernOfframpOptions {
  planId: string;
  receiverEmail: string;
  amountUsd: string;
  agentChain: string;
  agentWalletAddress: string;
  chosenChain: string;
  autoCashOut: boolean;
  receiverExternalWalletAddress?: string;
}

interface UseFernTransactionStatusOptions {
  transactionId: string;
}

export function useFernOnramp() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const startOnramp = useCallback(async (options: UseFernOnrampOptions) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/fern/onramp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(options),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to start onramp");
      }

      const data = await res.json();
      setResult(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    startOnramp,
    loading,
    result,
    error,
    reset: () => {
      setResult(null);
      setError(null);
    },
  };
}

export function useFernOfframp() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const startOfframp = useCallback(async (options: UseFernOfframpOptions) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body: any = { ...options };

      if (!options.autoCashOut && !options.receiverExternalWalletAddress) {
        throw new Error("Receiver external wallet address is required when auto cash-out is disabled");
      }

      const res = await fetch("/api/fern/offramp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to start offramp");
      }

      const data = await res.json();
      setResult(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    startOfframp,
    loading,
    result,
    error,
    reset: () => {
      setResult(null);
      setError(null);
    },
  };
}

export function useFernTransactionStatus() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async (transactionId: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/fern/transaction/${transactionId}`);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch transaction status");
      }

      const data = await res.json();
      setStatus(data.transactionStatus);
      return data.transactionStatus;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    checkStatus,
    loading,
    status,
    error,
    reset: () => {
      setStatus(null);
      setError(null);
    },
  };
}

// Combined hook for all Fern operations
export function useFern() {
  const onramp = useFernOnramp();
  const offramp = useFernOfframp();
  const transactionStatus = useFernTransactionStatus();

  return {
    onramp,
    offramp,
    transactionStatus,
  };
}

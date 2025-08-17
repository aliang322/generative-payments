"use client";

import { useState, useEffect } from "react";

interface TransactionStatusProps {
  transactionId: string;
  onStatusChange?: (status: string) => void;
}

export default function TransactionStatus({ 
  transactionId, 
  onStatusChange 
}: TransactionStatusProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const fetchStatus = async () => {
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
      onStatusChange?.(data.transactionStatus);
      
      // Stop polling if transaction is completed or failed
      if (data.transactionStatus === "COMPLETED" || data.transactionStatus === "FAILED") {
        setPolling(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    setPolling(true);
    fetchStatus();
  };

  const stopPolling = () => {
    setPolling(false);
  };

  useEffect(() => {
    if (polling) {
      const interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [polling, transactionId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "text-green-600";
      case "FAILED":
        return "text-red-600";
      case "PENDING":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Transaction Status</h2>
      
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Transaction ID</label>
          <input
            type="text"
            value={transactionId}
            readOnly
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <div className="mt-1 p-2 border border-gray-300 rounded-md bg-gray-50">
            {loading ? (
              <span className="text-gray-500">Loading...</span>
            ) : status ? (
              <span className={`font-medium ${getStatusColor(status)}`}>
                {status}
              </span>
            ) : (
              <span className="text-gray-500">Not checked</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? "Checking..." : "Check Status"}
        </button>
        
        {!polling ? (
          <button
            onClick={startPolling}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
          >
            Start Polling
          </button>
        ) : (
          <button
            onClick={stopPolling}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700"
          >
            Stop Polling
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {polling && (
        <div className="mt-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded">
          <p className="text-sm">Polling status every 5 seconds...</p>
        </div>
      )}
    </div>
  );
}

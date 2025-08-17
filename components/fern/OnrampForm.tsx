"use client";

import { useState } from "react";

interface OnrampFormProps {
  planId: string;
  agentChain: string;
  agentWalletAddress: string;
  amountUsd: string;
  senderEmail: string;
}

export default function OnrampForm({
  planId,
  agentChain,
  agentWalletAddress,
  amountUsd,
  senderEmail,
}: OnrampFormProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOnramp = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/fern/onramp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          senderEmail,
          amountUsd,
          agentChain,
          agentWalletAddress,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to start onramp");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Start Onramp</h2>
      
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Plan ID</label>
          <input
            type="text"
            value={planId}
            readOnly
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Sender Email</label>
          <input
            type="email"
            value={senderEmail}
            readOnly
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Amount (USD)</label>
          <input
            type="text"
            value={amountUsd}
            readOnly
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Agent Chain</label>
          <input
            type="text"
            value={agentChain}
            readOnly
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Agent Wallet Address</label>
          <input
            type="text"
            value={agentWalletAddress}
            readOnly
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
          />
        </div>
      </div>

      <button
        onClick={handleOnramp}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? "Starting Onramp..." : "Start Onramp"}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded">
          <h3 className="font-semibold text-green-800 mb-2">Onramp Started Successfully!</h3>
          <div className="text-sm text-green-700 space-y-2">
            <p><strong>Transaction ID:</strong> {result.transaction.transactionId}</p>
            <p><strong>Status:</strong> {result.transaction.transactionStatus}</p>
            {result.funding.transferInstructions && (
              <div>
                <p><strong>Bank Instructions:</strong></p>
                <pre className="text-xs bg-white p-2 rounded border overflow-auto">
                  {JSON.stringify(result.funding.transferInstructions, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

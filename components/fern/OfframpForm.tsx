"use client";

import { useState } from "react";

interface OfframpFormProps {
  planId: string;
  agentChain: string;
  agentWalletAddress: string;
  amountUsd: string;
  receiverEmail: string;
}

export default function OfframpForm({
  planId,
  agentChain,
  agentWalletAddress,
  amountUsd,
  receiverEmail,
}: OfframpFormProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoCashOut, setAutoCashOut] = useState(true);
  const [chosenChain, setChosenChain] = useState("BASE");
  const [receiverExternalWalletAddress, setReceiverExternalWalletAddress] = useState("");

  const handleOfframp = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body: any = {
        planId,
        receiverEmail,
        amountUsd,
        agentChain,
        agentWalletAddress,
        chosenChain,
        autoCashOut,
      };

      if (!autoCashOut) {
        if (!receiverExternalWalletAddress) {
          throw new Error("Receiver external wallet address is required when auto cash-out is disabled");
        }
        body.receiverExternalWalletAddress = receiverExternalWalletAddress;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Start Offramp</h2>
      
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
          <label className="block text-sm font-medium text-gray-700">Receiver Email</label>
          <input
            type="email"
            value={receiverEmail}
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
          <label className="block text-sm font-medium text-gray-700">Chosen Chain</label>
          <select
            value={chosenChain}
            onChange={(e) => setChosenChain(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="BASE">BASE</option>
            <option value="ETHEREUM">ETHEREUM</option>
            <option value="ARBITRUM">ARBITRUM</option>
            <option value="POLYGON">POLYGON</option>
            <option value="AVALANCHE">AVALANCHE</option>
            <option value="OPTIMISM">OPTIMISM</option>
          </select>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="autoCashOut"
            checked={autoCashOut}
            onChange={(e) => setAutoCashOut(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="autoCashOut" className="ml-2 block text-sm text-gray-900">
            Auto Cash-Out (Agent sends USDC to Fern)
          </label>
        </div>
        
        {!autoCashOut && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Receiver External Wallet Address
            </label>
            <input
              type="text"
              value={receiverExternalWalletAddress}
              onChange={(e) => setReceiverExternalWalletAddress(e.target.value)}
              placeholder="0x..."
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
      </div>

      <button
        onClick={handleOfframp}
        disabled={loading}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? "Starting Offramp..." : "Start Offramp"}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded">
          <h3 className="font-semibold text-green-800 mb-2">Offramp Started Successfully!</h3>
          <div className="text-sm text-green-700 space-y-2">
            <p><strong>Transaction ID:</strong> {result.transaction.transactionId}</p>
            <p><strong>Status:</strong> {result.transaction.transactionStatus}</p>
            {result.funding.cryptoDepositInstructions && (
              <div>
                <p><strong>Crypto Deposit Instructions:</strong></p>
                <pre className="text-xs bg-white p-2 rounded border overflow-auto">
                  {JSON.stringify(result.funding.cryptoDepositInstructions, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

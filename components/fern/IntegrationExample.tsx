"use client";

import { useState } from "react";
import { useFern } from "@/lib/hooks/useFern";

interface ParsedPlan {
  title: string;
  frequency: number;
  amountPerTransaction: number;
  totalAmount: number;
  numberOfTransactions: number;
  startTimeOffset: number;
  endTimeOffset: number;
}

export default function IntegrationExample() {
  const [description, setDescription] = useState("");
  const [parsedPlan, setParsedPlan] = useState<ParsedPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { onramp, offramp } = useFern();

  const parsePlan = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/parse-payment-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to parse plan");
      }

      const data = await response.json();
      setParsedPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleOnramp = async () => {
    if (!parsedPlan) return;

    try {
      const result = await onramp.startOnramp({
        planId: `plan_${Date.now()}`,
        senderEmail: "sender@example.com", // From Dynamic session
        amountUsd: parsedPlan.totalAmount.toString(),
        agentChain: "BASE", // From plan or user preference
        agentWalletAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6", // From Dynamic server wallet
      });

      console.log("On-ramp started:", result);
      alert(`On-ramp started! Transaction ID: ${result.transaction.transactionId}`);
    } catch (error) {
      console.error("On-ramp failed:", error);
      alert("On-ramp failed. Check console for details.");
    }
  };

  const handleOfframp = async () => {
    if (!parsedPlan) return;

    try {
      const result = await offramp.startOfframp({
        planId: `plan_${Date.now()}`,
        receiverEmail: "receiver@example.com", // From plan
        amountUsd: parsedPlan.totalAmount.toString(),
        agentChain: "BASE", // From plan
        agentWalletAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6", // From plan
        chosenChain: "BASE", // From receiver preference
        autoCashOut: true, // From plan or user choice
      });

      console.log("Off-ramp started:", result);
      alert(`Off-ramp started! Transaction ID: ${result.transaction.transactionId}`);
    } catch (error) {
      console.error("Off-ramp failed:", error);
      alert("Off-ramp failed. Check console for details.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Fern + Payment Plan Integration Example</h2>
      
      {/* Plan Description Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Payment Plan Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., 'Pay $50 weekly for 4 weeks to John for rent'"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          rows={3}
        />
        <button
          onClick={parsePlan}
          disabled={loading || !description}
          className="mt-2 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? "Parsing..." : "Parse Plan"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Parsed Plan Display */}
      {parsedPlan && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Parsed Plan</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Title:</strong> {parsedPlan.title}</div>
            <div><strong>Total Amount:</strong> ${parsedPlan.totalAmount}</div>
            <div><strong>Amount Per Transaction:</strong> ${parsedPlan.amountPerTransaction}</div>
            <div><strong>Number of Transactions:</strong> {parsedPlan.numberOfTransactions}</div>
            <div><strong>Frequency:</strong> {parsedPlan.frequency} seconds</div>
            <div><strong>Start Offset:</strong> {parsedPlan.startTimeOffset} seconds</div>
          </div>
        </div>
      )}

      {/* Fern Integration Buttons */}
      {parsedPlan && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Fern Integration</h3>
          
          <div className="flex space-x-4">
            <button
              onClick={handleOnramp}
              disabled={onramp.loading}
              className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {onramp.loading ? "Starting On-ramp..." : "Start On-ramp"}
            </button>
            
            <button
              onClick={handleOfframp}
              disabled={offramp.loading}
              className="bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {offramp.loading ? "Starting Off-ramp..." : "Start Off-ramp"}
            </button>
          </div>

          {onramp.error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              On-ramp Error: {onramp.error}
            </div>
          )}

          {offramp.error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              Off-ramp Error: {offramp.error}
            </div>
          )}

          {onramp.result && (
            <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              <strong>On-ramp Success!</strong> Transaction ID: {onramp.result.transaction.transactionId}
            </div>
          )}

          {offramp.result && (
            <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              <strong>Off-ramp Success!</strong> Transaction ID: {offramp.result.transaction.transactionId}
            </div>
          )}
        </div>
      )}

      {/* Integration Flow Explanation */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Integration Flow</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>User describes payment plan in natural language</li>
          <li>Parse payment plan API extracts structured data</li>
          <li>Use parsed data to start Fern on-ramp (sender → agent wallet)</li>
          <li>Agent receives USDC and can bridge to receiver's preferred chain</li>
          <li>Use parsed data to start Fern off-ramp (receiver → bank account)</li>
          <li>Monitor transaction status until completion</li>
        </ol>
      </div>
    </div>
  );
}

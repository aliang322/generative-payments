"use client";

import { useState } from "react";

interface ParsedPlan {
  title: string;
  frequency: number;
  amountPerTransaction: number;
  totalAmount: number;
  numberOfTransactions: number;
  startTimeOffset: number;
  endTimeOffset: number;
}

interface Plan {
  planId: string;
  agentWallet: { chain: string; address: string };
  sender?: { email: string; chosenSourceChain?: string };
  receiver?: { email: string; chosenDestChain: string; autoCashOut?: boolean };
  amountUsd: string;
}

export default function CompleteFlowExample() {
  const [step, setStep] = useState<number>(1);
  const [description, setDescription] = useState("");
  const [parsedPlan, setParsedPlan] = useState<ParsedPlan | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [senderEmail, setSenderEmail] = useState("caliangandrew@gmail.com");
  const [receiverEmail, setReceiverEmail] = useState("receiver@example.com");
  const [agentChain, setAgentChain] = useState("BASE");
  const [agentWalletAddress, setAgentWalletAddress] = useState("0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6");
  const [receiverChosenChain, setReceiverChosenChain] = useState("BASE");
  const [autoCashOut, setAutoCashOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onrampResult, setOnrampResult] = useState<any>(null);
  const [offrampResult, setOfframpResult] = useState<any>(null);

  // Step 1: Parse payment plan
  const parsePlan = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/parse-payment-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to parse plan");
      }

      const data = await response.json();
      setParsedPlan(data);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Create Fern plan
  const createPlan = async () => {
    if (!parsedPlan) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/fern/payment-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_plan",
          planId: `plan_${Date.now()}`,
          parsedPlan,
          senderEmail,
          receiverEmail,
          agentChain,
          agentWalletAddress,
          receiverChosenChain,
          autoCashOut,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create plan");
      }

      const data = await response.json();
      setPlan(data.plan);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Step 3a: Start onramp (Option 1 - Fern onramp)
  const startOnramp = async () => {
    if (!plan) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/fern/payment-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_onramp",
          planId: plan.planId,
          senderEmail,
          amountUsd: plan.amountUsd,
          fiatMethod: "ACH",
          agentChain,
          agentWalletAddress,
          validateChains: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start onramp");
      }

      const data = await response.json();
      setOnrampResult(data.result);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Step 3b: Start offramp (Receiver accepts and receives)
  const startOfframp = async () => {
    if (!plan) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/fern/payment-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_offramp",
          planId: plan.planId,
          receiverEmail,
          amountUsd: plan.amountUsd,
          chosenChain: receiverChosenChain,
          autoCashOut,
          fiatMethod: "ACH",
          validateChains: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start offramp");
      }

      const data = await response.json();
      setOfframpResult(data.result);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Step 1: Describe Payment Plan</h3>
            <div>
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
            </div>
            <button
              onClick={parsePlan}
              disabled={loading || !description}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? "Parsing..." : "Parse Plan"}
            </button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Step 2: Configure Plan</h3>
            
            {parsedPlan && (
              <div className="p-4 bg-gray-50 rounded-lg mb-4">
                <h4 className="font-semibold mb-2">Parsed Plan</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Title:</strong> {parsedPlan.title}</div>
                  <div><strong>Total Amount:</strong> ${parsedPlan.totalAmount}</div>
                  <div><strong>Amount Per Transaction:</strong> ${parsedPlan.amountPerTransaction}</div>
                  <div><strong>Number of Transactions:</strong> {parsedPlan.numberOfTransactions}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Sender Email</label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Receiver Email</label>
                <input
                  type="email"
                  value={receiverEmail}
                  onChange={(e) => setReceiverEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Agent Chain</label>
                <select
                  value={agentChain}
                  onChange={(e) => setAgentChain(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="BASE">BASE</option>
                  <option value="ETHEREUM">ETHEREUM</option>
                  <option value="ARBITRUM">ARBITRUM</option>
                  <option value="POLYGON">POLYGON</option>
                  <option value="AVALANCHE">AVALANCHE</option>
                  <option value="OPTIMISM">OPTIMISM</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Receiver Chosen Chain</label>
                <select
                  value={receiverChosenChain}
                  onChange={(e) => setReceiverChosenChain(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="BASE">BASE</option>
                  <option value="ETHEREUM">ETHEREUM</option>
                  <option value="ARBITRUM">ARBITRUM</option>
                  <option value="POLYGON">POLYGON</option>
                  <option value="AVALANCHE">AVALANCHE</option>
                  <option value="OPTIMISM">OPTIMISM</option>
                </select>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoCashOut"
                checked={autoCashOut}
                onChange={(e) => setAutoCashOut(e.target.checked)}
                className="h-4 w-4 text-blue-600"
              />
              <label htmlFor="autoCashOut" className="ml-2 text-sm">
                Auto Cash-Out (Agent sends USDC to Fern)
              </label>
            </div>

            <button
              onClick={createPlan}
              disabled={loading}
              className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? "Creating..." : "Create Plan"}
            </button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Step 3: Sender Accepts & Funds</h3>
            <p className="text-sm text-gray-600">
              This step represents the sender accepting the plan and funding it via Fern onramp.
            </p>
            
            <button
              onClick={startOnramp}
              disabled={loading}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? "Starting Onramp..." : "Start Fern Onramp (Option 1)"}
            </button>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Step 4: Receiver Accepts & Receives</h3>
            <p className="text-sm text-gray-600">
              This step represents the receiver accepting the plan and setting up offramp.
            </p>

            {onrampResult && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Onramp Started Successfully</h4>
                <p className="text-sm text-green-700">
                  Transaction ID: {onrampResult.transaction.transactionId}
                </p>
                <p className="text-sm text-green-700">
                  Status: {onrampResult.transaction.transactionStatus}
                </p>
              </div>
            )}
            
            <button
              onClick={startOfframp}
              disabled={loading}
              className="bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:bg-gray-400"
            >
              {loading ? "Starting Offramp..." : "Start Fern Offramp"}
            </button>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Step 5: Agent Executes Payment Plan</h3>
            <p className="text-sm text-gray-600">
              This step represents the agent executing the payment plan using CCTP v2 Fast.
            </p>

            {offrampResult && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Offramp Started Successfully</h4>
                <p className="text-sm text-green-700">
                  Transaction ID: {offrampResult.transaction.transactionId}
                </p>
                <p className="text-sm text-green-700">
                  Status: {offrampResult.transaction.transactionStatus}
                </p>
                {offrampResult.funding.cryptoDepositInstructions && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-green-800">Crypto Deposit Instructions:</p>
                    <pre className="text-xs bg-white p-2 rounded border overflow-auto">
                      {JSON.stringify(offrampResult.funding.cryptoDepositInstructions, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Next Steps</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
                <li>Agent wallet receives USDC from Fern onramp</li>
                <li>Cron job uses CCTP v2 Fast to bridge USDC to receiver's chain</li>
                <li>If auto cash-out: Agent sends USDC to Fern deposit address</li>
                <li>If manual cash-out: Receiver sends USDC to Fern deposit address</li>
                <li>Fern converts USDC to USD and sends to receiver's bank account</li>
              </ol>
            </div>

            <button
              onClick={() => setStep(1)}
              className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
            >
              Start Over
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Complete Payment Plan Flow with Fern Integration</h2>
      
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= stepNumber ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {stepNumber}
              </div>
              {stepNumber < 5 && (
                <div className={`w-16 h-1 mx-2 ${
                  step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Parse Plan</span>
          <span>Configure</span>
          <span>Sender Funds</span>
          <span>Receiver Accepts</span>
          <span>Agent Executes</span>
        </div>
      </div>

      {/* Step Content */}
      {renderStep()}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

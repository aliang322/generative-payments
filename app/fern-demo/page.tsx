"use client";

import { useState } from "react";
import OnrampForm from "@/components/fern/OnrampForm";
import OfframpForm from "@/components/fern/OfframpForm";
import TransactionStatus from "@/components/fern/TransactionStatus";
import IntegrationExample from "@/components/fern/IntegrationExample";
import CompleteFlowExample from "@/components/fern/CompleteFlowExample";

export default function FernDemoPage() {
  const [activeTab, setActiveTab] = useState<"onramp" | "offramp" | "status" | "integration" | "complete-flow">("onramp");
  const [demoData, setDemoData] = useState({
    planId: "demo_plan_123",
    agentChain: "BASE",
    agentWalletAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    amountUsd: "150.00",
    senderEmail: "sender@example.com",
    receiverEmail: "receiver@example.com",
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Fern On-ramp & Off-ramp Demo
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            This demo showcases the Fern integration for handling fiat-to-crypto on-ramps 
            and crypto-to-fiat off-ramps in your generative payments application.
          </p>
        </div>

        {/* Demo Configuration */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Demo Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Plan ID</label>
              <input
                type="text"
                value={demoData.planId}
                onChange={(e) => setDemoData({ ...demoData, planId: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Agent Chain</label>
              <select
                value={demoData.agentChain}
                onChange={(e) => setDemoData({ ...demoData, agentChain: e.target.value })}
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
            <div>
              <label className="block text-sm font-medium text-gray-700">Agent Wallet Address</label>
              <input
                type="text"
                value={demoData.agentWalletAddress}
                onChange={(e) => setDemoData({ ...demoData, agentWalletAddress: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount (USD)</label>
              <input
                type="text"
                value={demoData.amountUsd}
                onChange={(e) => setDemoData({ ...demoData, amountUsd: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sender Email</label>
              <input
                type="email"
                value={demoData.senderEmail}
                onChange={(e) => setDemoData({ ...demoData, senderEmail: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Receiver Email</label>
              <input
                type="email"
                value={demoData.receiverEmail}
                onChange={(e) => setDemoData({ ...demoData, receiverEmail: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-1 bg-white rounded-lg shadow-md p-1">
            <button
              onClick={() => setActiveTab("onramp")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "onramp"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              On-ramp
            </button>
            <button
              onClick={() => setActiveTab("offramp")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "offramp"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Off-ramp
            </button>
            <button
              onClick={() => setActiveTab("status")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "status"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Transaction Status
            </button>
            <button
              onClick={() => setActiveTab("integration")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "integration"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Integration Example
            </button>
            <button
              onClick={() => setActiveTab("complete-flow")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "complete-flow"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Complete Flow
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex justify-center">
          {activeTab === "onramp" && (
            <OnrampForm
              planId={demoData.planId}
              agentChain={demoData.agentChain}
              agentWalletAddress={demoData.agentWalletAddress}
              amountUsd={demoData.amountUsd}
              senderEmail={demoData.senderEmail}
            />
          )}
          
          {activeTab === "offramp" && (
            <OfframpForm
              planId={demoData.planId}
              agentChain={demoData.agentChain}
              agentWalletAddress={demoData.agentWalletAddress}
              amountUsd={demoData.amountUsd}
              receiverEmail={demoData.receiverEmail}
            />
          )}
          
          {activeTab === "status" && (
            <div className="w-full max-w-md">
              <TransactionStatus
                transactionId="demo_transaction_id"
                onStatusChange={(status) => console.log("Status changed:", status)}
              />
              <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 rounded">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Replace "demo_transaction_id" with an actual transaction ID 
                  from a successful on-ramp or off-ramp operation to monitor its status.
                </p>
              </div>
            </div>
          )}
          
                     {activeTab === "integration" && (
             <IntegrationExample />
           )}
           
           {activeTab === "complete-flow" && (
             <CompleteFlowExample />
           )}
         </div>

        {/* Documentation */}
        <div className="mt-12 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4">How It Works</h2>
          <div className="space-y-4 text-gray-700">
            <div>
              <h3 className="font-semibold text-lg">On-ramp Flow (Sender → Agent Wallet)</h3>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Sender provides fiat funding (ACH/Wire)</li>
                <li>Fern converts USD to USDC</li>
                <li>USDC is sent to the Agent wallet on the specified chain</li>
                <li>Agent can then use CCTP to bridge USDC to receiver's preferred chain</li>
              </ol>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg">Off-ramp Flow (Receiver → Bank)</h3>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Receiver receives USDC (via CCTP or direct transfer)</li>
                <li>Fern converts USDC back to USD</li>
                <li>USD is sent to receiver's bank account via ACH</li>
              </ol>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg">Auto Cash-Out Options</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Enabled:</strong> Agent automatically sends USDC to Fern's deposit address</li>
                <li><strong>Disabled:</strong> Receiver manually sends USDC from their wallet to Fern</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

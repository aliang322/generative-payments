"use client";

import { useState, useEffect } from "react";
import { useFernOnramp } from "@/lib/hooks/useFern";
import { KYCBypassButton, BankAccountBypassButton } from "./TestingBypassButton";
import { TestingBanner } from "./TestingBanner";

interface FernFundingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFundingComplete?: (planId: string) => void;
  plan: {
    id: string;
    name: string;
    amountPerTransaction: number;
    numberOfTransactions: number;
    totalAmount: number;
    chain: string;
    type: string;
  };
  userEmail: string;
  agentWalletAddress: string;
}

export default function FernFundingModal({
  isOpen,
  onClose,
  onFundingComplete,
  plan,
  userEmail,
  agentWalletAddress,
}: FernFundingModalProps) {
  const [step, setStep] = useState<"loading" | "kyc" | "bankDetails" | "funding" | "success" | "error">("loading");
  const [kycLink, setKycLink] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [bankFormData, setBankFormData] = useState({
    bankName: "",
    accountNumber: "",
    routingNumber: "",
    accountType: "CHECKING" as "CHECKING" | "SAVINGS",
    ownerFirstName: "",
    ownerLastName: "",
  });
  const [isSubmittingBank, setIsSubmittingBank] = useState(false);
  const [transactionData, setTransactionData] = useState<any>(null);
  
  const { startOnramp, loading, result, error: onrampError } = useFernOnramp();

  // Map chain names to Fern chain format
  const getFernChain = (chain: string): string => {
    const chainMap: Record<string, string> = {
      "ethereum": "ETHEREUM",
      "base": "BASE",
      "arbitrum": "ARBITRUM",
      "polygon": "POLYGON",
      "avalanche": "AVALANCHE",
      "optimism": "OPTIMISM",
    };
    return chainMap[chain.toLowerCase()] || "BASE";
  };

  const handleStartOnramp = async () => {
    try {
      setStep("loading");
      setError("");

      const result = await startOnramp({
        planId: plan.id,
        senderEmail: userEmail,
        amountUsd: plan.totalAmount.toString(),
        agentChain: getFernChain(plan.chain),
        agentWalletAddress: agentWalletAddress,
      });

      console.log("Onramp result:", result);

      // Check if we need KYC
      if (result.kyc && result.kyc.kycLink) {
        setKycLink(result.kyc.kycLink);
        setStep("kyc");
        return;
      }

      // Check if we need bank account details
      if (result.funding && result.funding.needsBankDetails) {
        console.log("Bank details needed, showing form");
        setStep("bankDetails");
        return;
      }

      // Check if we can proceed with funding
      if (result.funding && result.funding.canProceed) {
        console.log("Can proceed with funding, skipping bank details");
        setStep("funding");
        return;
      }

      // If we can't proceed, show a message about Builder plan limitations
      setError("This feature requires a Fern plan with payment account creation capabilities. Please contact Fern support to upgrade your plan.");
      setStep("error");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start onramp");
      setStep("error");
    }
  };

  const handleKycComplete = () => {
    setStep("funding");
  };

  const handleFundingComplete = () => {
    if (onFundingComplete) {
      onFundingComplete(plan.id);
    }
  };

  const handleBankAccountSubmit = async () => {
    try {
      setIsSubmittingBank(true);
      setError("");

      // Call the bank account creation API
      const response = await fetch('/api/fern/payment-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_bank_account',
          customerId: result?.kyc?.customerId,
          accountNumber: bankFormData.accountNumber,
          routingNumber: bankFormData.routingNumber,
          bankName: bankFormData.bankName,
          bankAccountType: bankFormData.accountType,
          ownerEmail: userEmail,
          ownerFirstName: bankFormData.ownerFirstName,
          ownerLastName: bankFormData.ownerLastName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create bank account');
      }

      const bankResult = await response.json();
      console.log('Bank account created:', bankResult);

      // Now complete the onramp with the bank account
      const onrampResponse = await fetch('/api/fern/payment-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_onramp',
          planId: plan.id,
          senderEmail: userEmail,
          amountUsd: plan.totalAmount.toString(),
          bankAccountId: bankResult.result.paymentAccountId,
          agentCryptoAccountId: result?.funding?.agentAccountId,
          fiatMethod: 'ACH',
        }),
      });

      if (!onrampResponse.ok) {
        const errorData = await onrampResponse.json();
        throw new Error(errorData.error || 'Failed to complete onramp');
      }

      const onrampResult = await onrampResponse.json();
      console.log('Onramp completed:', onrampResult);

      // Update the result with the new transaction
      if (onrampResult.result?.transaction) {
        // Store the transaction data and proceed to funding step
        setTransactionData(onrampResult.result.transaction);
        setStep("funding");
      } else {
        throw new Error('Failed to create transaction after bank account setup');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit bank account');
    } finally {
      setIsSubmittingBank(false);
    }
  };

  const handleClose = () => {
    setStep("loading");
    setError("");
    setKycLink("");
    setTransactionData(null);
    setBankFormData({
      bankName: "",
      accountNumber: "",
      routingNumber: "",
      accountType: "CHECKING",
      ownerFirstName: "",
      ownerLastName: "",
    });
    onClose();
  };

  // Auto-start onramp when modal opens
  useEffect(() => {
    if (isOpen && step === "loading") {
      handleStartOnramp();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Fund Payment Plan</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-600 mt-2">Plan: {plan.name}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "loading" && (
            <div className="text-center py-8">
              <div className="relative mb-6">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
                <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-cyan-400 rounded-full animate-spin mx-auto" style={{ animationDelay: '-0.5s' }}></div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Setting up funding...</h3>
              <p className="text-gray-600">Preparing your Fern onramp</p>
            </div>
          )}

          {step === "kyc" && kycLink && (
            <div className="text-center py-8">
              <KYCBypassButton onBypass={() => {
                handleKycComplete();
                handleFundingComplete();
              }} />
              
              <div className="mb-6">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Identity Verification Required</h3>
                <p className="text-gray-600 mb-4">
                  To fund your payment plan, you need to complete identity verification with Fern first.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  This is a one-time process required for compliance with financial regulations.
                </p>
              </div>
              
              <div className="space-y-4">
                <a
                  href={kycLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start Identity Verification
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                
                <div className="text-xs text-gray-500">
                  <p>Click the button above to open Fern's verification portal in a new tab.</p>
                  <p>Complete the verification process, then return here and click "I've completed verification".</p>
                </div>
                
                <button
                  onClick={handleKycComplete}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  I've completed verification
                </button>
              </div>
            </div>
          )}

          {step === "bankDetails" && (
            <div className="text-center py-8">
              <BankAccountBypassButton onBypass={() => {
                setStep("funding");
                handleFundingComplete();
              }} />
              
              <div className="mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Bank Account Required</h3>
                <p className="text-gray-600 mb-4">
                  To complete your payment plan funding, we need your bank account details.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  This information is required to process your bank transfer to fund the payment plan.
                </p>
              </div>
              
              <div className="space-y-4">
                <form onSubmit={(e) => { e.preventDefault(); handleBankAccountSubmit(); }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={bankFormData.ownerFirstName}
                        onChange={(e) => setBankFormData(prev => ({ ...prev, ownerFirstName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={bankFormData.ownerLastName}
                        onChange={(e) => setBankFormData(prev => ({ ...prev, ownerLastName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={bankFormData.bankName}
                      onChange={(e) => setBankFormData(prev => ({ ...prev, bankName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Chase Bank"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={bankFormData.accountNumber}
                        onChange={(e) => setBankFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="1234567890"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Routing Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={bankFormData.routingNumber}
                        onChange={(e) => setBankFormData(prev => ({ ...prev, routingNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="021000021"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Type *
                    </label>
                    <select
                      required
                      value={bankFormData.accountType}
                      onChange={(e) => setBankFormData(prev => ({ ...prev, accountType: e.target.value as "CHECKING" | "SAVINGS" }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="CHECKING">Checking</option>
                      <option value="SAVINGS">Savings</option>
                    </select>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingBank}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmittingBank ? 'Setting up...' : 'Set Up Bank Account'}
                    </button>
                  </div>
                </form>

                <div className="text-xs text-gray-500 text-center">
                  <p>Your bank account information is encrypted and securely transmitted to Fern.</p>
                  <p>This information is only used to process your payment plan funding.</p>
                </div>
              </div>
            </div>
          )}

          {step === "funding" && result && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Funding Instructions</h3>
                <p className="text-gray-600 mb-4">
                  Follow these instructions to fund your payment plan via bank transfer.
                </p>
                <p className="text-sm text-gray-500">
                  Fern will provide you with bank account details to send your payment.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Bank Transfer Details</h4>
                {result.funding.transferInstructions ? (
                  <div className="space-y-2 text-sm">
                    <pre className="whitespace-pre-wrap text-gray-700 bg-white p-3 rounded border">
                      {JSON.stringify(result.funding.transferInstructions, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-gray-600">Transfer instructions will be provided by Fern.</p>
                )}
              </div>

              {(result.transaction || transactionData) && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Transaction Details</h4>
                  <div className="space-y-1 text-sm text-blue-800">
                    <p><strong>Transaction ID:</strong> {(transactionData || result.transaction)?.transactionId}</p>
                    <p><strong>Status:</strong> {(transactionData || result.transaction)?.transactionStatus}</p>
                    <p><strong>Amount:</strong> ${plan.totalAmount}</p>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => setStep("bankDetails")}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Show Bank Form
                </button>
                <button
                  onClick={() => setStep("success")}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  I've Sent the Payment
                </button>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Initiated!</h3>
              <p className="text-gray-600 mb-6">
                Your bank transfer has been initiated. It may take 1-3 business days to process.
              </p>
              <button
                onClick={() => {
                  handleFundingComplete();
                  handleClose();
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
              <p className="text-gray-600 mb-4">{error || "Failed to start funding process"}</p>
              <div className="flex space-x-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleStartOnramp}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

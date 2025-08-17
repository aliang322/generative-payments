import React from 'react';
import { useTestingConfig } from '@/lib/hooks/useTestingConfig';

interface TestingBypassButtonProps {
  type: 'kyc' | 'bank-account';
  onBypass: () => void;
  disabled?: boolean;
  className?: string;
}

export function TestingBypassButton({ 
  type, 
  onBypass, 
  disabled = false,
  className = ''
}: TestingBypassButtonProps) {
  const { isTestingMode, bypassKyc, bypassBankAccount } = useTestingConfig();

  // Only show button if in testing mode and the specific bypass is enabled
  const shouldShow = isTestingMode && (
    (type === 'kyc' && bypassKyc) || 
    (type === 'bank-account' && bypassBankAccount)
  );

  if (!shouldShow) {
    return null;
  }

  const buttonText = type === 'kyc' ? 'Bypass KYC' : 'Bypass Bank Setup';
  const buttonColor = type === 'kyc' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-orange-500 hover:bg-orange-600';

  return (
    <div className="mb-4 p-4 border-2 border-dashed border-yellow-400 bg-yellow-50 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-yellow-800">
            🧪 Testing Mode Active
          </h3>
          <p className="text-xs text-yellow-700 mt-1">
            {type === 'kyc' 
              ? 'KYC verification bypassed for demo purposes' 
              : 'Bank account setup bypassed for demo purposes'
            }
          </p>
        </div>
        <button
          onClick={onBypass}
          disabled={disabled}
          className={`
            px-4 py-2 text-white font-medium rounded-md text-sm
            ${buttonColor}
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200
            ${className}
          `}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}

// Convenience components for specific bypass types
export function KYCBypassButton(props: Omit<TestingBypassButtonProps, 'type'>) {
  return <TestingBypassButton type="kyc" {...props} />;
}

export function BankAccountBypassButton(props: Omit<TestingBypassButtonProps, 'type'>) {
  return <TestingBypassButton type="bank-account" {...props} />;
}

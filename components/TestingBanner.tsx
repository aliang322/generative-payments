import React from 'react';
import { useTestingConfig } from '@/lib/hooks/useTestingConfig';

export function TestingBanner() {
  const { isTestingMode, bypassKyc, bypassBankAccount, environment } = useTestingConfig();

  if (!isTestingMode) {
    return null;
  }

  const bypasses = [];
  if (bypassKyc) bypasses.push('KYC Verification');
  if (bypassBankAccount) bypasses.push('Bank Account Setup');

  return (
    <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">🧪</div>
          <div>
            <h3 className="font-bold text-sm">
              Testing Mode Active
            </h3>
            <p className="text-xs opacity-90">
              Environment: {environment} | Bypasses: {bypasses.join(', ')}
            </p>
          </div>
        </div>
        <div className="text-xs opacity-75">
          Demo Mode - Not Production
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';

export interface TestingConfig {
  isTestingMode: boolean;
  bypassKyc: boolean;
  bypassBankAccount: boolean;
  environment: string;
}

export function useTestingConfig() {
  const [testingConfig, setTestingConfig] = useState<TestingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTestingConfig() {
      try {
        const response = await fetch('/api/fern/testing-config');
        if (!response.ok) {
          throw new Error('Failed to fetch testing config');
        }
        
        const data = await response.json();
        setTestingConfig(data.testingConfig);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchTestingConfig();
  }, []);

  return {
    testingConfig,
    loading,
    error,
    isTestingMode: testingConfig?.isTestingMode || false,
    bypassKyc: testingConfig?.bypassKyc || false,
    bypassBankAccount: testingConfig?.bypassBankAccount || false,
  };
}

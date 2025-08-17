# Fern On-ramp & Off-ramp Integration

This document describes the Fern integration for handling fiat-to-crypto on-ramps and crypto-to-fiat off-ramps in your generative payments application.

## Overview

The Fern integration provides:
- **On-ramp**: Sender fiat → USDC → Agent wallet
- **Off-ramp**: USDC (receiver wallet) → bank account
- **Auto Cash-Out**: Agent sends USDC to Fern crypto wallet tied to receiver
- **Minimal in-memory plan store** (no database required)
- **Clean fetch wrapper** with idempotent transactions
- **Status polling** for transaction monitoring
- **CCTP v2 Fast chain validation** for cross-chain compatibility

## Integration with Your Payment Plan Flow

The Fern integration is designed to work seamlessly with your existing generative payments flow:

### 1. Sign in (Dynamic) ✅
- Already handled by your existing Dynamic integration
- User email: `caliangandrew@gmail.com`

### 2. Describe plan → Generate plan ✅
- Your existing `parse-payment-plan` API extracts structured data
- User chooses role (Sender/Receiver) and chains
- Receiver must choose CCTP-supported chain

### 3. Share acceptance link ✅
- **Sender accepts and funds** (Option 1 - Fern onramp):
  - Fern onramp → fiat → USDC → Agent Wallet
  - Chain validation ensures CCTP compatibility
- **Receiver accepts and receives**:
  - Dynamic auth with instant wallet provisioning
  - Optional Auto Cash-Out (Fern) after KYC/payout profile

### 4. Agent executes payment plan ✅
- Cron job uses CCTP v2 Fast to bridge USDC
- Fern handles final offramp to bank account

## Setup

### 1. Environment Variables

Create a `.env.local` file in your project root:

```bash
# Fern API Configuration
FERN_API_KEY=sk_***************
FERN_ORG_ID=8469411c-48c1-4e26-a032-44688be9cb4b   # optional
FERN_BASE_URL=https://api.fernhq.com

# Existing Dynamic configuration
NEXT_PUBLIC_DYNAMIC_ENV_ID=
```

### 2. API Routes

The integration provides several API endpoints:

#### Core Fern Operations
- `POST /api/fern/onramp` - Start fiat-to-crypto on-ramp
- `POST /api/fern/offramp` - Start crypto-to-fiat off-ramp  
- `GET /api/fern/transaction/[id]` - Check transaction status

#### Payment Plan Integration
- `POST /api/fern/payment-plan` - Unified API for payment plan operations
  - `action: "create_plan"` - Create plan from parsed data
  - `action: "start_onramp"` - Start onramp for payment plan
  - `action: "start_offramp"` - Start offramp for payment plan
  - `action: "validate_chains"` - Validate CCTP compatibility
  - `action: "get_supported_chains"` - Get CCTP-supported chains
  - `action: "get_plan"` - Retrieve plan from memory store

### 3. Components

Ready-to-use React components:
- `OnrampForm` - Form for starting on-ramp flows
- `OfframpForm` - Form for starting off-ramp flows
- `TransactionStatus` - Component for monitoring transaction status
- `IntegrationExample` - Shows integration with parse-payment-plan API
- `CompleteFlowExample` - Complete 5-step payment plan flow demo

### 4. Hooks

Custom React hooks for easy integration:
- `useFernOnramp()` - Hook for on-ramp operations
- `useFernOfframp()` - Hook for off-ramp operations
- `useFernTransactionStatus()` - Hook for status checking
- `useFern()` - Combined hook for all operations

## Usage Examples

### Complete Payment Plan Flow

```typescript
import { useFern } from '@/lib/hooks/useFern';

function PaymentPlanFlow() {
  const { onramp, offramp } = useFern();

  // Step 1: Parse plan (your existing API)
  const parsePlan = async (description: string) => {
    const response = await fetch("/api/parse-payment-plan", {
      method: "POST",
      body: JSON.stringify({ description }),
    });
    return response.json();
  };

  // Step 2: Create Fern plan
  const createPlan = async (parsedPlan: any) => {
    const response = await fetch("/api/fern/payment-plan", {
      method: "POST",
      body: JSON.stringify({
        action: "create_plan",
        planId: `plan_${Date.now()}`,
        parsedPlan,
        senderEmail: "caliangandrew@gmail.com",
        receiverEmail: "receiver@example.com",
        agentChain: "BASE",
        agentWalletAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
        receiverChosenChain: "BASE",
        autoCashOut: false,
      }),
    });
    return response.json();
  };

  // Step 3: Start onramp (Option 1 - Fern onramp)
  const startOnramp = async (planId: string) => {
    const response = await fetch("/api/fern/payment-plan", {
      method: "POST",
      body: JSON.stringify({
        action: "start_onramp",
        planId,
        senderEmail: "caliangandrew@gmail.com",
        amountUsd: "150.00",
        fiatMethod: "ACH",
        validateChains: true,
      }),
    });
    return response.json();
  };

  // Step 4: Start offramp (Receiver accepts)
  const startOfframp = async (planId: string) => {
    const response = await fetch("/api/fern/payment-plan", {
      method: "POST",
      body: JSON.stringify({
        action: "start_offramp",
        planId,
        receiverEmail: "receiver@example.com",
        amountUsd: "150.00",
        chosenChain: "BASE",
        autoCashOut: true,
        validateChains: true,
      }),
    });
    return response.json();
  };

  return (
    <div>
      {/* Your UI components */}
    </div>
  );
}
```

### Chain Validation

```typescript
// Validate chains before starting operations
const validateChains = async () => {
  const response = await fetch("/api/fern/payment-plan", {
    method: "POST",
    body: JSON.stringify({
      action: "validate_chains",
      senderSourceChain: "BASE",
      receiverDestChain: "ETHEREUM",
    }),
  });
  
  const { validation } = await response.json();
  
  if (!validation.valid) {
    console.error("Chain validation failed:", validation.errors);
    // Prompt user to switch to supported chains
  }
};

// Get supported chains
const getSupportedChains = async () => {
  const response = await fetch("/api/fern/payment-plan", {
    method: "POST",
    body: JSON.stringify({
      action: "get_supported_chains",
    }),
  });
  
  const { supportedChains } = await response.json();
  return supportedChains; // ["ETHEREUM", "BASE", "ARBITRUM", ...]
};
```

### On-ramp (Sender → Agent Wallet)

```typescript
import { useFernOnramp } from '@/lib/hooks/useFern';

function OnrampComponent() {
  const { startOnramp, loading, result, error } = useFernOnramp();

  const handleOnramp = async () => {
    try {
      const result = await startOnramp({
        planId: "plan_123",
        senderEmail: "caliangandrew@gmail.com",
        amountUsd: "150.00",
        agentChain: "BASE",
        agentWalletAddress: "0xAGENT...WALLET",
      });
      
      console.log("On-ramp started:", result);
      // Show funding.transferInstructions to sender
      // Poll transaction status until COMPLETED
    } catch (error) {
      console.error("On-ramp failed:", error);
    }
  };

  return (
    <button onClick={handleOnramp} disabled={loading}>
      {loading ? "Starting..." : "Start On-ramp"}
    </button>
  );
}
```

### Off-ramp (Receiver → Bank)

#### Auto Cash-Out (Agent sends USDC to Fern)

```typescript
import { useFernOfframp } from '@/lib/hooks/useFern';

function OfframpComponent() {
  const { startOfframp, loading, result, error } = useFernOfframp();

  const handleAutoCashOut = async () => {
    try {
      const result = await startOfframp({
        planId: "plan_123",
        receiverEmail: "receiver@example.com",
        amountUsd: "150.00",
        agentChain: "BASE",
        agentWalletAddress: "0xAGENT...WALLET",
        chosenChain: "BASE",
        autoCashOut: true,
      });
      
      console.log("Off-ramp started:", result);
      // Agent should send USDC to result.funding.cryptoDepositInstructions
      // Poll status until COMPLETED
    } catch (error) {
      console.error("Off-ramp failed:", error);
    }
  };

  return (
    <button onClick={handleAutoCashOut} disabled={loading}>
      {loading ? "Starting..." : "Start Auto Cash-Out"}
    </button>
  );
}
```

#### Manual Cash-Out (Receiver sends USDC)

```typescript
const handleManualCashOut = async () => {
  try {
    const result = await startOfframp({
      planId: "plan_123",
      receiverEmail: "receiver@example.com",
      amountUsd: "150.00",
      agentChain: "BASE",
      agentWalletAddress: "0xAGENT...WALLET",
      chosenChain: "BASE",
      autoCashOut: false,
      receiverExternalWalletAddress: "0xRECEIVER...WALLET",
    });
    
    console.log("Off-ramp started:", result);
    // Show result.funding.cryptoDepositInstructions to receiver
    // Receiver sends USDC to Fern's deposit address
    // Poll status until COMPLETED
  } catch (error) {
    console.error("Off-ramp failed:", error);
  }
};
```

### Transaction Status Polling

```typescript
import { useFernTransactionStatus } from '@/lib/hooks/useFern';

function StatusComponent({ transactionId }: { transactionId: string }) {
  const { checkStatus, loading, status, error } = useFernTransactionStatus();

  const handleCheckStatus = async () => {
    try {
      const status = await checkStatus(transactionId);
      console.log("Transaction status:", status);
      
      if (status === "COMPLETED") {
        // Handle completion
      } else if (status === "FAILED") {
        // Handle failure
      }
    } catch (error) {
      console.error("Status check failed:", error);
    }
  };

  return (
    <div>
      <button onClick={handleCheckStatus} disabled={loading}>
        {loading ? "Checking..." : "Check Status"}
      </button>
      {status && <p>Status: {status}</p>}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

## Integration with Your Flow

### 1. Sign in (Dynamic)
Already handled by your existing Dynamic integration.

### 2. Wallet Provisioning
Already handled by your existing wallet connection.

### 3. Plan Description → NLP JSON
Your existing code generates the plan with:
- `amountUsd`
- `agentChain` 
- `agentWalletAddress`
- `senderEmail`
- `receiverEmail`

### 4. Create Agent Wallet
You already have the EVM address from Dynamic server wallet.

### 5. Share Acceptance Link
Out of scope for Fern - your existing flow.

### 6. Sender Accepts & Funds
```typescript
// Call onramp API
const result = await startOnramp({
  planId: plan.id,
  senderEmail: sender.email,
  amountUsd: plan.amountUsd,
  agentChain: plan.agentChain,
  agentWalletAddress: plan.agentWalletAddress,
});

// Show ACH/Wire instructions from result.funding.transferInstructions
// Poll status until COMPLETED
```

### 7. CCTP Bridge
Once Agent wallet holds USDC, your cron/worker does CCTP v2 Fast to Receiver's chosen chain.

### 8. Receiver Accepts & Receives
When USDC arrives on receiver's chain:

#### Auto Cash-Out Mode
```typescript
const result = await startOfframp({
  planId: plan.id,
  receiverEmail: receiver.email,
  amountUsd: plan.amountUsd,
  agentChain: plan.agentChain,
  agentWalletAddress: plan.agentWalletAddress,
  chosenChain: receiver.chosenChain,
  autoCashOut: true,
});

// Agent sends USDC to result.funding.cryptoDepositInstructions
// Poll status until COMPLETED
```

#### Manual Cash-Out Mode
```typescript
const result = await startOfframp({
  planId: plan.id,
  receiverEmail: receiver.email,
  amountUsd: plan.amountUsd,
  agentChain: plan.agentChain,
  agentWalletAddress: plan.agentWalletAddress,
  chosenChain: receiver.chosenChain,
  autoCashOut: false,
  receiverExternalWalletAddress: receiver.walletAddress,
});

// Show result.funding.cryptoDepositInstructions to receiver
// Receiver sends USDC from their wallet to Fern
// Poll status until COMPLETED
```

## Demo

Visit `/fern-demo` to see a complete demo of the integration with:
- Interactive forms for on-ramp and off-ramp
- Real-time transaction status monitoring
- Configuration options for different scenarios
- **Complete Flow Example** - 5-step payment plan flow demo
- **Integration Example** - Shows integration with parse-payment-plan API

## File Structure

```
├── lib/
│   ├── fern.ts                    # Core Fern SDK with payment plan helpers
│   └── hooks/
│       └── useFern.ts             # React hooks
├── app/
│   ├── api/fern/
│   │   ├── onramp/route.ts        # On-ramp API
│   │   ├── offramp/route.ts       # Off-ramp API
│   │   ├── transaction/[id]/route.ts # Status API
│   │   └── payment-plan/route.ts  # Unified payment plan API
│   └── fern-demo/page.tsx         # Demo page
├── components/fern/
│   ├── OnrampForm.tsx             # On-ramp form component
│   ├── OfframpForm.tsx            # Off-ramp form component
│   ├── TransactionStatus.tsx      # Status component
│   ├── IntegrationExample.tsx     # Integration example
│   └── CompleteFlowExample.tsx    # Complete flow demo
├── .env.local                     # Environment variables
└── FERN_INTEGRATION.md            # Documentation
```

## CCTP v2 Fast Support

The integration includes built-in support for CCTP v2 Fast chain validation:

### Supported Chains
- Ethereum
- Base
- Arbitrum
- Polygon
- Avalanche
- Optimism

### Chain Validation
```typescript
// Validate before starting operations
const validation = validateChainCompatibility({
  senderSourceChain: "BASE",
  receiverDestChain: "ETHEREUM",
});

if (!validation.valid) {
  // Prompt user to switch to supported chains
  console.error("Chain validation failed:", validation.errors);
}
```

## Error Handling

The integration includes comprehensive error handling:
- API errors are caught and returned with descriptive messages
- Network errors are handled gracefully
- Validation errors for required fields
- Transaction status errors are properly surfaced
- Chain compatibility validation

## Security Notes

- API keys are stored in environment variables
- All API calls use HTTPS
- Idempotency keys prevent duplicate transactions
- Customer data is cached in memory only (no persistence)
- Chain validation prevents incompatible operations

## Testing

1. Set up your Fern API key in `.env.local`
2. Visit `/fern-demo` to test the integration
3. Use the "Complete Flow" tab to test the full 5-step process
4. Use sandbox/testnet for development
5. Monitor transaction statuses in real-time

## Support

For issues with the Fern integration:
1. Check the browser console for errors
2. Verify your API key is correct
3. Ensure all required fields are provided
4. Check Fern's API documentation for endpoint details
5. Use the demo page to test individual components

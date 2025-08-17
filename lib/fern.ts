import crypto from "node:crypto";

const FERN_API_KEY = process.env.FERN_API_KEY!;
const FERN_BASE_URL = process.env.FERN_BASE_URL ?? "https://api.fernhq.com";
const FERN_ORG_ID = process.env.FERN_ORG_ID; // optional

if (!FERN_API_KEY) {
  throw new Error("Missing FERN_API_KEY");
}

type Chain =
  | "ETHEREUM"
  | "BASE"
  | "ARBITRUM"
  | "POLYGON"
  | "AVALANCHE"
  | "OPTIMISM"; // add if you expose more

type PaymentMethodFiat = "ACH" | "WIRE";
type PaymentMethodChain = Chain;

// ------------ In-memory demo store (no DB) ------------
export type PlanRole = "SENDER" | "RECEIVER";
export type PlanId = string;

export type Plan = {
  planId: PlanId;
  agentWallet: { chain: Chain; address: string }; // where USDC should land pre-CCTP out
  sender?: { email: string; chosenSourceChain?: Chain };
  receiver?: { email: string; chosenDestChain: Chain; autoCashOut?: boolean };
  amountUsd: string; // as string for exactness
};

// Testing configuration
export const TESTING_CONFIG = {
  // Set to true to bypass KYC verification for testing
  BYPASS_KYC: process.env.BYPASS_KYC === 'true' || process.env.NODE_ENV === 'development',
  // Set to true to bypass bank account setup for testing
  BYPASS_BANK_ACCOUNT: process.env.BYPASS_BANK_ACCOUNT === 'true' || process.env.NODE_ENV === 'development',
  // Mock KYC status for testing
  MOCK_KYC_STATUS: 'ACTIVE' as const,
};

/**
 * Get testing configuration for frontend display
 * This allows the UI to show bypass buttons when in testing mode
 */
export function getTestingConfig() {
  return {
    isTestingMode: TESTING_CONFIG.BYPASS_KYC || TESTING_CONFIG.BYPASS_BANK_ACCOUNT,
    bypassKyc: TESTING_CONFIG.BYPASS_KYC,
    bypassBankAccount: TESTING_CONFIG.BYPASS_BANK_ACCOUNT,
    environment: process.env.NODE_ENV || 'development',
  };
}

export const memory = {
  plans: new Map<PlanId, Plan>(),
  // cache Fern ids by email (hackathon-local)
  fernCustomerIdByEmail: new Map<string, string>(),
  // per email we may want a default Fern crypto wallet or bank account ids
  fernCryptoAccountIdByEmailAndChain: new Map<string, string>(), // key `${email}:${chain}`
  fernFiatAccountIdByEmail: new Map<string, string>(), // any bank account
};

// Helper function to clear customer cache for testing/debugging
export function clearCustomerCache() {
  memory.fernCustomerIdByEmail.clear();
  memory.fernCryptoAccountIdByEmailAndChain.clear();
  memory.fernFiatAccountIdByEmail.clear();
}

// ------------ Low-level fetch helper ------------
export async function fernFetch<T>(
  path: string,
  init?: RequestInit & { idempotencyKey?: string }
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${FERN_API_KEY}`,
    Accept: "*/*",
    "Content-Type": "application/json",
  };
  if (init?.idempotencyKey) {
    headers["x-idempotency-key"] = init.idempotencyKey;
  }
  const res = await fetch(`${FERN_BASE_URL}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fern ${path} ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

// ------------ Email Helper ------------
/**
 * Get user email from Dynamic auth or use fallback
 * The emails in the flow are task assignments, not actual user emails
 */
export function getUserEmail(dynamicUserEmail?: string | null): string {
  // Use Dynamic auth email if available, otherwise fallback to caliangben@gmail.com
  return dynamicUserEmail || "caliangben@gmail.com";
}

// ------------ Customers ------------
export async function ensureFernCustomer(params: {
  email: string;
  customerType?: "INDIVIDUAL" | "BUSINESS";
  firstName?: string;
  lastName?: string;
  businessName?: string;
}) {
  const { email } = params;
  const cached = memory.fernCustomerIdByEmail.get(email);
  if (cached) return { customerId: cached };

  // First, try to find existing customer by email
  try {
    const existingCustomers = await fernFetch<{ customers: Array<{ customerId: string; email: string }> }>(
      `/customers?email=${encodeURIComponent(email)}`,
      { method: "GET" }
    );
    
    if (existingCustomers.customers && existingCustomers.customers.length > 0) {
      // Use the first (most recent) customer found
      const existingCustomer = existingCustomers.customers[0];
      memory.fernCustomerIdByEmail.set(email, existingCustomer.customerId);
      return { customerId: existingCustomer.customerId };
    }
  } catch (error) {
    console.log("Could not fetch existing customer, will try to create new one:", error);
  }

  // Create minimal customer (hosted KYC link returned)
  const body = {
    customerType: params.customerType ?? "INDIVIDUAL",
    firstName: params.firstName ?? "Hack",
    lastName: params.lastName ?? "User",
    businessName: params.businessName,
    email,
  };
  
  try {
    const created = await fernFetch<{ customerId: string; kycLink?: string }>(
      `/customers`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
    memory.fernCustomerIdByEmail.set(email, created.customerId);
    return { customerId: created.customerId };
  } catch (error) {
    // If creation fails with "Account already exists", try to fetch again
    if (error instanceof Error && error.message.includes("Account already exists")) {
      try {
        const existingCustomers = await fernFetch<{ customers: Array<{ customerId: string; email: string }> }>(
          `/customers?email=${encodeURIComponent(email)}`,
          { method: "GET" }
        );
        
        if (existingCustomers.customers && existingCustomers.customers.length > 0) {
          const existingCustomer = existingCustomers.customers[0];
          memory.fernCustomerIdByEmail.set(email, existingCustomer.customerId);
          return { customerId: existingCustomer.customerId };
        }
      } catch (fetchError) {
        console.error("Failed to fetch existing customer after creation error:", fetchError);
      }
    }
    throw error;
  }
}

// ------------ Payment Accounts ------------
export async function createExternalCryptoWalletPaymentAccount(params: {
  customerId: string;
  chain: Chain;
  address: string;
  nickname?: string;
  isThirdParty?: boolean;
}) {
  const payload: any = {
    paymentAccountType: "EXTERNAL_CRYPTO_WALLET",
    customerId: params.customerId,
    nickname: params.nickname ?? `Wallet ${params.chain}`,
    externalCryptoWallet: {
      cryptoWalletType: "EVM",
      chain: params.chain,
      address: params.address,
    },
    isThirdParty: params.isThirdParty ?? false,
  };
  
  // Only include organizationId if it's set and valid
  if (FERN_ORG_ID) {
    payload.organizationId = FERN_ORG_ID;
  }
  
  return fernFetch<{ paymentAccountId: string }>(`/payment-accounts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createExternalBankAccount(params: {
  customerId: string;
  accountNumber: string;
  routingNumber: string;
  bankName: string;
  bankAccountCurrency?: "USD";
  bankAccountType?: "CHECKING" | "SAVINGS";
  bankAccountPaymentMethod?: "ACH" | "WIRE";
  nickname?: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerAddress?: {
    country?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    stateCode?: string;
    postalCode?: string;
    locale?: string;
  };
  bankAddress?: {
    country?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    stateCode?: string;
    postalCode?: string;
    locale?: string;
  };
}) {
  const payload: any = {
    paymentAccountType: "EXTERNAL_BANK_ACCOUNT",
    customerId: params.customerId,
    nickname: params.nickname ?? "Bank Account",
    externalBankAccount: {
      accountNumber: params.accountNumber,
      routingNumber: params.routingNumber,
      bankName: params.bankName,
      bankAccountCurrency: params.bankAccountCurrency ?? "USD",
      bankAccountType: params.bankAccountType ?? "CHECKING",
      bankAccountPaymentMethod: params.bankAccountPaymentMethod ?? "ACH",
      bankAccountOwner: {
        email: params.ownerEmail,
        firstName: params.ownerFirstName,
        lastName: params.ownerLastName,
        type: "INDIVIDUAL",
      },
    },
    isThirdParty: false,
  };
  
  // Add owner address (required)
  if (params.ownerAddress) {
    payload.externalBankAccount.bankAccountOwner.address = params.ownerAddress;
  } else {
    // Provide default address if not provided
    payload.externalBankAccount.bankAccountOwner.address = {
      country: "US",
      addressLine1: "123 Main St",
      city: "New York",
      state: "New York",
      stateCode: "NY",
      postalCode: "10001",
      locale: "en-US"
    };
  }
  
  // Add bank address (required)
  if (params.bankAddress) {
    payload.externalBankAccount.bankAddress = params.bankAddress;
  } else {
    // Provide default bank address if not provided
    payload.externalBankAccount.bankAddress = {
      country: "US",
      addressLine1: "350 5th Avenue",
      addressLine2: "Floor 21",
      city: "New York",
      state: "New York",
      stateCode: "NY",
      postalCode: "10016",
      locale: "en-US"
    };
  }
  
  // Only include organizationId if it's set and valid
  if (FERN_ORG_ID) {
    payload.organizationId = FERN_ORG_ID;
  }
  
  return fernFetch<{ 
    paymentAccountId: string;
    paymentAccountType: string;
    nickname: string;
    createdAt: string;
    customerId: string;
    paymentAccountStatus: string;
    externalBankAccount?: {
      bankAccountType: string;
      bankAccountOwnerName: string;
      bankAccountOwnerEmail: string;
      bankName: string;
      bankAccountCurrency: any;
      bankAccountMask: string;
      bankAccountPaymentMethod: string;
    };
    bankAccountFormLink?: string;
  }>(`/payment-accounts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createFernCryptoWalletPaymentAccount(params: {
  customerId: string;
  chain: Chain;
  nickname?: string;
}) {
  const payload: any = {
    paymentAccountType: "FERN_CRYPTO_WALLET",
    customerId: params.customerId,
    nickname: params.nickname ?? `Fern Wallet ${params.chain}`,
    fernCryptoWallet: { cryptoWalletType: "EVM" },
  };
  
  // Only include organizationId if it's set and valid
  if (FERN_ORG_ID) {
    payload.organizationId = FERN_ORG_ID;
  }
  
  const resp = await fernFetch<{ paymentAccountId: string; fernCryptoWallet?: { address?: string } }>(
    `/payment-accounts`,
    { method: "POST", body: JSON.stringify(payload) }
  );
  return resp; // includes paymentAccountId; address retrievable via GET if needed
}

export async function createFernAutoFiatAccount(params: {
  customerId: string;
  destinationPaymentAccountId: string; // where USDC ends up (agent or user crypto)
  destinationCurrency?: "USDC";
  bankAccountCurrency?: "USD";
  nickname?: string;
}) {
  const payload: any = {
    paymentAccountType: "FERN_AUTO_FIAT_ACCOUNT",
    customerId: params.customerId,
    nickname: params.nickname ?? "Auto Onramp to Crypto",
    fernAutoFiatAccount: {
      bankAccountCurrency: params.bankAccountCurrency ?? "USD",
      destinationPaymentAccountId: params.destinationPaymentAccountId,
      destinationCurrency: params.destinationCurrency ?? "USDC",
    },
  };
  
  // Only include organizationId if it's set and valid
  if (FERN_ORG_ID) {
    payload.organizationId = FERN_ORG_ID;
  }
  
  // Response includes bank routing/account details & optional bankAccountFormLink in sandbox
  return fernFetch<{ paymentAccountId: string; bankAccountFormLink?: string }>(
    `/payment-accounts`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function createFernFiatAccount(params: {
  customerId: string;
  bankAccountCurrency?: "USD";
  nickname?: string;
}) {
  const payload: any = {
    paymentAccountType: "FERN_FIAT_ACCOUNT",
    customerId: params.customerId,
    nickname: params.nickname ?? "Fiat Payout (USD)",
    fernFiatAccount: { bankAccountCurrency: params.bankAccountCurrency ?? "USD" },
  };
  
  // Only include organizationId if it's set and valid
  if (FERN_ORG_ID) {
    payload.organizationId = FERN_ORG_ID;
  }
  
  return fernFetch<{ paymentAccountId: string; bankAccountFormLink?: string }>(
    `/payment-accounts`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

// ------------ Quotes & Transactions ------------
type CreateQuoteParams = {
  customerId: string;
  // Source
  sourcePaymentAccountId: string;
  sourceCurrency: "USD" | "USDC";
  sourcePaymentMethod: PaymentMethodFiat | PaymentMethodChain;
  sourceAmount: string; // decimal string
  // Destination
  destinationPaymentAccountId: string;
  destinationPaymentMethod: PaymentMethodFiat | PaymentMethodChain;
  destinationCurrency: "USD" | "USDC";
  // Optional dev fee (shown in Fern UI)
  developerFeeAmountUsd?: string;
};

export async function createQuote(p: CreateQuoteParams) {
  const payload: any = {
    customerId: p.customerId,
    source: {
      sourcePaymentAccountId: p.sourcePaymentAccountId,
      sourceCurrency: p.sourceCurrency,
      sourcePaymentMethod: p.sourcePaymentMethod,
      sourceAmount: p.sourceAmount,
    },
    destination: {
      destinationPaymentAccountId: p.destinationPaymentAccountId,
      destinationPaymentMethod: p.destinationPaymentMethod,
      destinationCurrency: p.destinationCurrency,
    },
  };
  
  // Add developer fee if specified
  if (p.developerFeeAmountUsd) {
    payload.developerFee = {
      developerFeeType: "USD",
      developerFeeAmount: p.developerFeeAmountUsd
    };
  }
  
  return fernFetch<{ 
    quoteId: string; 
    expiresAt: string; 
    estimatedExchangeRate: string;
    destinationAmount: string;
    fees?: {
      feeCurrency: any;
      fernFee: any;
      developerFee?: any;
    };
  }>(`/quotes`, { method: "POST", body: JSON.stringify(payload) });
}

export async function createTransaction(quoteId: string, correlationId?: string) {
  const payload: any = { quoteId };
  
  if (correlationId) {
    payload.correlationId = correlationId;
  }
  
  return fernFetch<{
    transactionId: string;
    customerId: string;
    quoteId: string;
    transactionStatus: string;
    correlationId?: string;
    source: {
      sourcePaymentAccountId: string;
      sourceCurrency: any;
      sourcePaymentMethod: string;
      sourceAmount: string;
    };
    destination: {
      destinationPaymentAccountId: string;
      destinationPaymentMethod: string;
      destinationCurrency: any;
      exchangeRate: string;
      destinationAmount: string;
    };
    fees: {
      feeCurrency: any;
      fernFee: any;
      developerFee?: any;
    };
    transferInstructions?: any;
    createdAt: string;
    updatedAt: string;
  }>(`/transactions`, {
    method: "POST",
    idempotencyKey: crypto.randomUUID(),
    body: JSON.stringify(payload),
  });
}

export async function getTransaction(txId: string) {
  return fernFetch<{
    transactionId: string;
    transactionStatus: string;
    transferInstructions?: any;
  }>(`/transactions/${txId}`, { method: "GET" });
}

// ------------ High-level flows ------------
/**
 * ONRAMP (Builder Plan Compatible)
 * Uses EXTERNAL_BANK_ACCOUNT and EXTERNAL_CRYPTO_WALLET which should be available on Builder plan.
 */
export async function startOnrampToAgent(params: {
  plan: Plan;
  senderEmail?: string; // Optional - will use plan.sender.email or fallback
  amountUsd: string;
  fiatMethod?: PaymentMethodFiat; // default ACH
  agentChain?: Chain; // overrides plan.agentWallet.chain for quote's destinationPaymentMethod
  agentWalletAddress?: string; // overrides plan.agentWallet.address if provided
  dynamicUserEmail?: string | null; // Email from Dynamic auth
}) {
  const chain = params.agentChain ?? params.plan.agentWallet.chain;
  const agentAddress = params.agentWalletAddress ?? params.plan.agentWallet.address;

  // Use provided sender email, plan sender email, or get from Dynamic auth/fallback
  const actualSenderEmail = params.senderEmail || params.plan.sender?.email || getUserEmail(params.dynamicUserEmail);

  // 1) Ensure Sender as Fern customer
  const { customerId: senderCustomerId } = await ensureFernCustomer({
    email: actualSenderEmail,
    customerType: "INDIVIDUAL",
  });

  // 2) Get customer details to check KYC status and get KYC link
  let kycLink: string | undefined;
  let customerStatus: string = "UNKNOWN";
  
  // Check if we should bypass KYC for testing
  if (TESTING_CONFIG.BYPASS_KYC) {
    console.log("🧪 TESTING MODE: Bypassing KYC verification");
    customerStatus = TESTING_CONFIG.MOCK_KYC_STATUS;
    kycLink = undefined;
  } else {
    try {
      const customerDetails = await fernFetch<{ 
        customerId: string; 
        customerStatus: string; 
        kycLink?: string;
        email: string;
        name: string;
      }>(`/customers/${senderCustomerId}`, { method: "GET" });
      
      kycLink = customerDetails.kycLink;
      customerStatus = customerDetails.customerStatus;
      console.log("Customer details:", customerDetails);
    } catch (error) {
      console.log("Could not fetch customer details:", error);
    }
  }

  // 3) Create external crypto wallet for agent (should work on Builder plan)
  let agentCryptoAccountId: string | undefined;
  try {
    const agentAccount = await createExternalCryptoWalletPaymentAccount({
      customerId: senderCustomerId,
      chain,
      address: agentAddress,
      nickname: `Agent Wallet (${chain})`,
      isThirdParty: true,
    });
    agentCryptoAccountId = agentAccount.paymentAccountId;
    console.log("✅ Agent crypto account created:", agentCryptoAccountId);
  } catch (error) {
    console.log("❌ Could not create agent crypto account:", error);
    throw new Error(`Failed to create agent crypto account: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 4) For Builder plan, we need to guide the user through KYC and bank account setup
  let fiatAccountId: string | undefined;
  let bankAccountFormLink: string | undefined;
  let canProceed = false;
  let needsKyc = customerStatus !== "ACTIVE";
  let needsBankDetails = true;

  // Check if customer is KYC verified
  if (customerStatus === "ACTIVE") {
    needsKyc = false;
    
    // Check if we should bypass bank account setup for testing
    if (TESTING_CONFIG.BYPASS_BANK_ACCOUNT) {
      console.log("🧪 TESTING MODE: Bypassing bank account setup");
      needsBankDetails = false;
      canProceed = true;
      
      // Create a mock bank account for testing
      try {
        const mockBankAccount = await createExternalBankAccount({
          customerId: senderCustomerId,
          accountNumber: "1234567890",
          routingNumber: "021000021",
          bankName: "Test Bank",
          bankAccountCurrency: "USD",
          bankAccountType: "CHECKING",
          bankAccountPaymentMethod: "ACH",
          ownerEmail: actualSenderEmail,
          ownerFirstName: "Test",
          ownerLastName: "User",
        });
        fiatAccountId = mockBankAccount.paymentAccountId;
        console.log("✅ Mock bank account created for testing:", fiatAccountId);
      } catch (error) {
        console.log("⚠️ Could not create mock bank account:", error);
        // Still proceed with testing
        canProceed = true;
      }
    } else {
      // Try to create a bank account for the customer
      try {
        // For Builder plan, we need to create an external bank account
        // This requires the user to provide their bank details
        console.log("ℹ️ Customer is KYC verified. Need to collect bank account details.");
        
        // In a real implementation, you would:
        // 1. Show a form to collect bank account details
        // 2. Create the EXTERNAL_BANK_ACCOUNT with those details
        // 3. Then proceed with quote creation
        
        needsBankDetails = true;
        canProceed = false;
      } catch (error) {
        console.log("⚠️ Could not create bank account:", error);
        needsBankDetails = true;
        canProceed = false;
      }
    }
  } else {
    // Customer needs KYC verification
    needsKyc = true;
    canProceed = false;
  }

  // If we can proceed (testing mode), create the quote and transaction
  let transaction = null;
  if (canProceed && fiatAccountId && agentCryptoAccountId) {
    try {
      console.log("🧪 TESTING MODE: Creating quote and transaction");
      
      // Create quote: USD (ACH) -> USDC (chain) to agent wallet
      const quote = await createQuote({
        customerId: senderCustomerId,
        sourcePaymentAccountId: fiatAccountId,
        sourceCurrency: "USD",
        sourcePaymentMethod: params.fiatMethod ?? "ACH",
        sourceAmount: params.amountUsd,
        destinationPaymentAccountId: agentCryptoAccountId,
        destinationPaymentMethod: chain,
        destinationCurrency: "USDC",
      });

      // Create transaction
      transaction = await createTransaction(quote.quoteId, `plan:${params.plan.planId}`);
      console.log("✅ Quote and transaction created for testing:", transaction.transactionId);
    } catch (error) {
      console.log("⚠️ Could not create quote/transaction:", error);
    }
  }

  return {
    kyc: { 
      customerId: senderCustomerId,
      kycLink: kycLink,
      customerStatus: customerStatus,
      needsKyc: needsKyc
    },
    funding: {
      bankAccountFormLink: bankAccountFormLink,
      transferInstructions: transaction?.transferInstructions || null,
      paymentAccountId: fiatAccountId,
      agentAccountId: agentCryptoAccountId,
      canProceed: canProceed,
      needsBankDetails: needsBankDetails,
      nextSteps: needsKyc ? 
        "Complete KYC verification using the provided link" : 
        needsBankDetails ? 
        "Provide bank account details to proceed with funding" :
        canProceed ? 
        "Ready to proceed with funding (testing mode)" :
        "Ready to create funding quote"
    },
    transaction: transaction,
    plan: {
      planId: params.plan.planId,
      amountUsd: params.amountUsd,
      chain: chain,
      agentAddress: agentAddress,
    }
  };
}

/**
 * Builder Plan KYC Helper
 * Focuses only on customer creation and KYC verification.
 * This is what the Builder plan actually supports.
 */
export async function startBuilderPlanKyc(params: {
  senderEmail: string;
  firstName?: string;
  lastName?: string;
}) {
  // 1) Ensure Sender as Fern customer
  const { customerId: senderCustomerId } = await ensureFernCustomer({
    email: params.senderEmail,
    customerType: "INDIVIDUAL",
    firstName: params.firstName ?? "User",
    lastName: params.lastName ?? "Test",
  });

  // 2) Get customer details to check KYC status and get KYC link
  let kycLink: string | undefined;
  let customerStatus: string = "UNKNOWN";
  
  // Check if we should bypass KYC for testing
  if (TESTING_CONFIG.BYPASS_KYC) {
    console.log("🧪 TESTING MODE: Bypassing KYC verification");
    customerStatus = TESTING_CONFIG.MOCK_KYC_STATUS;
    kycLink = undefined;
  } else {
    try {
      const customerDetails = await fernFetch<{ 
        customerId: string; 
        customerStatus: string; 
        kycLink?: string;
        email: string;
        name: string;
      }>(`/customers/${senderCustomerId}`, { method: "GET" });
      
      kycLink = customerDetails.kycLink;
      customerStatus = customerDetails.customerStatus;
      console.log("Customer details:", customerDetails);
    } catch (error) {
      console.log("Could not fetch customer details:", error);
    }
  }

  return {
    customerId: senderCustomerId,
    customerStatus: customerStatus,
    kycLink: kycLink,
    needsKyc: customerStatus !== "ACTIVE" && !kycLink,
    email: params.senderEmail,
    name: `${params.firstName ?? "User"} ${params.lastName ?? "Test"}`,
  };
}

/**
 * OFFRAMP (User's wallet → Fiat)
 *
 * The user wants to cash out USDC from their wallet to their bank account.
 * This is NOT the agent wallet - it's the user's own wallet.
 *
 * Flow: User's Wallet (USDC) → Fern → User's Bank Account (fiat)
 */
export async function startOfframpFromUserWallet(params: {
  userEmail?: string; // Optional - will use Dynamic auth or fallback
  userWalletAddress: string; // User's wallet address (from Dynamic or connected wallet)
  userWalletChain: Chain; // Chain of user's wallet
  amountUsd: string; // Amount in USD terms
  fiatMethod?: PaymentMethodFiat; // ACH default
  dynamicUserEmail?: string | null; // Email from Dynamic auth
}) {
  // Use provided user email or get from Dynamic auth/fallback
  const actualUserEmail = params.userEmail || getUserEmail(params.dynamicUserEmail);
  
  const { customerId: userCustomerId } = await ensureFernCustomer({
    email: actualUserEmail,
    customerType: "INDIVIDUAL",
  });

  // 1) Ensure fiat payout account (user's bank account)
  const fiatAccCached = memory.fernFiatAccountIdByEmail.get(actualUserEmail);
  let userFiatPaymentAccountId = fiatAccCached;
  if (!userFiatPaymentAccountId) {
    const resp = await createFernFiatAccount({
      customerId: userCustomerId,
      bankAccountCurrency: "USD",
      nickname: "User Bank Account (USD)",
    });
    userFiatPaymentAccountId = resp.paymentAccountId;
    memory.fernFiatAccountIdByEmail.set(actualUserEmail, userFiatPaymentAccountId);
  }

  // 2) Create external crypto wallet for user's wallet
  const { paymentAccountId: userWalletAccountId } = await createExternalCryptoWalletPaymentAccount({
    customerId: userCustomerId,
    chain: params.userWalletChain,
    address: params.userWalletAddress,
    nickname: `User Wallet (${params.userWalletChain})`,
    isThirdParty: false, // This is the user's own wallet
  });

  // 3) Create quote: USDC (user's wallet) -> USD (user's bank account)
  const quote = await createQuote({
    customerId: userCustomerId,
    sourcePaymentAccountId: userWalletAccountId,
    sourceCurrency: "USDC",
    sourcePaymentMethod: params.userWalletChain,
    sourceAmount: params.amountUsd,
    destinationPaymentAccountId: userFiatPaymentAccountId!,
    destinationPaymentMethod: params.fiatMethod ?? "ACH",
    destinationCurrency: "USD",
  });

  // 4) Create transaction (returns deposit instructions for the USDC)
  const tx = await createTransaction(quote.quoteId, `user-offramp:${actualUserEmail}`);

  return {
    kyc: { customerId: userCustomerId },
    payout: {
      bankAccountFormLink: undefined, // you can GET payment account to read form link if needed
    },
    funding: {
      // User needs to send USDC from their wallet to Fern's deposit address
      cryptoDepositInstructions: tx.transferInstructions, // expect type: "crypto", with chain+address
    },
    transaction: tx,
  };
}

/**
 * Create bank account for customer after KYC verification (Builder Plan)
 */
export async function createBankAccountForCustomer(params: {
  customerId: string;
  accountNumber: string;
  routingNumber: string;
  bankName: string;
  bankAccountCurrency?: "USD";
  bankAccountType?: "CHECKING" | "SAVINGS";
  bankAccountPaymentMethod?: "ACH" | "WIRE";
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
}) {
  try {
    const bankAccount = await createExternalBankAccount({
      customerId: params.customerId,
      accountNumber: params.accountNumber,
      routingNumber: params.routingNumber,
      bankName: params.bankName,
      bankAccountCurrency: params.bankAccountCurrency ?? "USD",
      bankAccountType: params.bankAccountType ?? "CHECKING",
      bankAccountPaymentMethod: params.bankAccountPaymentMethod ?? "ACH",
      ownerEmail: params.ownerEmail,
      ownerFirstName: params.ownerFirstName,
      ownerLastName: params.ownerLastName,
    });

    return {
      success: true,
      paymentAccountId: bankAccount.paymentAccountId,
      message: "Bank account created successfully"
    };
  } catch (error) {
    console.error("Failed to create bank account:", error);
    throw new Error(`Failed to create bank account: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Complete onramp after bank account is set up (Builder Plan)
 */
export async function completeOnrampAfterBankSetup(params: {
  plan: Plan;
  senderEmail: string;
  amountUsd: string;
  bankAccountId: string;
  agentCryptoAccountId: string;
  fiatMethod?: PaymentMethodFiat;
}) {
  try {
    // Create quote: USD (ACH) -> USDC (chain) to agent wallet
    const quote = await createQuote({
      customerId: params.plan.sender?.email ? 
        (await ensureFernCustomer({ email: params.plan.sender.email })).customerId : 
        (await ensureFernCustomer({ email: params.senderEmail })).customerId,
      sourcePaymentAccountId: params.bankAccountId,
      sourceCurrency: "USD",
      sourcePaymentMethod: params.fiatMethod ?? "ACH",
      sourceAmount: params.amountUsd,
      destinationPaymentAccountId: params.agentCryptoAccountId,
      destinationPaymentMethod: params.plan.agentWallet.chain,
      destinationCurrency: "USDC",
    });

    // Create transaction
    const transaction = await createTransaction(quote.quoteId, `plan:${params.plan.planId}`);

    return {
      success: true,
      quote,
      transaction,
      transferInstructions: transaction.transferInstructions,
      message: "Onramp quote and transaction created successfully"
    };
  } catch (error) {
    console.error("Failed to complete onramp:", error);
    throw new Error(`Failed to complete onramp: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ------------ Integration Helpers for Payment Plan Flow ------------

/**
 * Create a plan for the Fern integration based on parsed payment plan data
 */
export function createPlanFromParsedData(params: {
  planId: string;
  parsedPlan: {
    title: string;
    totalAmount: number;
    amountPerTransaction: number;
    numberOfTransactions: number;
    frequency: number;
    startTimeOffset: number;
    endTimeOffset: number;
  };
  senderEmail?: string; // Optional - will use Dynamic auth or fallback
  receiverEmail?: string; // Optional - will use Dynamic auth or fallback
  agentChain: Chain;
  agentWalletAddress?: string; // Optional - will be generated by teammate
  receiverChosenChain: Chain;
  autoCashOut?: boolean;
  dynamicUserEmail?: string | null; // Email from Dynamic auth
}): Plan {
  // Use provided emails or get from Dynamic auth/fallback
  const actualSenderEmail = params.senderEmail || getUserEmail(params.dynamicUserEmail);
  const actualReceiverEmail = params.receiverEmail || getUserEmail(params.dynamicUserEmail);
  
  // TODO: Agent wallet should be generated programmatically by Dynamic
  // This will be implemented by teammate
  const agentWalletAddress = params.agentWalletAddress || generateAgentWalletSkeleton(params.planId, params.agentChain);
  
  return {
    planId: params.planId,
    agentWallet: {
      chain: params.agentChain,
      address: agentWalletAddress,
    },
    sender: {
      email: actualSenderEmail,
    },
    receiver: {
      email: actualReceiverEmail,
      chosenDestChain: params.receiverChosenChain,
      autoCashOut: params.autoCashOut ?? false,
    },
    amountUsd: params.parsedPlan.totalAmount.toString(),
  };
}

/**
 * Skeleton function for agent wallet generation
 * TODO: This will be implemented by teammate using Dynamic
 */
function generateAgentWalletSkeleton(planId: string, chain: Chain): string {
  // TODO: Replace with actual Dynamic wallet generation
  // const agentWallet = await dynamic.createWallet({
  //   environment: "sandbox",
  //   walletName: `Agent-${planId}`,
  //   walletType: "evm"
  // });
  // return agentWallet.address;
  
  // Temporary placeholder - will be replaced by teammate
  console.log(`TODO: Generate agent wallet for plan ${planId} on chain ${chain}`);
  return `0xAGENT_WALLET_PLACEHOLDER_${planId}`;
}

/**
 * Check if a chain is supported by CCTP v2 Fast
 */
export function isCCTPFastSupported(chain: Chain): boolean {
  const supportedChains: Chain[] = [
    "ETHEREUM",
    "BASE", 
    "ARBITRUM",
    "POLYGON",
    "AVALANCHE",
    "OPTIMISM"
  ];
  return supportedChains.includes(chain);
}

/**
 * Get supported chains for CCTP v2 Fast
 */
export function getCCTPFastSupportedChains(): Chain[] {
  return [
    "ETHEREUM",
    "BASE", 
    "ARBITRUM", 
    "POLYGON",
    "AVALANCHE",
    "OPTIMISM"
  ];
}

/**
 * Validate chain compatibility for the payment plan flow
 */
export function validateChainCompatibility(params: {
  senderSourceChain?: Chain;
  receiverDestChain: Chain;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if receiver's chosen chain is CCTP supported
  if (!isCCTPFastSupported(params.receiverDestChain)) {
    errors.push(`Receiver's chosen chain (${params.receiverDestChain}) is not supported by CCTP v2 Fast`);
  }
  
  // Check if sender's source chain is CCTP supported (if specified)
  if (params.senderSourceChain && !isCCTPFastSupported(params.senderSourceChain)) {
    errors.push(`Sender's source chain (${params.senderSourceChain}) is not supported by CCTP v2 Fast`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Enhanced onramp function specifically for the payment plan flow
 */
export async function startOnrampForPaymentPlan(params: {
  plan: Plan;
  senderEmail?: string; // Optional - will use plan.sender.email or fallback
  amountUsd: string;
  fiatMethod?: PaymentMethodFiat;
  agentChain?: Chain;
  agentWalletAddress?: string;
  // Additional validation
  validateChains?: boolean;
  dynamicUserEmail?: string | null; // Email from Dynamic auth
}) {
  // Validate chains if requested
  if (params.validateChains) {
    const validation = validateChainCompatibility({
      senderSourceChain: params.plan.sender?.chosenSourceChain,
      receiverDestChain: params.plan.receiver?.chosenDestChain!,
    });
    
    if (!validation.valid) {
      throw new Error(`Chain validation failed: ${validation.errors.join(', ')}`);
    }
  }

  return startOnrampToAgent({
    plan: params.plan,
    senderEmail: params.senderEmail,
    amountUsd: params.amountUsd,
    fiatMethod: params.fiatMethod,
    agentChain: params.agentChain,
    agentWalletAddress: params.agentWalletAddress,
    dynamicUserEmail: params.dynamicUserEmail,
  });
}

/**
 * Enhanced offramp function specifically for the payment plan flow
 */
export async function startOfframpForPaymentPlan(params: {
  plan: Plan;
  receiverEmail?: string; // Optional - will use plan.receiver.email or fallback
  amountUsd: string;
  chosenChain: Chain;
  autoCashOut: boolean;
  receiverExternalWalletAddress?: string;
  fiatMethod?: PaymentMethodFiat;
  // Additional validation
  validateChains?: boolean;
  dynamicUserEmail?: string | null; // Email from Dynamic auth
}) {
  // Validate chains if requested
  if (params.validateChains) {
    const validation = validateChainCompatibility({
      receiverDestChain: params.chosenChain,
    });
    
    if (!validation.valid) {
      throw new Error(`Chain validation failed: ${validation.errors.join(', ')}`);
    }
  }

  // This function is now replaced by startOfframpFromUserWallet
  // The old flow was incorrect - offramp should be from user's wallet to fiat
  throw new Error("startOfframpFromReceiver is deprecated. Use startOfframpFromUserWallet instead.");
}

/**
 * Get plan status from memory store
 */
export function getPlan(planId: PlanId): Plan | undefined {
  return memory.plans.get(planId);
}

/**
 * Update plan in memory store
 */
export function updatePlan(planId: PlanId, updates: Partial<Plan>): void {
  const existingPlan = memory.plans.get(planId);
  if (existingPlan) {
    memory.plans.set(planId, { ...existingPlan, ...updates });
  }
}

/**
 * List all plans in memory store
 */
export function listPlans(): Plan[] {
  return Array.from(memory.plans.values());
}

/**
 * Clear all plans from memory store (useful for testing)
 */
export function clearPlans(): void {
  memory.plans.clear();
  memory.fernCustomerIdByEmail.clear();
  memory.fernCryptoAccountIdByEmailAndChain.clear();
  memory.fernFiatAccountIdByEmail.clear();
}

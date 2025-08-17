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

export const memory = {
  plans: new Map<PlanId, Plan>(),
  // cache Fern ids by email (hackathon-local)
  fernCustomerIdByEmail: new Map<string, string>(),
  // per email we may want a default Fern crypto wallet or bank account ids
  fernCryptoAccountIdByEmailAndChain: new Map<string, string>(), // key `${email}:${chain}`
  fernFiatAccountIdByEmail: new Map<string, string>(), // any bank account
};

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

  // Create minimal customer (hosted KYC link returned)
  const body = {
    customerType: params.customerType ?? "INDIVIDUAL",
    firstName: params.firstName ?? "Hack",
    lastName: params.lastName ?? "User",
    businessName: params.businessName,
    email,
  };
  const created = await fernFetch<{ customerId: string; kycLink?: string }>(
    `/customers`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  memory.fernCustomerIdByEmail.set(email, created.customerId);
  return { customerId: created.customerId };
}

// ------------ Payment Accounts ------------
export async function createExternalCryptoWalletPaymentAccount(params: {
  customerId: string;
  chain: Chain;
  address: string;
  nickname?: string;
  isThirdParty?: boolean;
}) {
  const payload = {
    paymentAccountType: "EXTERNAL_CRYPTO_WALLET",
    customerId: params.customerId,
    nickname: params.nickname ?? `Wallet ${params.chain}`,
    organizationId: FERN_ORG_ID,
    externalCryptoWallet: {
      cryptoWalletType: "EVM",
      chain: params.chain,
      address: params.address,
    },
    isThirdParty: params.isThirdParty ?? false,
  };
  return fernFetch<{ paymentAccountId: string }>(`/payment-accounts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createFernCryptoWalletPaymentAccount(params: {
  customerId: string;
  chain: Chain;
  nickname?: string;
}) {
  const payload = {
    paymentAccountType: "FERN_CRYPTO_WALLET",
    customerId: params.customerId,
    nickname: params.nickname ?? `Fern Wallet ${params.chain}`,
    organizationId: FERN_ORG_ID,
    fernCryptoWallet: { cryptoWalletType: "EVM" },
  };
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
  const payload = {
    paymentAccountType: "FERN_AUTO_FIAT_ACCOUNT",
    customerId: params.customerId,
    nickname: params.nickname ?? "Auto Onramp to Crypto",
    organizationId: FERN_ORG_ID,
    fernAutoFiatAccount: {
      bankAccountCurrency: params.bankAccountCurrency ?? "USD",
      destinationPaymentAccountId: params.destinationPaymentAccountId,
      destinationCurrency: params.destinationCurrency ?? "USDC",
    },
  };
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
  const payload = {
    paymentAccountType: "FERN_FIAT_ACCOUNT",
    customerId: params.customerId,
    nickname: params.nickname ?? "Fiat Payout (USD)",
    organizationId: FERN_ORG_ID,
    fernFiatAccount: { bankAccountCurrency: params.bankAccountCurrency ?? "USD" },
  };
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
  const payload = {
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
    developerFee: p.developerFeeAmountUsd
      ? { developerFeeType: "USD", developerFeeAmount: p.developerFeeAmountUsd }
      : undefined,
  };
  return fernFetch<{ quoteId: string; expiresAt: string; destinationAmount: string }>(
    `/quotes`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function createTransaction(quoteId: string, correlationId?: string) {
  const payload = { quoteId, correlationId };
  return fernFetch<{
    transactionId: string;
    transactionStatus: string;
    transferInstructions?: any;
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
 * ONRAMP (default Option 1)
 * Sender fiat -> USDC -> Agent Wallet.
 */
export async function startOnrampToAgent(params: {
  plan: Plan;
  senderEmail: string;
  amountUsd: string;
  fiatMethod?: PaymentMethodFiat; // default ACH
  agentChain?: Chain; // overrides plan.agentWallet.chain for quote's destinationPaymentMethod
  agentWalletAddress?: string; // overrides plan.agentWallet.address if provided
}) {
  const chain = params.agentChain ?? params.plan.agentWallet.chain;
  const agentAddress = params.agentWalletAddress ?? params.plan.agentWallet.address;

  // 1) Ensure Sender as Fern customer
  const { customerId: senderCustomerId } = await ensureFernCustomer({
    email: params.senderEmail,
    customerType: "INDIVIDUAL",
  });

  // 2) Create a payment account for the Agent wallet (external crypto)
  const { paymentAccountId: agentCryptoAccountId } =
    await createExternalCryptoWalletPaymentAccount({
      customerId: senderCustomerId,
      chain,
      address: agentAddress,
      nickname: `Agent Wallet (${chain})`,
      isThirdParty: true, // agent is a third party from sender's POV
    });

  // 3) Create an Auto Fiat account for the sender. This returns bank info to fund.
  const autoFiat = await createFernAutoFiatAccount({
    customerId: senderCustomerId,
    destinationPaymentAccountId: agentCryptoAccountId,
    destinationCurrency: "USDC",
  });

  // 4) Create quote: USD (ACH) -> USDC (chain) to agent wallet
  const quote = await createQuote({
    customerId: senderCustomerId,
    sourcePaymentAccountId: autoFiat.paymentAccountId,
    sourceCurrency: "USD",
    sourcePaymentMethod: params.fiatMethod ?? "ACH",
    sourceAmount: params.amountUsd,
    destinationPaymentAccountId: agentCryptoAccountId,
    destinationPaymentMethod: chain,
    destinationCurrency: "USDC",
  });

  // 5) Create transaction
  const tx = await createTransaction(quote.quoteId, `plan:${params.plan.planId}`);

  return {
    kyc: { customerId: senderCustomerId }, // you can GET /customers to read kycLink if you want to show it
    funding: {
      bankAccountFormLink: (autoFiat as any).bankAccountFormLink, // show on UI if present
      transferInstructions: tx.transferInstructions, // send to UI; contains bank details (ACH/Wire)
    },
    transaction: tx,
  };
}

/**
 * OFFRAMP (Receiver gets fiat)
 *
 * Two modes:
 *  - autoCashOut=true: We create a Fern crypto wallet (receiver) and a Fern fiat account (receiver).
 *    We make a quote from Fern crypto wallet (USDC on chosen chain) -> bank (USD).
 *    The transaction returns a deposit address; your Agent should CCTP/transfer USDC to that address.
 *
 *  - autoCashOut=false: Source is the receiver's **external** wallet (address you already know).
 *    We create a quote from external wallet (USDC on chosen chain) -> bank (USD).
 *    The transaction returns a deposit address; the **receiver** sends USDC there after they receive funds.
 */
export async function startOfframpFromReceiver(params: {
  plan: Plan;
  receiverEmail: string;
  amountUsd: string;
  chosenChain: Chain;
  autoCashOut: boolean;
  // only needed when autoCashOut=false
  receiverExternalWalletAddress?: string;
  fiatMethod?: PaymentMethodFiat; // ACH default
}) {
  const { customerId: receiverCustomerId } = await ensureFernCustomer({
    email: params.receiverEmail,
    customerType: "INDIVIDUAL",
  });

  // 1) Ensure fiat payout account (Fern-managed bank account container)
  const fiatAccCached = memory.fernFiatAccountIdByEmail.get(params.receiverEmail);
  let receiverFiatPaymentAccountId = fiatAccCached;
  if (!receiverFiatPaymentAccountId) {
    const resp = await createFernFiatAccount({
      customerId: receiverCustomerId,
      bankAccountCurrency: "USD",
      nickname: "Receiver Bank (USD)",
    });
    receiverFiatPaymentAccountId = resp.paymentAccountId;
    memory.fernFiatAccountIdByEmail.set(params.receiverEmail, receiverFiatPaymentAccountId);
  }

  // 2) Decide crypto source account
  let sourcePaymentAccountId: string;
  let sourceMethod: PaymentMethodChain = params.chosenChain;

  if (params.autoCashOut) {
    // Use Fern crypto wallet so the Agent can fund it programmatically
    const key = `${params.receiverEmail}:${params.chosenChain}`;
    let fernCryptoId = memory.fernCryptoAccountIdByEmailAndChain.get(key);
    if (!fernCryptoId) {
      const created = await createFernCryptoWalletPaymentAccount({
        customerId: receiverCustomerId,
        chain: params.chosenChain,
        nickname: `Fern Wallet (${params.chosenChain})`,
      });
      fernCryptoId = created.paymentAccountId;
      memory.fernCryptoAccountIdByEmailAndChain.set(key, fernCryptoId);
    }
    sourcePaymentAccountId = fernCryptoId;
  } else {
    // Use the receiver's external wallet (they will send to Fern's deposit address)
    if (!params.receiverExternalWalletAddress) {
      throw new Error("receiverExternalWalletAddress is required when autoCashOut=false");
    }
    const { paymentAccountId } = await createExternalCryptoWalletPaymentAccount({
      customerId: receiverCustomerId,
      chain: params.chosenChain,
      address: params.receiverExternalWalletAddress,
      nickname: `Receiver Wallet (${params.chosenChain})`,
      isThirdParty: false,
    });
    sourcePaymentAccountId = paymentAccountId;
  }

  // 3) Create quote: USDC (chain) -> USD (ACH) to receiver bank
  const quote = await createQuote({
    customerId: receiverCustomerId,
    sourcePaymentAccountId,
    sourceCurrency: "USDC",
    sourcePaymentMethod: sourceMethod,
    sourceAmount: params.amountUsd, // off-ramp amount in USD terms; Fern prices the USDC
    destinationPaymentAccountId: receiverFiatPaymentAccountId!,
    destinationPaymentMethod: params.fiatMethod ?? "ACH",
    destinationCurrency: "USD",
  });

  // 4) Create transaction (returns deposit instructions for the USDC to fund the off-ramp)
  const tx = await createTransaction(quote.quoteId, `plan:${params.plan.planId}`);

  return {
    kyc: { customerId: receiverCustomerId },
    payout: {
      bankAccountFormLink: undefined, // you can GET payment account to read form link if needed
    },
    funding: {
      // For off-ramp, funding means sending USDC to Fern's deposit address:
      // - If autoCashOut=true: your Agent should send the USDC here (CCTP or direct transfer).
      // - Otherwise, show this to the receiver so they can send USDC from their wallet.
      cryptoDepositInstructions: tx.transferInstructions, // expect type: "crypto", with chain+address
    },
    transaction: tx,
  };
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
  senderEmail: string;
  receiverEmail: string;
  agentChain: Chain;
  agentWalletAddress: string;
  receiverChosenChain: Chain;
  autoCashOut?: boolean;
}): Plan {
  return {
    planId: params.planId,
    agentWallet: {
      chain: params.agentChain,
      address: params.agentWalletAddress,
    },
    sender: {
      email: params.senderEmail,
    },
    receiver: {
      email: params.receiverEmail,
      chosenDestChain: params.receiverChosenChain,
      autoCashOut: params.autoCashOut ?? false,
    },
    amountUsd: params.parsedPlan.totalAmount.toString(),
  };
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
  senderEmail: string;
  amountUsd: string;
  fiatMethod?: PaymentMethodFiat;
  agentChain?: Chain;
  agentWalletAddress?: string;
  // Additional validation
  validateChains?: boolean;
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
  });
}

/**
 * Enhanced offramp function specifically for the payment plan flow
 */
export async function startOfframpForPaymentPlan(params: {
  plan: Plan;
  receiverEmail: string;
  amountUsd: string;
  chosenChain: Chain;
  autoCashOut: boolean;
  receiverExternalWalletAddress?: string;
  fiatMethod?: PaymentMethodFiat;
  // Additional validation
  validateChains?: boolean;
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

  return startOfframpFromReceiver({
    plan: params.plan,
    receiverEmail: params.receiverEmail,
    amountUsd: params.amountUsd,
    chosenChain: params.chosenChain,
    autoCashOut: params.autoCashOut,
    receiverExternalWalletAddress: params.receiverExternalWalletAddress,
    fiatMethod: params.fiatMethod,
  });
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

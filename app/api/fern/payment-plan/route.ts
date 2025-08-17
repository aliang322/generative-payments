import { NextRequest, NextResponse } from "next/server";
import {
  memory,
  createPlanFromParsedData,
  startOnrampForPaymentPlan,
  startOfframpForPaymentPlan,
  validateChainCompatibility,
  getCCTPFastSupportedChains,
  type Plan,
  type Chain,
} from "@/lib/fern";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "create_plan":
        return await handleCreatePlan(params);
      
      case "start_onramp":
        return await handleStartOnramp(params);
      
      case "start_offramp":
        return await handleStartOfframp(params);
      
      case "validate_chains":
        return await handleValidateChains(params);
      
      case "get_supported_chains":
        return await handleGetSupportedChains();
      
      case "get_plan":
        return await handleGetPlan(params);
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Payment plan API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function handleCreatePlan(params: {
  planId: string;
  parsedPlan: any;
  senderEmail: string;
  receiverEmail: string;
  agentChain: Chain;
  agentWalletAddress: string;
  receiverChosenChain: Chain;
  autoCashOut?: boolean;
}) {
  const plan = createPlanFromParsedData(params);
  memory.plans.set(plan.planId, plan);
  
  return NextResponse.json({
    success: true,
    plan,
    message: "Plan created successfully"
  });
}

async function handleStartOnramp(params: {
  planId: string;
  senderEmail: string;
  amountUsd: string;
  fiatMethod?: "ACH" | "WIRE";
  agentChain?: Chain;
  agentWalletAddress?: string;
  validateChains?: boolean;
}) {
  const plan = memory.plans.get(params.planId);
  if (!plan) {
    return NextResponse.json(
      { error: "Plan not found" },
      { status: 404 }
    );
  }

  const result = await startOnrampForPaymentPlan({
    plan,
    senderEmail: params.senderEmail,
    amountUsd: params.amountUsd,
    fiatMethod: params.fiatMethod,
    agentChain: params.agentChain,
    agentWalletAddress: params.agentWalletAddress,
    validateChains: params.validateChains,
  });

  return NextResponse.json({
    success: true,
    result,
    message: "On-ramp started successfully"
  });
}

async function handleStartOfframp(params: {
  planId: string;
  receiverEmail: string;
  amountUsd: string;
  chosenChain: Chain;
  autoCashOut: boolean;
  receiverExternalWalletAddress?: string;
  fiatMethod?: "ACH" | "WIRE";
  validateChains?: boolean;
}) {
  const plan = memory.plans.get(params.planId);
  if (!plan) {
    return NextResponse.json(
      { error: "Plan not found" },
      { status: 404 }
    );
  }

  const result = await startOfframpForPaymentPlan({
    plan,
    receiverEmail: params.receiverEmail,
    amountUsd: params.amountUsd,
    chosenChain: params.chosenChain,
    autoCashOut: params.autoCashOut,
    receiverExternalWalletAddress: params.receiverExternalWalletAddress,
    fiatMethod: params.fiatMethod,
    validateChains: params.validateChains,
  });

  return NextResponse.json({
    success: true,
    result,
    message: "Off-ramp started successfully"
  });
}

function handleValidateChains(params: {
  senderSourceChain?: Chain;
  receiverDestChain: Chain;
}) {
  const validation = validateChainCompatibility(params);
  
  return NextResponse.json({
    success: true,
    validation,
    message: validation.valid ? "Chains are compatible" : "Chain compatibility issues found"
  });
}

function handleGetSupportedChains() {
  const supportedChains = getCCTPFastSupportedChains();
  
  return NextResponse.json({
    success: true,
    supportedChains,
    message: "CCTP v2 Fast supported chains retrieved"
  });
}

function handleGetPlan(params: { planId: string }) {
  const plan = memory.plans.get(params.planId);
  
  if (!plan) {
    return NextResponse.json(
      { error: "Plan not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    plan,
    message: "Plan retrieved successfully"
  });
}

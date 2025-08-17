import { NextRequest, NextResponse } from "next/server";
import { completeOnrampAfterBankSetup, memory } from "@/lib/fern";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const { 
      planId,
      senderEmail,
      amountUsd,
      bankAccountId,
      agentCryptoAccountId,
      fiatMethod = "ACH"
    } = body;
    
    if (!planId || !senderEmail || !amountUsd || !bankAccountId || !agentCryptoAccountId) {
      return NextResponse.json(
        { error: "Missing required fields: planId, senderEmail, amountUsd, bankAccountId, agentCryptoAccountId" },
        { status: 400 }
      );
    }

    // Get the plan from memory
    const plan = memory.plans.get(planId);
    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    const result = await completeOnrampAfterBankSetup({
      plan,
      senderEmail,
      amountUsd,
      bankAccountId,
      agentCryptoAccountId,
      fiatMethod,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Complete onramp error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

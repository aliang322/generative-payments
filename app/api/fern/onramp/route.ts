import { NextRequest, NextResponse } from "next/server";
import {
  memory,
  startOnrampToAgent,
  type Plan,
  type Chain,
} from "@/lib/fern";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const plan: Plan = {
      planId: body.planId,
      agentWallet: {
        chain: body.agentChain as Chain, // e.g. "BASE"
        address: body.agentWalletAddress, // EVM address (from Dynamic server wallet)
      },
      amountUsd: body.amountUsd,
    };
    memory.plans.set(plan.planId, plan);

    const resp = await startOnrampToAgent({
      plan,
      senderEmail: body.senderEmail, // e.g., from Dynamic session
      amountUsd: body.amountUsd,
    });

    return NextResponse.json(resp);
  } catch (error) {
    console.error("Onramp error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

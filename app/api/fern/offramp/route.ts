import { NextRequest, NextResponse } from "next/server";
import {
  memory,
  startOfframpFromReceiver,
  type Plan,
  type Chain,
} from "@/lib/fern";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // The plan is presumed to exist / be created by your earlier flow.
    const plan: Plan =
      memory.plans.get(body.planId) ??
      ({
        planId: body.planId,
        agentWallet: { chain: body.agentChain as Chain, address: body.agentWalletAddress },
        amountUsd: body.amountUsd,
      } as Plan);

    const resp = await startOfframpFromReceiver({
      plan,
      receiverEmail: body.receiverEmail,
      amountUsd: body.amountUsd,
      chosenChain: body.chosenChain as Chain, // receiver-picked chain; must be CCTP-supported elsewhere in your flow
      autoCashOut: !!body.autoCashOut,
      receiverExternalWalletAddress: body.receiverExternalWalletAddress, // required if autoCashOut=false
    });

    return NextResponse.json(resp);
  } catch (error) {
    console.error("Offramp error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

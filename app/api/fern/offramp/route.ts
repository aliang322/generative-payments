import { NextRequest, NextResponse } from "next/server";
import {
  memory,
  startOfframpFromUserWallet,
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

    const resp = await startOfframpFromUserWallet({
      userEmail: body.receiverEmail,
      userWalletAddress: body.receiverExternalWalletAddress,
      userWalletChain: body.chosenChain as Chain,
      amountUsd: body.amountUsd,
      fiatMethod: "ACH",
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

import { NextRequest, NextResponse } from "next/server";
import { startBuilderPlanKyc } from "@/lib/fern";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const { senderEmail, firstName, lastName } = body;
    
    if (!senderEmail) {
      return NextResponse.json(
        { error: "senderEmail is required" },
        { status: 400 }
      );
    }

    const kycResult = await startBuilderPlanKyc({
      senderEmail,
      firstName,
      lastName,
    });

    return NextResponse.json(kycResult);
  } catch (error) {
    console.error("KYC error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

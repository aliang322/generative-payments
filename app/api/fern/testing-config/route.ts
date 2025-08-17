import { NextRequest, NextResponse } from "next/server";
import { getTestingConfig } from "@/lib/fern";

export async function GET(req: NextRequest) {
  try {
    const config = getTestingConfig();
    
    return NextResponse.json({
      success: true,
      testingConfig: config,
      message: "Testing configuration retrieved successfully"
    });
  } catch (error) {
    console.error("Testing config API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

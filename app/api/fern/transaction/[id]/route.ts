import { NextRequest, NextResponse } from "next/server";
import { getTransaction } from "@/lib/fern";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tx = await getTransaction(params.id);
    return NextResponse.json(tx);
  } catch (error) {
    console.error("Transaction status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

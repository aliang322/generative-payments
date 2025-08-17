import { NextRequest, NextResponse } from "next/server";
import { clearCustomerCache } from "@/lib/fern";

export async function POST(req: NextRequest) {
  try {
    clearCustomerCache();
    return NextResponse.json({ message: "Customer cache cleared successfully" });
  } catch (error) {
    console.error("Error clearing cache:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

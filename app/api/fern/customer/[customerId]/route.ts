import { NextRequest, NextResponse } from "next/server";
import { fernFetch } from "@/lib/fern";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    
    const customerDetails = await fernFetch<{ 
      customerId: string; 
      customerStatus: string; 
      kycLink?: string;
      email: string;
      name: string;
    }>(`/customers/${customerId}`, { method: "GET" });
    
    return NextResponse.json(customerDetails);
  } catch (error) {
    console.error("Error fetching customer details:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

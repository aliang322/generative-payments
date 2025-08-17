import { NextRequest, NextResponse } from "next/server";
import { fernFetch } from "@/lib/fern";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customer = await fernFetch<{
      customerId: string;
      customerStatus: string;
      kycLink?: string;
      email: string;
      customerType: string;
    }>(`/customers/${params.id}`, { method: "GET" });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Customer fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

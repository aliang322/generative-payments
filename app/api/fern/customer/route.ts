import { NextRequest, NextResponse } from "next/server";
import { ensureFernCustomer } from "@/lib/fern";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const { 
      email, 
      customerType = "INDIVIDUAL",
      firstName,
      lastName,
      businessName,
      kycData,
      kybData 
    } = body;
    
    if (!email) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    // Use the existing ensureFernCustomer function which handles:
    // 1. Checking for existing customers
    // 2. Creating new customers if needed
    // 3. Returning customer ID and KYC link
    const result = await ensureFernCustomer({
      email,
      customerType,
      firstName,
      lastName,
      businessName,
    });

    return NextResponse.json({
      success: true,
      customerId: result.customerId,
      message: "Customer created/retrieved successfully"
    });
  } catch (error) {
    console.error("Customer creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

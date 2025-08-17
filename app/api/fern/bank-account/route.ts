import { NextRequest, NextResponse } from "next/server";
import { createBankAccountForCustomer } from "@/lib/fern";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const { 
      customerId,
      accountNumber,
      routingNumber,
      bankName,
      bankAccountCurrency = "USD",
      bankAccountType = "CHECKING",
      bankAccountPaymentMethod = "ACH",
      ownerEmail,
      ownerFirstName,
      ownerLastName
    } = body;
    
    if (!customerId || !accountNumber || !routingNumber || !bankName || !ownerEmail || !ownerFirstName || !ownerLastName) {
      return NextResponse.json(
        { error: "Missing required fields: customerId, accountNumber, routingNumber, bankName, ownerEmail, ownerFirstName, ownerLastName" },
        { status: 400 }
      );
    }

    const result = await createBankAccountForCustomer({
      customerId,
      accountNumber,
      routingNumber,
      bankName,
      bankAccountCurrency,
      bankAccountType,
      bankAccountPaymentMethod,
      ownerEmail,
      ownerFirstName,
      ownerLastName,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Bank account creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

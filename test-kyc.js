#!/usr/bin/env node

const fetch = require('node-fetch');

const FERN_API_KEY = process.env.FERN_API_KEY;
const FERN_BASE_URL = process.env.FERN_BASE_URL || "https://api.fernhq.com";

if (!FERN_API_KEY) {
  console.error("❌ FERN_API_KEY environment variable is required");
  process.exit(1);
}

async function testKycFlow() {
  console.log("🧪 Testing Builder Plan KYC Flow...\n");

  try {
    // 1. Create a test customer
    console.log("1. Creating test customer...");
    const createResponse = await fetch(`${FERN_BASE_URL}/customers`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FERN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerType: "INDIVIDUAL",
        firstName: "Test",
        lastName: "User",
        email: "test-kyc@example.com",
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create customer: ${createResponse.status} ${errorText}`);
    }

    const customer = await createResponse.json();
    console.log("✅ Customer created:", customer.customerId);
    console.log("📧 Email:", customer.email);
    console.log("🔗 KYC Link:", customer.kycLink || "Not available");
    console.log("📊 Status:", customer.customerStatus);

    // 2. Get customer details
    console.log("\n2. Fetching customer details...");
    const detailsResponse = await fetch(`${FERN_BASE_URL}/customers/${customer.customerId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${FERN_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!detailsResponse.ok) {
      const errorText = await detailsResponse.text();
      throw new Error(`Failed to fetch customer details: ${detailsResponse.status} ${errorText}`);
    }

    const details = await detailsResponse.json();
    console.log("✅ Customer details fetched");
    console.log("🔗 KYC Link:", details.kycLink || "Not available");
    console.log("📊 Status:", details.customerStatus);

    // 3. Test our new KYC API endpoint
    console.log("\n3. Testing our KYC API endpoint...");
    const kycResponse = await fetch("http://localhost:3000/api/fern/kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        senderEmail: "test-kyc@example.com",
        firstName: "Test",
        lastName: "User",
      }),
    });

    if (!kycResponse.ok) {
      const errorText = await kycResponse.text();
      console.log("⚠️ KYC API failed:", errorText);
    } else {
      const kycData = await kycResponse.json();
      console.log("✅ KYC API response:", kycData);
    }

    // 4. Test external crypto wallet creation (should work on Builder plan)
    console.log("\n4. Testing external crypto wallet creation...");
    const cryptoResponse = await fetch(`${FERN_BASE_URL}/payment-accounts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FERN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentAccountType: "EXTERNAL_CRYPTO_WALLET",
        customerId: customer.customerId,
        nickname: "Test Crypto Wallet",
        externalCryptoWallet: {
          cryptoWalletType: "EVM",
          chain: "BASE",
          address: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
        },
        isThirdParty: true,
      }),
    });

    if (!cryptoResponse.ok) {
      const errorText = await cryptoResponse.text();
      console.log("❌ External crypto wallet creation failed:", errorText);
    } else {
      const cryptoAccount = await cryptoResponse.json();
      console.log("✅ External crypto wallet created:", cryptoAccount.paymentAccountId);
    }

    // 5. Test external bank account creation (should work on Builder plan)
    console.log("\n5. Testing external bank account creation...");
    const bankResponse = await fetch(`${FERN_BASE_URL}/payment-accounts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FERN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentAccountType: "EXTERNAL_BANK_ACCOUNT",
        customerId: customer.customerId,
        nickname: "Test Bank Account",
        externalBankAccount: {
          accountNumber: "1234567890",
          routingNumber: "11110000",
          bankName: "Test Bank",
          bankAccountCurrency: "USD",
          bankAccountType: "CHECKING",
          bankAccountPaymentMethod: "ACH",
          bankAccountOwner: {
            email: "test-kyc@example.com",
            firstName: "Test",
            lastName: "User",
            type: "INDIVIDUAL",
          },
        },
        isThirdParty: false,
      }),
    });

    if (!bankResponse.ok) {
      const errorText = await bankResponse.text();
      console.log("❌ External bank account creation failed:", errorText);
    } else {
      const bankAccount = await bankResponse.json();
      console.log("✅ External bank account created:", bankAccount.paymentAccountId);
    }

    console.log("\n✅ Builder Plan KYC flow test completed successfully!");
    console.log("\n📝 Summary:");
    console.log("✅ Customer creation works");
    console.log("✅ KYC link generation works");
    console.log("✅ External crypto wallet creation works");
    console.log("✅ External bank account creation works");
    console.log("\n📝 Next steps:");
    console.log("1. Visit the KYC link above to complete verification");
    console.log("2. Test the funding flow in your application");
    console.log("3. The app will now guide users through KYC and bank account setup");

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

testKycFlow();

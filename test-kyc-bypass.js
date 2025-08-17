#!/usr/bin/env node

/**
 * Test script to demonstrate KYC bypass functionality
 * Run with: node test-kyc-bypass.js
 */

const BASE_URL = 'http://localhost:3000';

async function testKycBypass() {
  console.log('🧪 Testing KYC Bypass Functionality\n');

  // Test 0: Check testing configuration
  console.log('0. Checking testing configuration...');
  try {
    const configResponse = await fetch(`${BASE_URL}/api/fern/testing-config`);
    const configResult = await configResponse.json();
    console.log('✅ Testing Config:', JSON.stringify(configResult, null, 2));
  } catch (error) {
    console.log('❌ Testing config check failed:', error.message);
  }

  // Test 1: KYC endpoint with bypass
  console.log('\n1. Testing KYC endpoint with bypass...');
  try {
    const kycResponse = await fetch(`${BASE_URL}/api/fern/kyc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderEmail: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      })
    });
    
    const kycResult = await kycResponse.json();
    console.log('✅ KYC Response:', JSON.stringify(kycResult, null, 2));
  } catch (error) {
    console.log('❌ KYC test failed:', error.message);
  }

  // Test 2: Payment plan creation with onramp
  console.log('\n2. Testing payment plan creation with onramp...');
  try {
    const planResponse = await fetch(`${BASE_URL}/api/fern/payment-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_plan',
        planId: 'test-plan-kyc-bypass',
        parsedPlan: {
          title: 'Test Plan',
          totalAmount: 100,
          amountPerTransaction: 50,
          numberOfTransactions: 2,
          frequency: 7,
          startTimeOffset: 0,
          endTimeOffset: 14
        },
        senderEmail: 'sender@example.com',
        receiverEmail: 'receiver@example.com',
        agentChain: 'BASE',
        receiverChosenChain: 'BASE',
        autoCashOut: false
      })
    });
    
    const planResult = await planResponse.json();
    console.log('✅ Plan Created:', JSON.stringify(planResult, null, 2));

    // Test onramp with the created plan
    const onrampResponse = await fetch(`${BASE_URL}/api/fern/payment-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start_onramp',
        planId: 'test-plan-kyc-bypass',
        amountUsd: '100.00',
        fiatMethod: 'ACH'
      })
    });
    
    const onrampResult = await onrampResponse.json();
    console.log('✅ Onramp Response:', JSON.stringify(onrampResult, null, 2));
  } catch (error) {
    console.log('❌ Plan/Onramp test failed:', error.message);
  }

  console.log('\n🎉 KYC Bypass Testing Complete!');
  console.log('\n📝 Notes:');
  console.log('- Set BYPASS_KYC=true in your .env.local file');
  console.log('- Set BYPASS_BANK_ACCOUNT=true in your .env.local file');
  console.log('- Or run in development mode (NODE_ENV=development)');
  console.log('- KYC status will be mocked as "ACTIVE"');
  console.log('- Mock bank account will be created for testing');
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/api/fern/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' })
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🚀 Starting KYC Bypass Test...\n');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Server not running. Please start the development server:');
    console.log('   npm run dev\n');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');
  await testKycBypass();
}

main().catch(console.error);

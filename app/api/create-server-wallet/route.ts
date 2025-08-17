import { NextRequest, NextResponse } from 'next/server';

const BASE_API_URL = 'https://app.dynamicauth.com';
const MPC_RELAY_URL = 'https://relay.dynamicauth.com';

// Define ThresholdSignatureScheme locally to avoid import issues
enum ThresholdSignatureScheme {
  TWO_OF_TWO = 'TWO_OF_TWO',
  TWO_OF_THREE = 'TWO_OF_THREE'
}

// Helper function to create authenticated EVM client
async function createAuthenticatedEvmClient() {
  const authToken = process.env.DYNAMIC_API_KEY;
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;
  
  if (!authToken || !environmentId) {
    throw new Error('Missing required environment variables: DYNAMIC_API_KEY or NEXT_PUBLIC_DYNAMIC_ENV_ID');
  }

  console.log('Creating EVM client with environment ID:', environmentId);

  // Use require() to avoid ES module issues
  const { DynamicEvmWalletClient } = require('@dynamic-labs-wallet/node-evm');
  
  const client = new DynamicEvmWalletClient({
    authToken,
    environmentId,
    baseApiUrl: BASE_API_URL,
    baseMPCRelayApiUrl: MPC_RELAY_URL,
  });
  
  await client.authenticateApiToken(authToken);
  return client;
}

// Helper function to create authenticated SVM client
async function createAuthenticatedSvmClient() {
  const authToken = process.env.DYNAMIC_API_KEY;
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;
  
  if (!authToken || !environmentId) {
    throw new Error('Missing required environment variables: DYNAMIC_API_KEY or NEXT_PUBLIC_DYNAMIC_ENV_ID');
  }

  console.log('Creating SVM client with environment ID:', environmentId);

  // Use require() to avoid ES module issues
  const { DynamicSvmWalletClient } = require('@dynamic-labs-wallet/node-svm');
  
  const client = new DynamicSvmWalletClient({
    authToken,
    environmentId,
    baseApiUrl: BASE_API_URL,
    baseMPCRelayApiUrl: MPC_RELAY_URL,
  });
  
  await client.authenticateApiToken(authToken);
  return client;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chain, planId, planName } = body;

    console.log('Server wallet creation request:', { chain, planId, planName });

    if (!chain || !planId || !planName) {
      return NextResponse.json(
        { error: 'Missing required fields: chain, planId, planName' },
        { status: 400 }
      );
    }

    // Determine which client to use based on chain
    let walletData;
    
    if (['ethereum', 'polygon', 'base', 'arbitrum', 'optimism'].includes(chain)) {
      // EVM chains
      console.log('Creating EVM wallet for chain:', chain);
      const evmClient = await createAuthenticatedEvmClient();
      
      walletData = await evmClient.createWalletAccount({
        thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
        password: `plan-${planId}`, // Use plan ID as password for uniqueness
        onError: (error: Error) => {
          console.error('EVM wallet creation error:', error);
          throw error;
        },
      });
      
      console.log('EVM wallet created successfully:', walletData.accountAddress);
    } else if (chain === 'solana') {
      // Solana chain
      console.log('Creating SVM wallet for Solana');
      const svmClient = await createAuthenticatedSvmClient();
      
      walletData = await svmClient.createWalletAccount({
        thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
        password: `plan-${planId}`, // Use plan ID as password for uniqueness
        onError: (error: Error) => {
          console.error('SVM wallet creation error:', error);
          throw error;
        },
      });
      
      console.log('SVM wallet created successfully:', walletData.accountAddress);
    } else {
      return NextResponse.json(
        { error: `Unsupported chain: ${chain}` },
        { status: 400 }
      );
    }

    // Return wallet data (excluding sensitive information)
    const response = {
      success: true,
      walletAddress: walletData.accountAddress,
      publicKey: 'publicKeyHex' in walletData ? walletData.publicKeyHex : walletData.rawPublicKey,
      planId,
      chain,
      createdAt: new Date().toISOString(),
    };

    console.log('Server wallet creation completed successfully:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Server wallet creation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create server wallet',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

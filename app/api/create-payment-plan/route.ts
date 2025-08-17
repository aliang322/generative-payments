import { NextRequest, NextResponse } from 'next/server';

interface PaymentPlanRequest {
  description: string;
  planType: 'sending' | 'receiving';
  chain: string;
  userId: string;
}

interface PaymentPlanData {
  title: string;
  frequency: number;
  amountPerTransaction: number;
  totalAmount: number;
  numberOfTransactions: number;
  startTimeOffset: number;
  endTimeOffset: number;
  walletAddress?: string; // Added for receiver plans
}

export async function POST(request: NextRequest) {
  try {
    const { description, planType, chain, userId }: PaymentPlanRequest = await request.json();

    // Log API input
    console.log('🔵 Create Payment Plan API - Input:', {
      description,
      planType,
      chain,
      userId,
      timestamp: new Date().toISOString(),
    });

    if (!description || !planType || !chain || !userId) {
      console.log('❌ Create Payment Plan API - Error: Missing required fields');
      return NextResponse.json(
        { error: 'description, planType, chain, and userId are required' },
        { status: 400 }
      );
    }

    // First, parse the payment plan using the existing API
    const parseResponse = await fetch(`${request.nextUrl.origin}/api/parse-payment-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description }),
    });

    if (!parseResponse.ok) {
      console.log('❌ Create Payment Plan API - Parse error:', parseResponse.status);
      throw new Error(`Payment plan parsing failed: ${parseResponse.status}`);
    }

    const parsedPlan: PaymentPlanData = await parseResponse.json();

    // If this is a receiver type plan, create a server wallet
    if (planType === 'receiving') {
      console.log('🔄 Create Payment Plan API - Creating server wallet for receiver plan');
      
      // Get Supabase configuration
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        console.log('❌ Create Payment Plan API - Error: Supabase configuration missing');
        // Continue without wallet if Supabase not configured
      } else {
        // Call the Supabase Edge Function directly
        const supabaseFunctionUrl = `${supabaseUrl}/functions/v1/create-server-wallet`;
        
        const walletResponse = await fetch(supabaseFunctionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            chain,
          }),
        });

        if (!walletResponse.ok) {
          const errorText = await walletResponse.text();
          console.log('❌ Create Payment Plan API - Wallet creation failed:', {
            status: walletResponse.status,
            error: errorText,
          });
          // Continue without wallet address if creation fails
          console.log('⚠️ Create Payment Plan API - Continuing without wallet address');
        } else {
          const walletResult = await walletResponse.json();
          if (walletResult.success && walletResult.walletAddress) {
            parsedPlan.walletAddress = walletResult.walletAddress;
            console.log('✅ Create Payment Plan API - Wallet created:', walletResult.walletAddress);
          }
        }
      }
    }

    // Log final response
    console.log('✅ Create Payment Plan API - Success:', {
      title: parsedPlan.title,
      planType,
      hasWallet: !!parsedPlan.walletAddress,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ...parsedPlan,
      planType,
      chain,
    });

  } catch (error) {
    console.log('❌ Create Payment Plan API - Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      { error: 'Failed to create payment plan' },
      { status: 500 }
    );
  }
}

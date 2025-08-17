import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WalletRequest {
  userId: string
  chain: string
  password?: string
}

interface WalletResponse {
  success: boolean
  walletAddress?: string
  walletId?: string
  error?: string
}

const BASE_API_URL = 'https://app.dynamicauth.com'

// Create embedded wallet using Dynamic's REST API
const createDynamicEmbeddedWallet = async (apiKey: string, environmentId: string, userId: string, chain: string) => {
  console.log(`Creating embedded wallet for user: ${userId}, chain: ${chain}`)
  
  // Map chain names to Dynamic's expected format
  const chainMap: { [key: string]: string } = {
    'ethereum': 'EVM',
    'polygon': 'EVM', 
    'base': 'EVM',
    'arbitrum': 'EVM',
    'optimism': 'EVM',
    'solana': 'SOL'
  }
  
  const dynamicChain = chainMap[chain.toLowerCase()] || 'EVM'
  
  // Create embedded wallet using the correct endpoint
  const response = await fetch(`${BASE_API_URL}/api/v0/environments/${environmentId}/embeddedWallets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifier: userId,
      type: 'userId',
      chains: [dynamicChain],
      chain: dynamicChain
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Dynamic API Error Response:', errorText)
    throw new Error(`Failed to create embedded wallet: ${response.status} - ${errorText}`)
  }

  const result = await response.json()
  console.log('Dynamic API Success Response:', JSON.stringify(result, null, 2))
  
  return result
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, chain, password }: WalletRequest = await req.json()

    if (!userId || !chain) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId and chain are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get environment variables
    const dynamicApiKey = Deno.env.get('DYNAMIC_API_KEY')
    const dynamicEnvId = Deno.env.get('DYNAMIC_ENV_ID')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!dynamicApiKey || !dynamicEnvId || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required environment variables' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if user already has a wallet for this chain
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: existingWallet, error: checkError } = await supabase
      .from('wallets')
      .select('wallet_address, wallet_id')
      .eq('user_id', userId)
      .eq('chain', chain)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error checking existing wallet:', checkError)
      return new Response(
        JSON.stringify({ success: false, error: 'Database error checking existing wallet' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If wallet already exists, return it
    if (existingWallet) {
      return new Response(
        JSON.stringify({
          success: true,
          walletAddress: existingWallet.wallet_address,
          walletId: existingWallet.wallet_id,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create new embedded wallet using Dynamic Labs REST API
    console.log('Creating embedded wallet via Dynamic API...')
    const walletResult = await createDynamicEmbeddedWallet(dynamicApiKey, dynamicEnvId, userId, chain)
    
    console.log('Wallet creation result:', JSON.stringify(walletResult, null, 2))

    // Extract wallet information from the response
    const user = walletResult.user
    if (!user || !user.wallets || user.wallets.length === 0) {
      throw new Error('No wallets returned from Dynamic API')
    }

    // Get the first wallet (should be the one we just created)
    const wallet = user.wallets[0]
    const accountAddress = wallet.publicKey
    const walletId = wallet.id

    // Store wallet information in Supabase
    const { data: walletData, error: insertError } = await supabase
      .from('wallets')
      .insert({
        user_id: userId,
        wallet_address: accountAddress,
        wallet_id: walletId,
        chain: chain,
        raw_public_key: wallet.publicKey,
        public_key_hex: wallet.publicKey,
        external_server_key_shares: {
          walletData: wallet,
          userData: user,
          provider: wallet.provider || 'embedded',
          properties: wallet.properties || {}
        },
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error storing wallet:', insertError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to store wallet information' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        walletAddress: accountAddress,
        walletId: walletId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

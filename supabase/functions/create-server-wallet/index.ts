import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DynamicEvmWalletClient } from 'https://esm.sh/@dynamic-labs-wallet/node-evm@0.0.137'
import { ThresholdSignatureScheme } from 'https://esm.sh/@dynamic-labs-wallet/node@0.0.137'

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
const MPC_RELAY_URL = 'https://relay.dynamicauth.com'

const authenticatedEvmClient = async ({
  authToken,
  environmentId,
  baseApiUrl,
  baseMPCRelayApiUrl,
}: {
  authToken: string
  environmentId: string
  baseApiUrl?: string
  baseMPCRelayApiUrl?: string
}) => {
  const client = new DynamicEvmWalletClient({
    authToken,
    environmentId,
    baseApiUrl: baseApiUrl || BASE_API_URL,
    baseMPCRelayApiUrl: baseMPCRelayApiUrl || MPC_RELAY_URL,
  })
  
  await client.authenticateApiToken(authToken)
  return client
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

    // Create new wallet using Dynamic Labs
    const evmClient = await authenticatedEvmClient({
      authToken: dynamicApiKey,
      environmentId: dynamicEnvId,
    })

    const thresholdSignatureScheme = ThresholdSignatureScheme.TWO_OF_TWO
    const onError = (error: Error) => {
      console.error('Dynamic wallet creation error:', error)
    }

    const walletResult = await evmClient.createWalletAccount({
      thresholdSignatureScheme,
      password: password || undefined,
      onError,
    })

    const {
      accountAddress,
      rawPublicKey,
      publicKeyHex,
      externalServerKeyShares,
    } = walletResult

    // Store wallet information in Supabase
    const { data: walletData, error: insertError } = await supabase
      .from('wallets')
      .insert({
        user_id: userId,
        wallet_address: accountAddress,
        wallet_id: accountAddress, // Using address as ID for now
        chain: chain,
        raw_public_key: rawPublicKey,
        public_key_hex: publicKeyHex,
        external_server_key_shares: externalServerKeyShares,
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
        walletId: accountAddress,
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

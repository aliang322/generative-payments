-- Create wallets table to store server wallet information
CREATE TABLE wallets (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  chain TEXT NOT NULL,
  raw_public_key TEXT,
  public_key_hex TEXT,
  external_server_key_shares JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- Create index on wallet_address for faster lookups
CREATE INDEX idx_wallets_address ON wallets(wallet_address);

-- Create index on chain for filtering by blockchain
CREATE INDEX idx_wallets_chain ON wallets(chain);

-- Add RLS policy (if needed)
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see their own wallets
CREATE POLICY "Users can view their own wallets" ON wallets
  FOR SELECT USING (auth.uid()::text = user_id);

-- Create policy to allow authenticated users to insert wallets
CREATE POLICY "Authenticated users can insert wallets" ON wallets
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

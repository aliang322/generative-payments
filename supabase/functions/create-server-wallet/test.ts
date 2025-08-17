// Simple test for the create-server-wallet function
// This can be run locally to test the function

const testCreateWallet = async () => {
  const testData = {
    userId: 'test-user-123',
    chain: 'ethereum',
  }

  try {
    const response = await fetch('http://localhost:54321/functions/v1/create-server-wallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY',
      },
      body: JSON.stringify(testData),
    })

    const result = await response.json()
    console.log('Test Result:', result)
  } catch (error) {
    console.error('Test Error:', error)
  }
}

// Uncomment to run the test
// testCreateWallet()

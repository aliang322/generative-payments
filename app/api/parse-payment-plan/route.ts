import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
	try {
		const { description } = await request.json();

		// Log API input
		console.log('🔵 Payment Plan API - Input:', {
			description,
			timestamp: new Date().toISOString(),
			userAgent: request.headers.get('user-agent'),
		});

		if (!description) {
			console.log('❌ Payment Plan API - Error: Description is required');
			return NextResponse.json(
				{ error: 'Description is required' },
				{ status: 400 }
			);
		}

		const openaiApiKey = process.env.OPENAI_API_KEY;
		if (!openaiApiKey) {
			console.log('❌ Payment Plan API - Error: OpenAI API key not configured');
			return NextResponse.json(
				{ error: 'OpenAI API key not configured' },
				{ status: 500 }
			);
		}

		const prompt = `Parse this payment plan description and extract the following information in JSON format:
Description: "${description}"

Return only a JSON object with these fields:
- title: A concise, descriptive title for the payment plan (max 50 characters)
- frequency: Frequency in seconds (e.g., 86400 for daily, 604800 for weekly, 2592000 for monthly). Return -1 if frequency cannot be determined.
- amountPerTransaction: Amount per payment as a unitless number (e.g., 0.1, 50, 100). Return -1 if amount cannot be determined.
- totalAmount: Total amount for all transactions (amountPerTransaction * numberOfTransactions). Return -1 if cannot be calculated.
- numberOfTransactions: Total number of transactions to be made. Return -1 if cannot be determined.
- startTimeOffset: Start time offset in seconds from plan acceptance (0 for immediate start, 86400 for start tomorrow, etc.). Return 0 if not specified.
- endTimeOffset: End time offset in seconds from plan acceptance (e.g., 2592000 for 30 days from acceptance, 604800 for 1 week from acceptance). Return -1 if amount cannot be determined.

Example response: {"title": "Weekly Rent Split", "frequency": 604800, "amountPerTransaction": 0.1, "totalAmount": 0.5, "numberOfTransactions": 5, "startTimeOffset": 0, "endTimeOffset": 2592000}`;

		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${openaiApiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: 'gpt-4o-mini',
				messages: [
					{
						role: 'system',
						content: 'You are a payment plan parser. Extract structured data from natural language descriptions. Return only valid JSON with a concise title (string, max 50 chars), numeric values for frequency (in seconds), amountPerTransaction (unitless), totalAmount (unitless), numberOfTransactions (integer), startTimeOffset (seconds from plan acceptance), and endTimeOffset (seconds from plan acceptance).'
					},
					{
						role: 'user',
						content: prompt
					}
				],
				temperature: 0.1,
				max_tokens: 200,
			}),
		});

		if (!response.ok) {
			console.log('❌ Payment Plan API - OpenAI API error:', response.status);
			throw new Error(`OpenAI API error: ${response.status}`);
		}

		const data = await response.json();
		const content = data.choices[0]?.message?.content;

		// Log OpenAI response
		console.log('🟢 Payment Plan API - OpenAI Response:', {
			content,
			model: data.model,
			usage: data.usage,
			timestamp: new Date().toISOString(),
		});

		if (!content) {
			console.log('❌ Payment Plan API - Error: No content received from OpenAI');
			throw new Error('No content received from OpenAI');
		}

		// Try to parse the JSON response
		let parsedData;
		try {
			// Extract JSON from the response (in case there's extra text)
			const jsonMatch = content.match(/\{.*\}/);
			if (jsonMatch) {
				parsedData = JSON.parse(jsonMatch[0]);
			} else {
				parsedData = JSON.parse(content);
			}
		} catch (parseError) {
			console.log('⚠️ Payment Plan API - Failed to parse OpenAI response:', {
				content,
				error: parseError instanceof Error ? parseError.message : String(parseError),
				timestamp: new Date().toISOString(),
			});
			// Fallback parsing
			const now = Math.floor(Date.now() / 1000);
			const thirtyDaysFromNow = now + (30 * 24 * 60 * 60);
			parsedData = {
				title: "Weekly Payment Plan",
				frequency: 604800, // Weekly in seconds
				amountPerTransaction: 0.1,
				totalAmount: 0.5,
				numberOfTransactions: 5,
				startTimeOffset: 0,
				endTimeOffset: 2592000 // 30 days
			};
		}

		// Ensure all required fields are present with proper defaults
		const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
		
		const result = {
			title: parsedData.title || "Payment Plan",
			frequency: parsedData.frequency || 604800, // Default to weekly (7 days in seconds)
			amountPerTransaction: parsedData.amountPerTransaction || 0.1,
			totalAmount: parsedData.totalAmount || (parsedData.amountPerTransaction * parsedData.numberOfTransactions) || 0.5,
			numberOfTransactions: parsedData.numberOfTransactions || 5,
			startTimeOffset: parsedData.startTimeOffset || 0,
			endTimeOffset: parsedData.endTimeOffset || 2592000 // Default to 30 days
		};

		// Check if critical fields couldn't be determined
		const failedFields: string[] = [];
		if (result.frequency === -1) failedFields.push("frequency");
		if (result.amountPerTransaction === -1) failedFields.push("amountPerTransaction");
		if (result.numberOfTransactions === -1) failedFields.push("numberOfTransactions");
		if (result.totalAmount === -1) failedFields.push("totalAmount");
		
		if (failedFields.length > 0) {
			console.log('❌ Payment Plan API - AI could not extract critical fields:', {
				failedFields,
				result,
				timestamp: new Date().toISOString(),
			});
		}

		// Log final API response
		console.log('✅ Payment Plan API - Success Response:', {
			result,
			timestamp: new Date().toISOString(),
		});

		return NextResponse.json(result);
	} catch (error) {
		console.log('❌ Payment Plan API - Unexpected error:', {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			timestamp: new Date().toISOString(),
		});
		return NextResponse.json(
			{ error: 'Failed to parse payment plan' },
			{ status: 500 }
		);
	}
}

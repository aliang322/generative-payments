"use client";

import { useState, useEffect } from "react";
import { useDynamicContext, DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { useRouter } from "next/navigation";
import LoginButton from "@/components/LoginButton";
import SpeechInput from "@/components/SpeechInput";
import GlowCard from "@/components/GlowCard";

type Plan = {
	id: string;
	name: string;
	type: "sending" | "receiving";
	description: string;
	status: "draft" | "active" | "completed";
	frequency?: number; // in seconds
	amountPerTransaction?: number; // unitless
	startTime?: number; // Unix timestamp in seconds
	endTime?: number; // Unix timestamp in seconds
	chain?: string;
	title?: string; // AI generated title
};

type PaymentPlanData = {
	title: string; // concise title
	frequency: number; // in seconds
	amountPerTransaction: number; // unitless
	totalAmount: number; // unitless
	numberOfTransactions: number; // integer
	startTimeOffset: number; // seconds from now
	endTimeOffset: number; // seconds from now
	code?: string; // generated import code
	walletAddress?: string; // wallet address for receiver plans
};

const CHAINS = [
	{ id: "ethereum", name: "Ethereum", icon: "🔷" },
	{ id: "solana", name: "Solana", icon: "🟣" },
	{ id: "polygon", name: "Polygon", icon: "🟣" },
	{ id: "base", name: "Base", icon: "🔵" },
	{ id: "arbitrum", name: "Arbitrum", icon: "🔵" },
	{ id: "optimism", name: "Optimism", icon: "🔴" },
];

// Number mappings for plan type and chain
const PLAN_TYPE_MAP = {
	"sending": 1,
	"receiving": 2,
} as const;

const CHAIN_MAP = {
	"ethereum": 1,
	"solana": 2,
	"polygon": 3,
	"base": 4,
	"arbitrum": 5,
	"optimism": 6,
} as const;

// Reverse mappings for importing
const PLAN_TYPE_REVERSE_MAP = {
	1: "sending",
	2: "receiving",
} as const;

const CHAIN_REVERSE_MAP = {
	1: "ethereum",
	2: "solana",
	3: "polygon",
	4: "base",
	5: "arbitrum",
	6: "optimism",
} as const;

export default function Dashboard() {
	const { user, setShowDynamicUserProfile } = useDynamicContext();
	const router = useRouter();
	
	// Debug logging
	console.log("Dashboard render - user:", !!user, "setShowDynamicUserProfile:", !!setShowDynamicUserProfile);
	
	const [activeTab, setActiveTab] = useState<"create" | "plans">("create");
	const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
	const [plans, setPlans] = useState<Plan[]>([
		{
			id: "1",
			name: "Rent Split",
			type: "sending",
			description: "Split 0.1 ETH over 3 weeks for rent",
			status: "active",
		},
		{
			id: "2",
			name: "Muffin Sales",
			type: "receiving",
			description: "Get paid $4.50 per muffin",
			status: "draft",
		},
	]);

	// Form state
	const [planType, setPlanType] = useState<"sending" | "receiving" | "">("");
	const [selectedChain, setSelectedChain] = useState<string>("");

	// Update warnings when form fields change
	useEffect(() => {
		const validation = validateForm();
		setWarnings(validation.warnings);
	}, [planType, selectedChain]);
	const [planDescription, setPlanDescription] = useState<string>("");
	const [isGenerating, setIsGenerating] = useState<boolean>(false);
	const [warnings, setWarnings] = useState<string[]>([]);
	const [errors, setErrors] = useState<string[]>([]);
	const [generatedPlanData, setGeneratedPlanData] = useState<PaymentPlanData | null>(null);
	const [showCode, setShowCode] = useState<boolean>(false);
	const [importMode, setImportMode] = useState<boolean>(false);
	const [importCode, setImportCode] = useState<string>("");
	const [importPlanName, setImportPlanName] = useState<string>("");
	const [planCreationTime, setPlanCreationTime] = useState<number | null>(null);
	const [editablePlanData, setEditablePlanData] = useState<PaymentPlanData | null>(null);

	// Validation function
	function validateForm(): { isValid: boolean; warnings: string[] } {
		const warnings: string[] = [];

		if (!planType) {
			warnings.push("Please select whether you're sending or receiving");
		}
		if (planType === "receiving" && !selectedChain) {
			warnings.push("Please select a chain for receiving payments");
		}

		return { isValid: warnings.length === 0, warnings };
	}

	// Redirect if not logged in
	useEffect(() => {
		if (!user) {
			router.push("/");
		}
	}, [user, router]);

	// Don't render if user is not logged in (will redirect)
	if (!user) {
		return null;
	}

	// Wrapper function that calls the API route to parse payment plan descriptions
	async function parsePaymentPlan(description: string): Promise<PaymentPlanData> {
		try {
			const response = await fetch('/api/parse-payment-plan', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ description }),
			});

			if (!response.ok) {
				throw new Error('Failed to parse payment plan');
			}

			const data = await response.json();
			return data;
		} catch (error) {
			console.error('Error parsing payment plan:', error);
			// Fallback parsing
			const now = Math.floor(Date.now() / 1000);
			const thirtyDaysFromNow = now + (30 * 24 * 60 * 60);
			return {
				title: "Weekly Payment Plan",
				frequency: 604800, // Weekly in seconds
				amountPerTransaction: 0.1,
				totalAmount: 0.5,
				numberOfTransactions: 5,
				startTimeOffset: 0,
				endTimeOffset: 2592000 // 30 days
			};
		}
	}

	async function handleGeneratePlan(description: string) {
		const validation = validateForm();
		setWarnings(validation.warnings);
		setErrors([]); // Clear any previous errors

		if (!validation.isValid) {
			return;
		}

		setIsGenerating(true);
		setPlanDescription(description);

		try {
			// Parse the payment plan using OpenAI
			const parsedData = await parsePaymentPlan(description);
			
			// Check if AI couldn't extract critical information
			const failedFields: string[] = [];
			
			if (parsedData.frequency === -1) failedFields.push("frequency");
			if (parsedData.amountPerTransaction === -1) failedFields.push("amount per transaction");
			if (parsedData.numberOfTransactions === -1) failedFields.push("number of transactions");
			if (parsedData.totalAmount === -1) failedFields.push("total amount");
			if (parsedData.startTimeOffset < 0) failedFields.push("start time (cannot be negative)");
			if (parsedData.endTimeOffset < 0) failedFields.push("end time (cannot be negative)");
			
			if (failedFields.length > 0) {
				const fieldList = failedFields.join(", ");
				setErrors([`Try again, our AI couldn't understand: ${fieldList}`]);
				setCreateStep(1);
				// Keep the description text so user can edit it
				return;
			}
			
			// Store the generation time for offset calculations
			setPlanCreationTime(Math.floor(Date.now() / 1000));
			setGeneratedPlanData(parsedData);
			setEditablePlanData(parsedData);
			setCreateStep(2);
		} catch (error) {
			console.error('Error generating plan:', error);
			setErrors(["Failed to generate payment plan. Please try again."]);
		} finally {
			setIsGenerating(false);
		}
	}

	async function handleCreatePlan() {
		if (!editablePlanData || !user) return;

		try {
			// Call the new create payment plan API that includes wallet creation for receivers
			const response = await fetch('/api/create-payment-plan', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					description: planDescription,
					planType: planType,
					chain: selectedChain,
					userId: (user as any).userId || (user as any).id || user.email || 'unknown',
				}),
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}

			const result = await response.json();

			// Store the creation timestamp and convert offsets to actual timestamps
			const creationTime = Math.floor(Date.now() / 1000);
			const startTime = creationTime + editablePlanData.startTimeOffset;
			const endTime = creationTime + editablePlanData.endTimeOffset;

			const newPlan: Plan = {
				id: Date.now().toString(),
				name: editablePlanData.title || planDescription.slice(0, 30) + (planDescription.length > 30 ? "..." : ""),
				type: planType as "sending" | "receiving",
				description: planDescription,
				status: "draft",
				frequency: editablePlanData.frequency,
				amountPerTransaction: editablePlanData.amountPerTransaction,
				startTime: startTime,
				endTime: endTime,
				chain: selectedChain,
				title: editablePlanData.title,
			};

			setPlans([newPlan, ...plans]);
			
			// Generate code with number mappings
			const planTypeNumber = PLAN_TYPE_MAP[planType as keyof typeof PLAN_TYPE_MAP] || 0;
			const chainNumber = selectedChain ? CHAIN_MAP[selectedChain as keyof typeof CHAIN_MAP] || 0 : 0;
			
			// Include wallet address in code for receiver plans
			let code = `${editablePlanData.frequency};${editablePlanData.amountPerTransaction};${editablePlanData.totalAmount};${editablePlanData.numberOfTransactions};${startTime};${endTime};${planTypeNumber};${chainNumber}`;
			
			if (result.walletAddress && planType === 'receiving') {
				code += `;${result.walletAddress}`;
				console.log('✅ Dashboard - Wallet address included in export code:', result.walletAddress);
			}
			
			// Store the code and go to Step 3
			const planDataWithCode = { ...editablePlanData, code, walletAddress: result.walletAddress };
			setGeneratedPlanData(planDataWithCode);
			setCreateStep(3);

		} catch (error) {
			console.error('Error creating payment plan:', error);
			// Fallback to the old behavior if the new API fails
			const creationTime = Math.floor(Date.now() / 1000);
			const startTime = creationTime + editablePlanData.startTimeOffset;
			const endTime = creationTime + editablePlanData.endTimeOffset;

			const newPlan: Plan = {
				id: Date.now().toString(),
				name: editablePlanData.title || planDescription.slice(0, 30) + (planDescription.length > 30 ? "..." : ""),
				type: planType as "sending" | "receiving",
				description: planDescription,
				status: "draft",
				frequency: editablePlanData.frequency,
				amountPerTransaction: editablePlanData.amountPerTransaction,
				startTime: startTime,
				endTime: endTime,
				chain: selectedChain,
				title: editablePlanData.title,
			};

			setPlans([newPlan, ...plans]);
			
			// Generate code with number mappings (fallback without wallet)
			const planTypeNumber = PLAN_TYPE_MAP[planType as keyof typeof PLAN_TYPE_MAP] || 0;
			const chainNumber = selectedChain ? CHAIN_MAP[selectedChain as keyof typeof CHAIN_MAP] || 0 : 0;
			const code = `${editablePlanData.frequency};${editablePlanData.amountPerTransaction};${editablePlanData.totalAmount};${editablePlanData.numberOfTransactions};${startTime};${endTime};${planTypeNumber};${chainNumber}`;
			
			// Store the code and go to Step 3
			const planDataWithCode = { ...editablePlanData, code };
			setGeneratedPlanData(planDataWithCode);
			setCreateStep(3);
		}
	}

	function handleFieldEdit(field: keyof PaymentPlanData, value: number | string) {
		if (!editablePlanData) return;
		
		const updatedData = { ...editablePlanData, [field]: value };
		
		// Recalculate total amount if amount per transaction or number of transactions changed
		if (field === 'amountPerTransaction' || field === 'numberOfTransactions') {
			updatedData.totalAmount = updatedData.amountPerTransaction * updatedData.numberOfTransactions;
		}
		
		setEditablePlanData(updatedData);
		console.log(`🔧 Field edited: ${field} = ${value}`, updatedData);
	}

	function handleFundPlan(planId: string) {
		console.log("Fund button clicked for plan:", planId);
		console.log("setShowDynamicUserProfile available:", !!setShowDynamicUserProfile);
		
		// Open Dynamic user profile which contains funding options
		if (setShowDynamicUserProfile) {
			setShowDynamicUserProfile(true);
		} else {
			console.error("setShowDynamicUserProfile is not available");
			alert("Funding options not available. Please try again or contact support.");
		}
	}

	function handleDeletePlan(planId: string) {
		setPlans(plans.filter(plan => plan.id !== planId));
	}

	function handleImportPlan() {
		if (!importCode.trim() || !importPlanName.trim()) {
			alert("Please enter both the import code and plan name.");
			return;
		}

		const parts = importCode.split(';');
		if (parts.length !== 8) {
			alert("Invalid import code format. Please check the code and try again.");
			return;
		}

		try {
			const [frequency, amountPerTransaction, totalAmount, numberOfTransactions, startTime, endTime, typeNumber, chainNumber] = parts;
			
			// Convert numbers back to strings using reverse mappings
			const planType = PLAN_TYPE_REVERSE_MAP[Number(typeNumber) as keyof typeof PLAN_TYPE_REVERSE_MAP];
			const chain = CHAIN_REVERSE_MAP[Number(chainNumber) as keyof typeof CHAIN_REVERSE_MAP];
			
			if (!planType) {
				alert("Invalid plan type in import code.");
				return;
			}
			
			const newPlan: Plan = {
				id: Date.now().toString(),
				name: importPlanName,
				type: planType,
				description: `Imported plan: ${importPlanName}`,
				status: "draft",
				frequency: Number(frequency),
				amountPerTransaction: Number(amountPerTransaction),
				startTime: Number(startTime),
				endTime: Number(endTime),
				chain: chain || undefined,
				title: importPlanName,
			};

			setPlans([newPlan, ...plans]);
			setImportMode(false);
			setImportCode("");
			setImportPlanName("");
			alert("Plan imported successfully!");
		} catch (error) {
			alert("Error importing plan. Please check the code format and try again.");
		}
	}

	// Helper functions to format data
	function formatFrequency(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
		if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
		if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w`;
		return `${Math.floor(seconds / 2592000)}mo`;
	}

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp * 1000);
		return date.toLocaleDateString();
	}

	function formatTimestampWithTime(timestamp: number): string {
		const date = new Date(timestamp * 1000);
		return `${date.toLocaleDateString()} ${date.toLocaleTimeString('en-US', { 
			hour12: false, 
			hour: '2-digit', 
			minute: '2-digit',
			second: '2-digit'
		})}`;
	}

	// Get user display name from Dynamic
	const displayName = user?.username || 
		user?.email?.split('@')[0] ||
		"User";

	return (
		<main className="relative min-h-screen flex flex-col items-stretch justify-between overflow-hidden bg-[#0a0a0a] text-white">
			{/* Background visuals */}
			<div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.15]" />
			<div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-fuchsia-600/30 to-indigo-600/30 blur-3xl animate-blob" />
			<div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-700/20 blur-3xl animate-blob-delayed" />

			<header className="relative z-10 flex items-center justify-between max-w-screen-lg mx-auto w-full px-6 pt-6">
				<h1 className="text-2xl font-semibold">Hey, {displayName}!</h1>
				<LoginButton className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md shadow-sm" />
			</header>

			<section className="relative z-10 flex-1 flex flex-col items-stretch max-w-screen-lg mx-auto w-full gap-6 px-6 py-8">
				{/* Tabs */}
				<div className="flex gap-1 p-1 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
					<button
						onClick={() => setActiveTab("create")}
						className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
							activeTab === "create"
								? "bg-white/10 text-white shadow-sm"
								: "text-white/60 hover:text-white/80"
						}`}
					>
						Create a Plan
					</button>
					<button
						onClick={() => setActiveTab("plans")}
						className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
							activeTab === "plans"
								? "bg-white/10 text-white shadow-sm"
								: "text-white/60 hover:text-white/80"
						}`}
					>
						My Plans
					</button>
				</div>

				{/* Tab Content */}
				{activeTab === "create" && (
					<GlowCard className="w-full">
						{/* Loading state - full screen overlay */}
						{isGenerating && (
							<div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-50">
								<div className="text-center">
									<div className="relative mb-6">
										<div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
										<div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-cyan-400 rounded-full animate-spin mx-auto" style={{ animationDelay: '-0.5s' }}></div>
									</div>
									<h3 className="text-xl font-semibold mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
										Generating Payment Plan
									</h3>
									<p className="text-white/60 text-sm">AI is analyzing your description...</p>
								</div>
							</div>
						)}

						{/* Step indicator */}
						<div className="flex items-center gap-2 mb-6">
							<div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
								createStep >= 1 ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/60'
							}`}>
								1
							</div>
							<div className={`flex-1 h-px ${
								createStep >= 2 ? 'bg-blue-500' : 'bg-white/10'
							}`} />
							<div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
								createStep >= 2 ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/60'
							}`}>
								2
							</div>
							<div className={`flex-1 h-px ${
								createStep >= 3 ? 'bg-blue-500' : 'bg-white/10'
							}`} />
							<div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
								createStep >= 3 ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/60'
							}`}>
								3
							</div>
						</div>

						{createStep === 1 && !isGenerating && (
							<>
								<h2 className="text-xl font-semibold mb-4">Generate a New Payment Plan</h2>
								
								{/* Validation Warnings */}
								{warnings.length > 0 && (
									<div className="mb-4 p-3 rounded-xl bg-yellow-500/20 border border-yellow-500/30">
										{warnings.map((warning, index) => (
											<p key={index} className="text-yellow-300 text-sm">⚠️ {warning}</p>
										))}
									</div>
								)}

								{/* Error Messages */}
								{errors.length > 0 && (
									<div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30">
										{errors.map((error, index) => (
											<p key={index} className="text-red-300 text-sm">❌ {error}</p>
										))}
									</div>
								)}

								{/* Plan Type and Chain Selection - Horizontal Layout */}
								<div className="flex gap-4 mb-4">
									<div className="flex-1">
										<label className="block text-sm font-medium text-white/80 mb-2">
											Type
										</label>
										<select
											value={planType}
											onChange={(e) => setPlanType(e.target.value as "sending" | "receiving" | "")}
											className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40 transition-all hover:bg-white/15"
										>
											<option value="" className="text-black bg-white">Select plan type...</option>
											<option value="sending" className="text-black bg-white">Sending Payments</option>
											<option value="receiving" className="text-black bg-white">Receiving Payments</option>
										</select>
									</div>

									<div className="flex-1">
										<label className="block text-sm font-medium text-white/80 mb-2">
											Chain
										</label>
										<select
											value={selectedChain}
											onChange={(e) => setSelectedChain(e.target.value)}
											className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40 transition-all hover:bg-white/15"
										>
											<option value="" className="text-black bg-white">Select chain...</option>
											{CHAINS.map((chain) => (
												<option key={chain.id} value={chain.id} className="text-black bg-white">
													{chain.icon} {chain.name}
												</option>
											))}
										</select>
									</div>
								</div>

								{/* Description Input */}
								<div className="mb-4">
									<label className="block text-sm font-medium text-white/80 mb-2">
										Payment Plan Description
									</label>
									<SpeechInput
										value={planDescription}
										onChange={(value) => setPlanDescription(value)}
										placeholder="Describe your payment plan..."
										hintText="Press enter to generate"
										nextLabel={isGenerating ? "Generating..." : "Generate"}
										onSubmit={handleGeneratePlan}
										showNextButton
										showMic
										readOnly={isGenerating}
										disabled={!validateForm().isValid}
									/>
								</div>


							</>
						)}

						{createStep === 2 && editablePlanData && (
							<>
								<h2 className="text-xl font-semibold mb-4">Step 2: Review & Edit Generated Plan</h2>
								
								{/* Generated Plan Details */}
								<div className="mb-6 p-6 rounded-xl bg-white/5 border border-white/10">
									<h3 className="text-lg font-medium mb-4">Generated Payment Plan</h3>
									
									<div className="grid grid-cols-2 gap-4 mb-4">
										<div>
											<label className="block text-sm font-medium text-white/60 mb-1">Type</label>
											<span className="text-white font-medium">
												{planType === "sending" ? "Sending Payments" : "Receiving Payments"}
											</span>
										</div>
										<div>
											<label className="block text-sm font-medium text-white/60 mb-1">Chain</label>
											<span className="text-white font-medium">
												{selectedChain ? CHAINS.find(c => c.id === selectedChain)?.name || selectedChain : "Not specified"}
											</span>
										</div>
									</div>

									{/* Editable Fields */}
									<div className="grid grid-cols-2 gap-4 mb-4">
										<div className="col-span-2">
											<label className="block text-sm font-medium text-white/60 mb-1">Plan Title</label>
											<input
												type="text"
												value={editablePlanData.title}
												onChange={(e) => handleFieldEdit('title', e.target.value)}
												className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
												placeholder="Weekly Rent Split"
												maxLength={50}
											/>
											<p className="text-xs text-white/40 mt-1">{editablePlanData.title.length}/50 characters</p>
										</div>
										<div>
											<label className="block text-sm font-medium text-white/60 mb-1">Frequency (seconds)</label>
											<input
												type="number"
												value={editablePlanData.frequency}
												onChange={(e) => handleFieldEdit('frequency', Number(e.target.value))}
												className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
												placeholder="86400"
											/>
											<p className="text-xs text-white/40 mt-1">{formatFrequency(editablePlanData.frequency)}</p>
										</div>
										<div>
											<label className="block text-sm font-medium text-white/60 mb-1">Amount Per Transaction</label>
											<input
												type="number"
												step="0.01"
												value={editablePlanData.amountPerTransaction}
												onChange={(e) => handleFieldEdit('amountPerTransaction', Number(e.target.value))}
												className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
												placeholder="0.1"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-white/60 mb-1">Number of Transactions</label>
											<input
												type="number"
												value={editablePlanData.numberOfTransactions}
												onChange={(e) => handleFieldEdit('numberOfTransactions', Number(e.target.value))}
												className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
												placeholder="5"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-white/60 mb-1">Total Amount</label>
											<input
												type="number"
												step="0.01"
												value={editablePlanData.totalAmount}
												onChange={(e) => handleFieldEdit('totalAmount', Number(e.target.value))}
												className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
												placeholder="0.5"
											/>
										</div>
									</div>
									
									<div className="mb-4">
										<label className="block text-sm font-medium text-white/60 mb-1">Description</label>
										<p className="text-white/80">{planDescription}</p>
									</div>
									
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-white/60 mb-1">Start Time Offset (seconds from plan acceptance)</label>
											<input
												type="number"
												value={editablePlanData.startTimeOffset}
												onChange={(e) => handleFieldEdit('startTimeOffset', Number(e.target.value))}
												className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
												placeholder="0"
											/>
											<p className="text-xs text-white/40 mt-1">
												{planCreationTime ? formatTimestampWithTime(planCreationTime + editablePlanData.startTimeOffset) : "Will be calculated when plan is created"}
											</p>
										</div>
										<div>
											<label className="block text-sm font-medium text-white/60 mb-1">End Time Offset (seconds from plan acceptance)</label>
											<input
												type="number"
												value={editablePlanData.endTimeOffset}
												onChange={(e) => handleFieldEdit('endTimeOffset', Number(e.target.value))}
												className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
												placeholder="2592000"
											/>
											<p className="text-xs text-white/40 mt-1">
												{planCreationTime ? formatTimestampWithTime(planCreationTime + editablePlanData.endTimeOffset) : "Will be calculated when plan is created"}
											</p>
										</div>
									</div>
								</div>

								{/* Action Buttons */}
								<div className="flex gap-3">
									<button
										onClick={() => {
											setCreateStep(1);
											setGeneratedPlanData(null);
											setEditablePlanData(null);
											setErrors([]); // Clear errors when going back
										}}
										className="flex-1 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-colors"
									>
										Back
									</button>
									<button
										onClick={handleCreatePlan}
										className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-b from-blue-500 to-indigo-600 text-white font-medium hover:opacity-90 transition-opacity"
									>
										Create Plan
									</button>
								</div>
							</>
						)}

						{createStep === 3 && generatedPlanData && (
							<>
								<h2 className="text-xl font-semibold mb-4">Step 3: Your Plan Code</h2>
								
								<div className="mb-6 p-6 rounded-xl bg-white/5 border border-white/10">
									<h3 className="text-lg font-medium mb-4">Plan Created Successfully!</h3>
									
									<div className="mb-4">
										<label className="block text-sm font-medium text-white/60 mb-2">Import Code</label>
										<div className="relative">
											<input
												type="text"
												value={generatedPlanData.code || ""}
												readOnly
												className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-mono text-sm"
											/>
											<button
												onClick={() => {
													navigator.clipboard.writeText(generatedPlanData.code || "");
													alert("Code copied to clipboard!");
												}}
												className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 rounded-lg bg-blue-500 text-white text-xs hover:bg-blue-600 transition-colors"
											>
												Copy
											</button>
										</div>
										<p className="text-xs text-white/40 mt-2">
											Share this code with others to import your payment plan
										</p>
									</div>

									<div className="mb-4">
										<label className="block text-sm font-medium text-white/60 mb-2">Code Format</label>
										<p className="text-xs text-white/40 font-mono">
											frequency;amountPerTransaction;totalAmount;numberOfTransactions;startTime;endTime;planType;chain
										</p>
									</div>

									<div className="mb-4">
										<label className="block text-sm font-medium text-white/60 mb-2">Plan Type Mapping</label>
										<p className="text-xs text-white/40">
											1 = Sending, 2 = Receiving
										</p>
									</div>

									<div className="mb-4">
										<label className="block text-sm font-medium text-white/60 mb-2">Chain Mapping</label>
										<p className="text-xs text-white/40">
											1 = Ethereum, 2 = Solana, 3 = Polygon, 4 = Base, 5 = Arbitrum, 6 = Optimism
										</p>
									</div>
								</div>

								{/* Action Buttons */}
								<div className="flex gap-3">
									<button
										onClick={() => {
											setCreateStep(1);
											setGeneratedPlanData(null);
											setEditablePlanData(null);
											setPlanType("");
											setSelectedChain("");
											setPlanDescription("");
											setErrors([]);
										}}
										className="flex-1 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-colors"
									>
										Create Another Plan
									</button>
									<button
										onClick={() => setActiveTab("plans")}
										className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-b from-blue-500 to-indigo-600 text-white font-medium hover:opacity-90 transition-opacity"
									>
										View My Plans
									</button>
								</div>
							</>
						)}
					</GlowCard>
				)}

				{activeTab === "plans" && (
					<GlowCard className="w-full">
						{/* Import Plan Section */}
						{importMode && (
							<div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
								<h3 className="text-lg font-medium mb-4">Import Plan</h3>
								<div className="space-y-4">
									<div>
										<label className="block text-sm font-medium text-white/60 mb-2">Import Code</label>
										<input
											type="text"
											value={importCode}
											onChange={(e) => setImportCode(e.target.value)}
											placeholder="Paste your import code here..."
											className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-white/60 mb-2">Plan Name</label>
										<input
											type="text"
											value={importPlanName}
											onChange={(e) => setImportPlanName(e.target.value)}
											placeholder="Enter a name for this plan..."
											className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
										/>
									</div>
									<div className="flex gap-3">
										<button
											onClick={handleImportPlan}
											className="px-4 py-2 rounded-xl bg-gradient-to-b from-blue-500 to-indigo-600 text-white font-medium hover:opacity-90 transition-opacity"
										>
											Import Plan
										</button>
										<button
											onClick={() => {
												setImportMode(false);
												setImportCode("");
												setImportPlanName("");
											}}
											className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-colors"
										>
											Cancel
										</button>
									</div>
								</div>
							</div>
						)}

						{/* Plans Header */}
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-xl font-semibold">My Plans</h2>
							<button
								onClick={() => setImportMode(!importMode)}
								className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-colors"
							>
								{importMode ? "Cancel Import" : "Import Plan"}
							</button>
						</div>

						{plans.length === 0 ? (
							<div className="text-center py-12">
								<p className="text-white/60">No plans yet. Create your first one!</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-b border-white/10">
											<th className="text-left py-4 px-4 font-medium text-white/80">Plan</th>
											<th className="text-left py-4 px-4 font-medium text-white/80">Description</th>
											<th className="text-left py-4 px-4 font-medium text-white/80">Type</th>
											<th className="text-left py-4 px-4 font-medium text-white/80">Details</th>
											<th className="text-right py-4 px-4 font-medium text-white/80">Actions</th>
										</tr>
									</thead>
									<tbody>
										{plans.map((plan) => (
											<tr key={plan.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
												<td className="py-4 px-4">
													<span className="font-medium">{plan.name}</span>
												</td>
												<td className="py-4 px-4">
													<span className="text-white/70 text-sm">{plan.description}</span>
												</td>
												<td className="py-4 px-4">
													<span
														className={`px-3 py-1 rounded-full text-xs font-medium ${
															plan.type === "sending"
																? "bg-red-500/20 text-red-300"
																: "bg-green-500/20 text-green-300"
														}`}
													>
														{plan.type === "sending" ? "Sending" : "Receiving"}
													</span>
												</td>
												<td className="py-4 px-4">
													{plan.frequency && plan.startTime && plan.endTime && (
														<div className="text-xs text-white/60">
															<div>{formatFrequency(plan.frequency)} • {plan.amountPerTransaction}</div>
															<div>{formatTimestamp(plan.startTime)} → {formatTimestamp(plan.endTime)}</div>
															{plan.chain && <div>Chain: {plan.chain}</div>}
														</div>
													)}
												</td>
												<td className="py-4 px-4 text-right">
													<div className="flex items-center justify-end gap-2">
														{plan.type === "sending" && (
															<button
																onClick={() => handleFundPlan(plan.id)}
																className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-gradient-to-b from-blue-500 to-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 hover:scale-105 active:scale-95 cursor-pointer"
																disabled={!setShowDynamicUserProfile}
															>
																Fund
															</button>
														)}
														<button
															onClick={() => handleDeletePlan(plan.id)}
															className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-red-500/20 border border-red-500/30 px-3 py-1.5 text-sm font-medium text-red-300 shadow-sm transition-all hover:bg-red-500/30 hover:scale-105 active:scale-95 cursor-pointer"
														>
															Delete
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</GlowCard>
				)}
			</section>
			
			{/* Hidden Dynamic Widget for funding options */}
			<div className="hidden">
				<DynamicWidget />
			</div>
		</main>
	);
}

"use client";

import { useState } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
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
};

export default function Dashboard() {
	const { user } = useDynamicContext();
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<"create" | "plans">("create");
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

	// Redirect if not logged in
	if (!user) {
		router.push("/");
		return null;
	}

	function handleCreatePlan(description: string) {
		const newPlan: Plan = {
			id: Date.now().toString(),
			name: description.slice(0, 30) + (description.length > 30 ? "..." : ""),
			type: description.toLowerCase().includes("pay") ? "sending" : "receiving",
			description,
			status: "draft",
		};
		setPlans([newPlan, ...plans]);
	}

	function handleFundPlan(planId: string) {
		// TODO: Implement funding logic
		console.log("Funding plan:", planId);
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
						<h2 className="text-xl font-semibold mb-4">Create a New Payment Plan</h2>
						<SpeechInput
							placeholder="Describe your payment plan..."
							hintText="Press enter to generate"
							nextLabel="Generate"
							onSubmit={handleCreatePlan}
							showNextButton
							showMic
						/>
					</GlowCard>
				)}

				{activeTab === "plans" && (
					<div className="space-y-4">
						{plans.length === 0 ? (
							<GlowCard className="w-full text-center py-12">
								<p className="text-white/60">No plans yet. Create your first one!</p>
							</GlowCard>
						) : (
							plans.map((plan) => (
								<GlowCard key={plan.id} className="w-full">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-3 mb-2">
												<h3 className="font-semibold">{plan.name}</h3>
												<span
													className={`px-2 py-1 rounded-full text-xs font-medium ${
														plan.type === "sending"
															? "bg-red-500/20 text-red-300"
															: "bg-green-500/20 text-green-300"
													}`}
												>
													{plan.type === "sending" ? "Sending" : "Receiving"}
												</span>
												<span
													className={`px-2 py-1 rounded-full text-xs font-medium ${
														plan.status === "active"
															? "bg-blue-500/20 text-blue-300"
															: plan.status === "completed"
															? "bg-gray-500/20 text-gray-300"
															: "bg-yellow-500/20 text-yellow-300"
													}`}
												>
													{plan.status}
												</span>
											</div>
											<p className="text-white/70 text-sm">{plan.description}</p>
										</div>
										{plan.type === "sending" && plan.status === "draft" && (
											<button
												onClick={() => handleFundPlan(plan.id)}
												className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-gradient-to-b from-blue-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
											>
												Fund
											</button>
										)}
									</div>
								</GlowCard>
							))
						)}
					</div>
				)}
			</section>
		</main>
	);
}

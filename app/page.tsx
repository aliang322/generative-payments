"use client";

import SpeechInput from "@/components/SpeechInput";

export default function Home() {
	function handleSubmit(value: string) {
		// TODO: route to generation page or call API
		console.log("Generate for:", value);
	}

	return (
		<main className="relative min-h-screen flex flex-col items-stretch justify-between overflow-hidden bg-[#0a0a0a] text-white">
			{/* Background visuals */}
			<div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.15]" />
			<div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-fuchsia-600/30 to-indigo-600/30 blur-3xl animate-blob" />
			<div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-700/20 blur-3xl animate-blob-delayed" />

			<header className="relative z-10 flex items-center justify-end max-w-screen-sm mx-auto w-full px-6 pt-6">
				<a
					href="#login"
					className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md shadow-sm"
				>
					<span className="i-heroicons-user text-base" aria-hidden />
					Login
				</a>
			</header>

			<section className="relative z-10 flex-1 flex flex-col items-start justify-center max-w-screen-sm mx-auto w-full gap-6 px-6">
				<div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl shadow-[0_0_1px_0_rgba(255,255,255,0.2),0_20px_60px_-15px_rgba(0,0,0,0.6)]">
					<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl leading-tight">
						Hey User,
						<br />
						how do you want to pay?
					</h1>

					<div className="mt-4">
						<SpeechInput
							className="mt-2"
							placeholder="e.g. Split 0.1 ETH over 3 weeks for rent"
							hintText="Press enter to generate a payment plan"
							nextLabel="Next"
							onSubmit={handleSubmit}
							showNextButton
						/>
					</div>
				</div>
			</section>

			<footer className="relative z-10 max-w-screen-sm mx-auto w-full text-center text-xs text-white/60 px-6 pb-6">
				Built for the next billion crypto users
			</footer>
		</main>
	);
}

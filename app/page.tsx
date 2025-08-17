"use client";

import SpeechInput from "@/components/SpeechInput";
import GlowCard from "@/components/GlowCard";
import TypewriterExamples from "@/components/TypewriterExamples";
import { useState } from "react";

export default function Home() {
	const [example, setExample] = useState<string>("Rent, but split into tiny bites");

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
				<GlowCard className="w-full">
					<h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
						Generate custom plans to <br /> pay and get paid.
					</h1>

					<div className="mt-8">
						<SpeechInput
							className="mt-2"
							value={example}
							placeholder=""
							hintText=""
							nextLabel="Next"
							onSubmit={handleSubmit}
							showNextButton
							readOnly
							showMic={false}
						/>
						<TypewriterExamples className="sr-only" onTextChange={setExample} />
					</div>
				</GlowCard>
			</section>

			<footer className="relative z-10 max-w-screen-sm mx-auto w-full text-center text-xs text-white/60 px-6 pb-6">
				Built for the next billion crypto users
			</footer>
		</main>
	);
}

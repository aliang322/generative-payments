"use client";

import { useEffect, useRef, useState } from "react";

export default function SpeechInput({
	value,
	onChange,
	onSubmit,
	nextLabel = "Next",
	placeholder = "Tell us in your own words…",
	hintText = "Tap the mic and say: “Split 0.1 ETH over 3 weeks for rent…”",
	className = "",
	showNextButton = true,
	readOnly = false,
	showMic = true,
	disabled = false,
}: {
	value?: string;
	onChange?: (next: string) => void;
	onSubmit?: (value: string) => void;
	nextLabel?: string;
	placeholder?: string;
	hintText?: string;
	className?: string;
	showNextButton?: boolean;
	readOnly?: boolean;
	showMic?: boolean;
	disabled?: boolean;
}) {
	const [inputValue, setInputValue] = useState<string>(value ?? "");
	const [isListening, setIsListening] = useState<boolean>(false);
	const [isSpeechAvailable, setIsSpeechAvailable] = useState<boolean>(false);
	const recognitionRef = useRef<any | null>(null);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Detect speech availability only after mount to keep SSR/CSR markup identical
	useEffect(() => {
		const available = typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
		setIsSpeechAvailable(available);
	}, []);

	// Initialize recognition when available
	useEffect(() => {
		if (!isSpeechAvailable || !showMic) return;
		const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
		const recognition = new SR();
		recognition.lang = "en-US";
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.maxAlternatives = 1;
		recognitionRef.current = recognition;

		recognition.onresult = (event: any) => {
			let transcript = "";
			for (let i = event.resultIndex; i < event.results.length; i++) {
				transcript += event.results[i][0].transcript;
			}
			const next = transcript.trim();
			setInputValue(next);
			onChange?.(next);
		};

		recognition.onend = () => {
			setIsListening(false);
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		};

		recognition.onerror = (event: any) => {
			console.log('Speech recognition error:', event.error);
			setIsListening(false);
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
			// Don't restart automatically on error
		};

		return () => {
			recognition.stop?.();
			recognitionRef.current = null;
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		};
	}, [isSpeechAvailable, onChange, showMic]);

	useEffect(() => {
		if (value !== undefined) setInputValue(value);
	}, [value]);

	function handleManualChange(e: React.ChangeEvent<HTMLInputElement>) {
		if (readOnly) return;
		setInputValue(e.target.value);
		onChange?.(e.target.value);
	}

	function submit() {
		const trimmed = (value ?? inputValue).trim();
		if (!trimmed) return;
		onSubmit?.(trimmed);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") {
			e.preventDefault();
			submit();
		}
	}

	function toggleListening() {
		if (!isSpeechAvailable || !showMic) {
			alert("Speech recognition isn't supported in this browser. Try Chrome on Android or Safari on iOS.");
			return;
		}
		if (!recognitionRef.current) return;
		
		if (isListening) {
			// Stop recording
			recognitionRef.current.stop();
			setIsListening(false);
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		} else {
			// Start recording
			try {
				setIsListening(true);
				recognitionRef.current.start();
				
				// Set a maximum recording time of 60 seconds as a safety measure
				timeoutRef.current = setTimeout(() => {
					if (recognitionRef.current && isListening) {
						recognitionRef.current.stop();
						setIsListening(false);
						console.log('Speech recognition stopped due to 60s timeout');
					}
				}, 60000);
			} catch (error) {
				console.log('Failed to start speech recognition:', error);
				setIsListening(false);
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
					timeoutRef.current = null;
				}
			}
		}
	}

	const displayValue = value !== undefined ? value : inputValue;

	return (
		<div className={`w-full ${className}`}>
			<div className="flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/10 backdrop-blur-md p-2 shadow-md">
				<input
					type="text"
					value={displayValue}
					onChange={handleManualChange}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className={`flex-1 bg-transparent px-3 py-3 text-base placeholder-black/40 dark:placeholder-white/50 focus:outline-none ${readOnly ? "caret-transparent cursor-default" : ""}`}
					inputMode="text"
					aria-label="Describe how you want to pay"
					readOnly={readOnly}
					aria-readonly={readOnly}
				/>
				{showMic && (
					<button
						type="button"
						onClick={toggleListening}
						aria-pressed={isListening}
						className={`relative inline-flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${isListening ? "bg-rose-500 text-white" : "bg-black/90 text-white dark:bg-white/90 dark:text-black"}`}
						title={isSpeechAvailable ? (isListening ? "Stop listening" : "Speak") : "Speech not supported"}
					>
						{isListening && (
							<span className="absolute -inset-1 rounded-2xl animate-ping bg-rose-500/40" />
						)}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
							<path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V20h3a 1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.08A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 1 0 10 0Z" />
						</svg>
					</button>
				)}
				{showNextButton && (
					<button
						type="button"
						onClick={submit}
						disabled={disabled || !displayValue.trim()}
						className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-xl bg-gradient-to-b from-blue-500 to-indigo-600 px-4 text-[15px] font-medium text-white shadow-sm transition-opacity disabled:opacity-50"
					>
						{nextLabel}
					</button>
				)}
			</div>
			<p className="mt-2 text-xs text-black/50 dark:text-white/50">
				{hintText}
			</p>
		</div>
	);
} 
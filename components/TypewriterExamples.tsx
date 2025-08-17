"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_EXAMPLES = [
	"pay him $10 over 9,000 transactions. Round down.",
	"$4.50 per muffin.",
	"Tip 3 creators 0.001 ETH daily"
];

export default function TypewriterExamples({
	examples = DEFAULT_EXAMPLES,
	speedMs = 45,
	delayBetweenMs = 1200,
	onTextChange,
	className = "",
}: {
	examples?: string[];
	speedMs?: number;
	delayBetweenMs?: number;
	onTextChange?: (text: string) => void;
	className?: string;
}) {
	const [index, setIndex] = useState<number>(0);
	const [phase, setPhase] = useState<"typing" | "pausing" | "deleting">("typing");
	const [subIndex, setSubIndex] = useState<number>(0);
	const text = useMemo(() => examples[index] ?? "", [examples, index]);
	const timeoutRef = useRef<number | null>(null);

	useEffect(() => {
		// push text up to parent (e.g., placeholder)
		onTextChange?.(text.slice(0, subIndex));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [subIndex, text]);

	useEffect(() => {
		if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

		if (phase === "typing") {
			if (subIndex < text.length) {
				timeoutRef.current = window.setTimeout(() => setSubIndex(subIndex + 1), speedMs);
			} else {
				timeoutRef.current = window.setTimeout(() => setPhase("pausing"), delayBetweenMs);
			}
		} else if (phase === "pausing") {
			timeoutRef.current = window.setTimeout(() => setPhase("deleting"), delayBetweenMs);
		} else if (phase === "deleting") {
			if (subIndex > 0) {
				timeoutRef.current = window.setTimeout(() => setSubIndex(subIndex - 1), 24);
			} else {
				setPhase("typing");
				setIndex((index + 1) % examples.length);
			}
		}

		return () => {
			if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
		};
	}, [phase, subIndex, text, examples.length, index, speedMs, delayBetweenMs]);

	return (
		<p className={`text-sm text-white/70 ${className}`}>
			{text.slice(0, subIndex)}
			<span className="inline-block w-[10px] ml-0.5 bg-white/80 animate-pulse" style={{ height: "1em", verticalAlign: "-0.1em" }} />
		</p>
	);
}

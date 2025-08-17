"use client";

import { useRef, useState } from "react";

export default function GlowCard({
	className = "",
	children,
	padding = "p-6",
}: {
	className?: string;
	children: React.ReactNode;
	padding?: string;
}) {
	const ref = useRef<HTMLDivElement | null>(null);
	const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
	const [isHovering, setIsHovering] = useState<boolean>(false);

	function handleMove(e: React.MouseEvent<HTMLDivElement>) {
		const el = ref.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const x = (e.clientX - rect.left) / rect.width;
		const y = (e.clientY - rect.top) / rect.height;
		setCoords({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
	}

	function handleEnter() {
		setIsHovering(true);
	}

	function handleLeave() {
		setIsHovering(false);
		setCoords({ x: 0.5, y: 0.5 });
	}

	const style = {
		["--x" as any]: `${(coords.x * 100).toFixed(2)}%`,
		["--y" as any]: `${(coords.y * 100).toFixed(2)}%`,
	} as React.CSSProperties as any;

	return (
		<div
			ref={ref}
			onMouseEnter={handleEnter}
			onMouseMove={handleMove}
			onMouseLeave={handleLeave}
			style={style}
			className={`glow-card ${isHovering ? "is-hovering" : ""} rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_1px_0_rgba(255,255,255,0.2),0_20px_60px_-15px_rgba(0,0,0,0.6)] ${padding} ${className}`}
		>
			{children}
		</div>
	);
}

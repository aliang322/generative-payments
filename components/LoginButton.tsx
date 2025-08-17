"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

export default function LoginButton({ className = "" }: { className?: string }) {
	const { user, setShowAuthFlow } = useDynamicContext();
	function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
		e.preventDefault();
		setShowAuthFlow(true);
	}
	return (
		<a
			href="#login"
			onClick={handleClick}
			className={className}
		>
			<span className="i-heroicons-user text-base" aria-hidden />
			{user ? "Account" : "Login"}
		</a>
	);
}

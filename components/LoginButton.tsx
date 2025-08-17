"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

export default function LoginButton({ className = "" }: { className?: string }) {
	const { user, setShowAuthFlow, handleLogOut } = useDynamicContext();
	
	function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
		e.preventDefault();
		if (user) {
			handleLogOut();
		} else {
			setShowAuthFlow(true);
		}
	}
	
	return (
		<a
			href="#login"
			onClick={handleClick}
			className={className}
		>
			<span className="i-heroicons-user text-base" aria-hidden />
			{user ? "Logout" : "Login"}
		</a>
	);
}

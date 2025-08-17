"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

export default function NextOrLoginButton({
	labelWhenLoggedIn = "Next",
	onNext,
	disabled,
	className,
}: {
	labelWhenLoggedIn?: string;
	onNext?: () => void;
	disabled?: boolean;
	className?: string;
}) {
	const { user, setShowAuthFlow } = useDynamicContext();
	function handleClick() {
		if (user) {
			onNext?.();
		} else {
			setShowAuthFlow(true);
		}
	}
	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={disabled}
			className={className}
		>
			{user ? labelWhenLoggedIn : "Login to continue"}
		</button>
	);
}

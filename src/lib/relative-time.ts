export type RelativeTimeFormat = "long" | "short";

export const formatRelativeTime = (
	date: Date | null,
	format: RelativeTimeFormat = "long",
): string => {
	if (!date) {
		return "-";
	}

	const diffMs = Math.max(0, Date.now() - date.getTime());
	const minutes = Math.floor(diffMs / 60_000);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (format === "short") {
		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return "just now";
	}

	if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
	if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
	if (minutes > 0) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
	return "just now";
};

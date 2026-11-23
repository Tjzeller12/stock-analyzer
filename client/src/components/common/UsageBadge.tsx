import { useEffect, useState } from "react";
import { authGet } from "../../utils/api";
import { ALPHA_BOT_ENDPOINTS } from "../../constants/api";

interface UsageData {
    uses: number;
    limit: number | null;
    tier: string;
}

/**
 * UsageBadge
 *
 * Shows free-tier users how many AlphaBot queries they have left today.
 * Hidden entirely for dev-tier accounts.
 */
const UsageBadge = () => {
    const [usage, setUsage] = useState<UsageData | null>(null);

    useEffect(() => {
        authGet<UsageData>(ALPHA_BOT_ENDPOINTS.USAGE)
            .then(setUsage)
            .catch(() => setUsage(null));
    }, []);

    if (!usage || usage.tier === "dev" || usage.limit === null) return null;

    const remaining = usage.limit - usage.uses;
    const isExhausted = remaining <= 0;

    return (
        <div
            title="AlphaBot daily query limit"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                isExhausted
                    ? "bg-red-500/20 border-red-400/50 text-red-300"
                    : "bg-white/10 border-white/20 text-white"
            }`}
        >
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {isExhausted ? "Limit reached" : `${remaining}/${usage.limit} queries left`}
        </div>
    );
};

export default UsageBadge;

import type { ApiSentimentLabel } from "@/types/api";

const SENTIMENT_CONFIG: Record<ApiSentimentLabel, { color: string; bg: string; emoji: string }> = {
  angry: { color: "text-red-700", bg: "bg-red-50 border-red-200", emoji: "\uD83D\uDE21" },
  frustrated: { color: "text-red-600", bg: "bg-red-50 border-red-200", emoji: "\uD83D\uDE24" },
  concerned: { color: "text-amber-700", bg: "bg-amber-50 border-amber-200", emoji: "\uD83D\uDE1F" },
  neutral: { color: "text-gray-600", bg: "bg-gray-50 border-gray-200", emoji: "\uD83D\uDE10" },
  satisfied: { color: "text-green-700", bg: "bg-green-50 border-green-200", emoji: "\uD83D\uDE0A" },
};

interface SentimentBadgeProps {
  label?: ApiSentimentLabel;
  score?: number;
  showScore?: boolean;
}

export function SentimentBadge({ label, score, showScore = false }: SentimentBadgeProps) {
  if (!label) return null;

  const config = SENTIMENT_CONFIG[label] ?? SENTIMENT_CONFIG.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
    >
      <span>{config.emoji}</span>
      <span className="capitalize">{label}</span>
      {showScore && score !== undefined && (
        <span className="text-[10px] opacity-70">({(score * 100).toFixed(0)}%)</span>
      )}
    </span>
  );
}

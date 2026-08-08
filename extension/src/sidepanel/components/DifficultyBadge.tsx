interface Props {
  difficulty: "Easy" | "Medium" | "Hard" | "Unknown";
}

const STYLES: Record<Props["difficulty"], { fg: string; bg: string }> = {
  Easy: { fg: "var(--success)", bg: "var(--success-bg)" },
  Medium: { fg: "var(--warning)", bg: "var(--warning-bg)" },
  Hard: { fg: "var(--danger)", bg: "var(--danger-bg)" },
  Unknown: { fg: "var(--text-secondary)", bg: "var(--bg-surface-raised)" },
};

export function DifficultyBadge({ difficulty }: Props) {
  const style = STYLES[difficulty];
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: 0.2,
        padding: "3px 9px",
        borderRadius: "var(--radius-full)",
        color: style.fg,
        background: style.bg,
      }}
    >
      {difficulty}
    </span>
  );
}

// Orange-square brand mark + "SAB India Tracker" lockup.
// Two tones: ink (warm-paper backgrounds) and light (dark-mode live state).

type Tone = "ink" | "light";

interface WordmarkProps {
  size?: number;
  tone?: Tone;
  showTag?: boolean;
}

const ACCENT = "oklch(0.68 0.16 45)";
const INK = "oklch(0.22 0.01 60)";
const INK_MUTED = "oklch(0.55 0.01 60)";

export function Wordmark({ size = 18, tone = "ink", showTag = true }: WordmarkProps) {
  const color = tone === "ink" ? INK : "#fff";
  const muted = tone === "ink" ? INK_MUTED : "rgba(255,255,255,0.6)";
  const glyph = size * 1.5;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.55 }}>
      <svg width={glyph} height={glyph} viewBox="0 0 40 40" style={{ flex: "none" }}>
        <rect x="2" y="2" width="36" height="36" rx="6" fill={ACCENT} />
        <path
          d="M11 25c0-4 3-6 7-6s7-2 7-6"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="11" cy="15" r="2.2" fill="#fff" />
        <circle cx="29" cy="25" r="2.2" fill="#fff" />
      </svg>
      <div style={{ lineHeight: 1.05 }}>
        <div
          style={{
            fontFamily: "var(--font-sab-sans), Inter Tight, system-ui, sans-serif",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            fontSize: size,
            color,
          }}
        >
          SAB India{" "}
          <span style={{ fontWeight: 500, color: muted }}>Tracker</span>
        </div>
        {showTag && (
          <div
            style={{
              fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
              fontSize: Math.max(9, size * 0.52),
              color: muted,
              letterSpacing: "0.04em",
              marginTop: 2,
            }}
          >
            Powered by{" "}
            <span style={{ color: ACCENT, fontWeight: 600 }}>indefine</span>
          </div>
        )}
      </div>
    </div>
  );
}

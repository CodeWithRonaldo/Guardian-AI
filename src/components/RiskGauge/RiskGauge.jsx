import styles from './RiskGauge.module.css';

const SIZE   = 220;
const CX     = SIZE / 2;
const CY     = SIZE / 2;
const RADIUS = 86;
const STROKE = 14;

function polarToCartesian(score) {
  // Gauge spans 180° from left (180°) to right (0°) through top (270° in SVG)
  const angle = Math.PI + (score / 100) * Math.PI;
  return {
    x: CX + RADIUS * Math.cos(angle),
    y: CY + RADIUS * Math.sin(angle),
  };
}

function arcPath(score) {
  if (score <= 0) return '';
  const start = { x: CX - RADIUS, y: CY };
  const end   = polarToCartesian(Math.min(score, 99.99));
  const large = score > 50 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x} ${end.y}`;
}

function riskColour(score) {
  if (score >= 85) return 'var(--danger)';
  if (score >= 70) return 'var(--elev)';
  if (score >= 50) return 'var(--warn)';
  return 'var(--safe)';
}

function riskLabel(score) {
  if (score >= 85) return 'Critical';
  if (score >= 70) return 'Elevated';
  if (score >= 50) return 'Moderate';
  return 'Normal';
}

export default function RiskGauge({ score = 0 }) {
  const colour  = riskColour(score);
  const label   = riskLabel(score);
  const bgPath  = arcPath(100);
  const fillPath = arcPath(score);

  return (
    <div className={styles.wrapper}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        aria-label={`Risk score ${score} out of 100`}
      >
        {/* Background track */}
        <path
          d={bgPath}
          fill="none"
          stroke="var(--bg-elevated)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Filled arc */}
        {score > 0 && (
          <path
            d={fillPath}
            fill="none"
            stroke={colour}
            strokeWidth={STROKE}
            strokeLinecap="round"
            className={styles.fill}
          />
        )}

        {/* Score number */}
        <text
          x={CX}
          y={CY - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          className={styles.score}
          fill={colour}
        >
          {score}
        </text>

        {/* Label */}
        <text
          x={CX}
          y={CY + 24}
          textAnchor="middle"
          className={styles.label}
          fill="var(--text-secondary)"
        >
          {label}
        </text>

        {/* Min / Max markers */}
        <text x={18} y={CY + 22} className={styles.marker} fill="var(--text-muted)">0</text>
        <text x={SIZE - 18} y={CY + 22} className={styles.marker} textAnchor="end" fill="var(--text-muted)">100</text>
      </svg>
    </div>
  );
}

import styles from './StatusBadge.module.css';

const VARIANTS = {
  active:   { label: 'Active',   cls: styles.active },
  paused:   { label: 'Paused',   cls: styles.paused },
  elevated: { label: 'Elevated', cls: styles.elevated },
  offline:  { label: 'Offline',  cls: styles.offline },
};

export default function StatusBadge({ variant = 'active', label }) {
  const v = VARIANTS[variant] ?? VARIANTS.active;
  return (
    <span className={`${styles.badge} ${v.cls}`}>
      <span className={styles.dot} />
      {label ?? v.label}
    </span>
  );
}

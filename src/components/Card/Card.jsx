import styles from './Card.module.css';

export default function Card({ title, children, className = '', action }) {
  return (
    <div className={`${styles.card} ${className}`}>
      {(title || action) && (
        <div className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {action && <div className={styles.action}>{action}</div>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </div>
  );
}

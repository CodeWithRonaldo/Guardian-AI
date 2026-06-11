import { useActionLog } from '../../hooks/useActionLog';
import Card from '../../components/Card/Card';
import { ACTION_LOG_ID, NETWORK } from '../../constants/contracts';
import styles from './ActionLog.module.css';

const ACTION_STYLES = {
  'Pause':       styles.actionPause,
  'Unpause':     styles.actionUnpause,
  'Tighten LTV': styles.actionTighten,
  'Notify':      styles.actionNotify,
  'Log Only':    styles.actionLog,
};

function riskClass(score) {
  if (score >= 85) return styles.scoreDanger;
  if (score >= 70) return styles.scoreElevated;
  if (score >= 50) return styles.scoreWarn;
  return styles.scoreSafe;
}

export default function ActionLog() {
  const { entries, entryCount, isPending } = useActionLog();
  const reversed = [...entries].reverse();

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Action Log</h1>
          <p className={styles.subtitle}>
            On-chain audit trail — every guardian action, permanently recorded.{' '}
            <a
              href={`https://suiscan.xyz/${NETWORK}/object/${ACTION_LOG_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.explorerLink}
            >
              View object on Sui Explorer →
            </a>
          </p>
        </div>
        <span className={styles.count}>{entryCount} entries</span>
      </div>

      <Card>
        {isPending && (
          <p className={styles.state}>Loading on-chain log…</p>
        )}

        {!isPending && entries.length === 0 && (
          <p className={styles.state}>
            No entries yet. Run a simulation or trigger a real risk event.
          </p>
        )}

        {!isPending && entries.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Risk Score</th>
                <th>Action</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {reversed.map((e, i) => (
                <tr key={i}>
                  <td className={styles.time}>
                    {new Date(e.timestampMs).toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                  <td>
                    <span className={`${styles.score} ${riskClass(e.riskScore)}`}>
                      {e.riskScore}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.action} ${ACTION_STYLES[e.actionLabel] ?? ''}`}>
                      {e.actionLabel}
                    </span>
                  </td>
                  <td className={styles.reason}>{e.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

import Card from '../../components/Card/Card';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import { useGuardianConfig } from '../../hooks/useGuardianConfig';
import { useProtocol } from '../../hooks/useProtocol';
import { RISK_THRESHOLDS, GUARDIAN_CONFIG_ID, ADMIN_CAP_ID } from '../../constants/contracts';
import styles from './Configuration.module.css';

export default function Configuration() {
  const config  = useGuardianConfig();
  const protocol = useProtocol();

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Configuration</h1>
          <p className={styles.subtitle}>Guardian thresholds and on-chain permissions</p>
        </div>
      </div>

      {/* Guardian status */}
      <Card title="Guardian Status">
        <div className={styles.statusRow}>
          <div>
            <p className={styles.statusDesc}>
              The guardian is currently{' '}
              <strong style={{ color: config.enabled ? 'var(--safe)' : 'var(--danger)' }}>
                {config.enabled === null ? 'loading…' : config.enabled ? 'active' : 'disabled'}
              </strong>
              . To disable it, call <code>cap::disable</code> with your AdminCap.
            </p>
            {config.agentAddress && (
              <p className={styles.addressLine}>
                Agent wallet:{' '}
                <span className={styles.mono}>{config.agentAddress}</span>
              </p>
            )}
          </div>
          <StatusBadge variant={config.enabled ? 'active' : 'offline'} />
        </div>
      </Card>

      {/* Risk thresholds */}
      <Card title="Risk Thresholds">
        <p className={styles.thresholdIntro}>
          These thresholds are enforced by the off-chain risk engine. The guardian
          acts autonomously when the risk score crosses each level.
        </p>
        <div className={styles.thresholds}>
          <Threshold
            score={RISK_THRESHOLDS.NOTIFY}
            label="Notify"
            description="Telegram notification sent to the protocol team. No on-chain action."
            colour="var(--warn)"
          />
          <Threshold
            score={RISK_THRESHOLDS.TIGHTEN_LTV}
            label="Tighten LTV"
            description="LTV ratio is reduced autonomously via an on-chain transaction using GuardianCap."
            colour="var(--elev)"
          />
          <Threshold
            score={RISK_THRESHOLDS.PAUSE}
            label="Pause Protocol"
            description="All protocol activity halted. Team notified immediately."
            colour="var(--danger)"
          />
        </div>
      </Card>

      {/* Protocol state */}
      <Card title="Live Protocol State">
        <div className={styles.stateGrid}>
          <StateItem label="Paused"       value={protocol.paused === null ? '—' : protocol.paused ? 'Yes' : 'No'} />
          <StateItem label="LTV Ratio"    value={protocol.ltvRatio !== null ? `${(protocol.ltvRatio / 100).toFixed(0)}%` : '—'} />
          <StateItem label="Pool Balance" value={protocol.poolBalance !== null ? `${(protocol.poolBalance / 1e9).toLocaleString()} SUI` : '—'} />
        </div>
      </Card>

      {/* Object references */}
      <Card title="Permission Objects">
        <p className={styles.permNote}>
          Connect the wallet that holds your <strong>AdminCap</strong> to manage guardian permissions.
          The AdminCap lets you enable, disable, unpause, and reset LTV — nothing else.
        </p>
        <div className={styles.permGrid}>
          <PermRow label="GuardianConfig (shared)" id={GUARDIAN_CONFIG_ID} />
          <PermRow label="AdminCap (your wallet)"  id={ADMIN_CAP_ID} />
        </div>
      </Card>
    </div>
  );
}

function Threshold({ score, label, description, colour }) {
  return (
    <div className={styles.threshold}>
      <div className={styles.thresholdHeader}>
        <span className={styles.thresholdScore} style={{ color: colour }}>{score}</span>
        <div className={styles.thresholdTrack}>
          <div className={styles.thresholdFill} style={{ width: `${score}%`, background: colour }} />
        </div>
        <span className={styles.thresholdLabel} style={{ color: colour }}>{label}</span>
      </div>
      <p className={styles.thresholdDesc}>{description}</p>
    </div>
  );
}

function StateItem({ label, value }) {
  return (
    <div className={styles.stateItem}>
      <span className={styles.stateLabel}>{label}</span>
      <span className={styles.stateValue}>{value}</span>
    </div>
  );
}

function PermRow({ label, id }) {
  return (
    <div className={styles.permRow}>
      <span className={styles.permLabel}>{label}</span>
      <span className={styles.permId}>{id}</span>
    </div>
  );
}

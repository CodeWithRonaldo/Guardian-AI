import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import RiskGauge from '../../components/RiskGauge/RiskGauge';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import Card from '../../components/Card/Card';
import { useProtocol } from '../../hooks/useProtocol';
import { useActionLog } from '../../hooks/useActionLog';
import { useGuardianConfig } from '../../hooks/useGuardianConfig';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import { GUARDIAN_CONFIG_ID, PROTOCOL_ID, ACTION_LOG_ID } from '../../constants/contracts';
import styles from './Dashboard.module.css';

function formatBalance(mist) {
  if (mist === null) return '—';
  return (mist / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' SUI';
}

function formatLtv(bps) {
  if (bps === null) return '—';
  return (bps / 100).toFixed(0) + '%';
}

function protocolVariant(paused, score) {
  if (paused) return 'paused';
  if (score >= 70) return 'elevated';
  return 'active';
}

export default function Dashboard() {
  const protocol = useProtocol();
  const log      = useActionLog();
  const config   = useGuardianConfig();
  const backend  = useBackendStatus();

  // Use the real score from the backend engine when available.
  // Fall back to on-chain paused state if backend is unreachable.
  const riskScore = backend.score !== null
    ? backend.score
    : protocol.paused ? 88 : 0;

  // Chart data: last 20 action log entries as risk score history
  const chartData = useMemo(
    () => log.entries.slice(-20).map((e, i) => ({
      t: i,
      score: e.riskScore,
    })),
    [log.entries],
  );

  const pVariant = protocolVariant(protocol.paused, riskScore);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Risk Dashboard</h1>
          <p className={styles.subtitle}>Live protocol state — refreshes every 4s</p>
        </div>
        <StatusBadge
          variant={config.enabled === false ? 'offline' : pVariant}
          label={config.enabled === false ? 'Guardian Disabled' : undefined}
        />
      </div>

      <div className={styles.topRow}>
        {/* Risk gauge */}
        <Card className={styles.gaugeCard}>
          <div className={styles.gaugeWrap}>
            <RiskGauge score={riskScore} />
            <p className={styles.gaugeHint}>
              {riskScore < 50  && 'All signals within normal range.'}
              {riskScore >= 50 && riskScore < 70 && 'Anomaly detected — monitoring closely.'}
              {riskScore >= 70 && riskScore < 85 && 'LTV tightened autonomously.'}
              {riskScore >= 85 && 'Protocol paused by guardian.'}
            </p>
          </div>
        </Card>

        {/* Protocol stats */}
        <div className={styles.statsGrid}>
          <Stat label="Protocol" value={protocol.name ?? '—'} />
          <Stat label="Status" value={<StatusBadge variant={pVariant} />} raw />
          <Stat label="SUI/USD"      value={backend.price?.price ? `$${backend.price.price.toFixed(4)}` : '—'} mono />
          <Stat label="LTV Ratio"    value={formatLtv(protocol.ltvRatio)} mono />
          <Stat label="Pool Balance" value={formatBalance(protocol.poolBalance)} mono />
          <Stat label="Guardian"     value={config.enabled === null ? '—' : config.enabled ? 'Enabled' : 'Disabled'} />
          <Stat label="Log entries"  value={log.entryCount} mono />
        </div>
      </div>

      {/* Risk score history chart */}
      <Card title="Risk Score History" className={styles.chartCard}>
        {chartData.length === 0 ? (
          <p className={styles.empty}>No action log entries yet. Run a simulation to populate this chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <XAxis dataKey="t" hide />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={28} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--text-secondary)' }}
                itemStyle={{ color: 'var(--accent)' }}
                formatter={(v) => [v, 'Risk Score']}
                labelFormatter={() => ''}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--accent)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Latest action */}
      {log.latest && (
        <Card title="Last Guardian Action">
          <div className={styles.latestAction}>
            <div className={styles.latestRow}>
              <span className={styles.latestLabel}>Action</span>
              <span className={styles.latestValue}>{log.latest.actionLabel}</span>
            </div>
            <div className={styles.latestRow}>
              <span className={styles.latestLabel}>Risk Score</span>
              <span className={styles.latestValue}>{log.latest.riskScore}</span>
            </div>
            <div className={styles.latestRow}>
              <span className={styles.latestLabel}>Reason</span>
              <span className={styles.latestValue}>{log.latest.reason || '—'}</span>
            </div>
            <div className={styles.latestRow}>
              <span className={styles.latestLabel}>Time</span>
              <span className={styles.latestValue}>
                {new Date(log.latest.timestampMs).toLocaleString()}
              </span>
            </div>
            {backend.lastTxDigest && (
              <div className={styles.latestRow}>
                <span className={styles.latestLabel}>Transaction</span>
                <a
                  href={`https://suiscan.xyz/testnet/tx/${backend.lastTxDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.txLink}
                >
                  {backend.lastTxDigest.slice(0, 20)}… View on Sui Explorer →
                </a>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Object IDs reference */}
      <Card title="On-chain Objects" className={styles.idsCard}>
        <div className={styles.idsList}>
          <IdRow label="Protocol"       id={PROTOCOL_ID} />
          <IdRow label="Action Log"     id={ACTION_LOG_ID} />
          <IdRow label="Guardian Config" id={GUARDIAN_CONFIG_ID} />
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, mono, raw }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      {raw ? (
        <span className={styles.statValue}>{value}</span>
      ) : (
        <span className={`${styles.statValue} ${mono ? styles.mono : ''}`}>{value}</span>
      )}
    </div>
  );
}

function IdRow({ label, id }) {
  return (
    <div className={styles.idRow}>
      <span className={styles.idLabel}>{label}</span>
      <a
        href={`https://suiexplorer.com/object/${id}?network=testnet`}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.idValue}
      >
        {id}
      </a>
    </div>
  );
}

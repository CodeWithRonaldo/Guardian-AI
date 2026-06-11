import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import RiskGauge from '../../components/RiskGauge/RiskGauge';
import Card from '../../components/Card/Card';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import { RISK_THRESHOLDS, ACTION_LABELS, BACKEND_URL } from '../../constants/contracts';
import styles from './Simulation.module.css';

// Simulates the Cetus-style exploit pattern:
// price deviates sharply, pool drains rapidly, oracle goes stale.
const SCENARIO = [
  { second: 0,  priceDevPct: 0,   poolDropPct: 0,   oracleStale: false, label: 'Baseline' },
  { second: 3,  priceDevPct: 1.2, poolDropPct: 0,   oracleStale: false, label: '' },
  { second: 6,  priceDevPct: 3.5, poolDropPct: 2,   oracleStale: false, label: '' },
  { second: 9,  priceDevPct: 6.1, poolDropPct: 5,   oracleStale: false, label: '' },
  { second: 12, priceDevPct: 9.8, poolDropPct: 11,  oracleStale: true,  label: 'Oracle stale' },
  { second: 15, priceDevPct: 13,  poolDropPct: 18,  oracleStale: true,  label: '' },
  { second: 18, priceDevPct: 15,  poolDropPct: 25,  oracleStale: true,  label: '' },
  { second: 21, priceDevPct: 18,  poolDropPct: 32,  oracleStale: true,  label: 'Threshold: Tighten LTV' },
  { second: 24, priceDevPct: 20,  poolDropPct: 40,  oracleStale: true,  label: '' },
  { second: 27, priceDevPct: 22,  poolDropPct: 50,  oracleStale: true,  label: 'Threshold: Pause' },
  { second: 30, priceDevPct: 24,  poolDropPct: 58,  oracleStale: true,  label: '' },
];

function computeScore({ priceDevPct, poolDropPct, oracleStale }) {
  let score = 0;
  if (priceDevPct > 10)  score += 30;
  else if (priceDevPct > 3) score += Math.round(priceDevPct * 1.5);
  if (poolDropPct > 20)  score += 35;
  else if (poolDropPct > 5) score += Math.round(poolDropPct * 1.2);
  if (oracleStale)       score += 20;
  return Math.min(score, 100);
}

function actionForScore(score) {
  if (score >= RISK_THRESHOLDS.PAUSE)      return { code: 3, label: ACTION_LABELS[3] };
  if (score >= RISK_THRESHOLDS.TIGHTEN_LTV) return { code: 2, label: ACTION_LABELS[2] };
  if (score >= RISK_THRESHOLDS.NOTIFY)     return { code: 1, label: ACTION_LABELS[1] };
  return { code: 0, label: ACTION_LABELS[0] };
}

export default function Simulation() {
  const [running,    setRunning]    = useState(false);
  const [stepIdx,    setStepIdx]    = useState(0);
  const [history,    setHistory]    = useState([]);
  const [events,     setEvents]     = useState([]);
  const [finished,   setFinished]   = useState(false);
  const [txStatus,   setTxStatus]   = useState(null); // null | 'firing' | 'done' | 'error'
  const [txDigest,   setTxDigest]   = useState(null);
  const [txError,    setTxError]    = useState('');
  const timerRef    = useRef(null);
  const hasFiredRef = useRef(false);

  const currentStep = SCENARIO[Math.min(stepIdx, SCENARIO.length - 1)];
  const score = running || finished ? computeScore(currentStep) : 0;
  const action = actionForScore(score);

  useEffect(() => {
    if (!running) return;

    timerRef.current = setInterval(() => {
      setStepIdx((prev) => {
        const next = prev + 1;
        if (next >= SCENARIO.length) {
          setRunning(false);
          setFinished(true);
          clearInterval(timerRef.current);
          return prev;
        }
        const step  = SCENARIO[next];
        const sc    = computeScore(step);
        const act   = actionForScore(sc);

        setHistory((h) => [...h, { second: step.second, score: sc }]);

        if (act.code > 0) {
          setEvents((e) => [
            { second: step.second, score: sc, action: act.label, key: `${next}-${Date.now()}` },
            ...e,
          ]);
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [running]);

  // When score first crosses the pause threshold, fire the real on-chain tx
  useEffect(() => {
    if (!running && !finished) return;
    if (hasFiredRef.current)   return;
    if (!BACKEND_URL)          return;

    const step = SCENARIO[Math.min(stepIdx, SCENARIO.length - 1)];
    const sc   = computeScore(step);
    if (sc < RISK_THRESHOLDS.PAUSE) return;

    hasFiredRef.current = true;
    setTxStatus('firing');

    fetch(`${BACKEND_URL}/demo/inject`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        priceDevPct: step.priceDevPct,
        poolDropPct: step.poolDropPct,
        oracleStale: step.oracleStale,
      }),
      signal: AbortSignal.timeout(30_000),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setTxStatus('error');
          setTxError(data.error);
        } else {
          setTxStatus('done');
          setTxDigest(data.digest ?? null);
        }
      })
      .catch(err => {
        setTxStatus('error');
        setTxError(err.message);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, running, finished]);

  function start() {
    setStepIdx(0);
    setHistory([{ second: 0, score: 0 }]);
    setEvents([]);
    setFinished(false);
    setRunning(true);
  }

  function reset() {
    clearInterval(timerRef.current);
    setRunning(false);
    setFinished(false);
    setStepIdx(0);
    setHistory([]);
    setEvents([]);
    setTxStatus(null);
    setTxDigest(null);
    setTxError('');
    hasFiredRef.current = false;
    if (BACKEND_URL) {
      fetch(`${BACKEND_URL}/demo/reset`, { method: 'POST' }).catch(() => {});
    }
  }

  const protocolVariant = score >= 85 ? 'paused' : score >= 50 ? 'elevated' : 'active';

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Simulation</h1>
          <p className={styles.subtitle}>
            Replay a Cetus-style exploit pattern against the testnet protocol
          </p>
        </div>
        <div className={styles.controls}>
          {!running && !finished && (
            <button className={styles.btnRun} onClick={start}>▶ Run Simulation</button>
          )}
          {running && (
            <button className={styles.btnRun} disabled>Running…</button>
          )}
          {(running || finished) && (
            <button className={styles.btnReset} onClick={reset}>↺ Reset</button>
          )}
        </div>
      </div>

      <div className={styles.topRow}>
        {/* Live gauge */}
        <Card className={styles.gaugeCard}>
          <div className={styles.gaugeWrap}>
            <RiskGauge score={score} />
            <StatusBadge variant={!running && !finished ? 'offline' : protocolVariant} />
          </div>
        </Card>

        {/* Live signals */}
        <Card title="Live Signals" className={styles.signalsCard}>
          <div className={styles.signals}>
            <Signal
              label="Price Deviation"
              value={`${currentStep.priceDevPct.toFixed(1)}%`}
              active={running || finished}
              danger={currentStep.priceDevPct > 10}
            />
            <Signal
              label="Pool Drain"
              value={`${currentStep.poolDropPct.toFixed(0)}%`}
              active={running || finished}
              danger={currentStep.poolDropPct > 20}
            />
            <Signal
              label="Oracle Stale"
              value={currentStep.oracleStale ? 'Yes' : 'No'}
              active={running || finished}
              danger={currentStep.oracleStale}
            />
            <Signal
              label="Pending Action"
              value={running || finished ? action.label : '—'}
              active={running || finished}
              danger={action.code >= 3}
            />
          </div>
        </Card>
      </div>

      {/* Score chart */}
      <Card title="Risk Score Timeline">
        {history.length === 0 ? (
          <p className={styles.empty}>Press "Run Simulation" to start the demo scenario.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history}>
              <XAxis
                dataKey="second"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickFormatter={(s) => `${s}s`}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                width={28}
              />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--text-secondary)' }}
                itemStyle={{ color: 'var(--accent)' }}
                formatter={(v) => [v, 'Risk Score']}
                labelFormatter={(s) => `${s}s`}
              />
              <ReferenceLine y={RISK_THRESHOLDS.NOTIFY}      stroke="var(--warn)"   strokeDasharray="4 3" label={{ value: 'Notify', fill: 'var(--warn)',   fontSize: 11, position: 'right' }} />
              <ReferenceLine y={RISK_THRESHOLDS.TIGHTEN_LTV} stroke="var(--elev)"   strokeDasharray="4 3" label={{ value: 'Tighten', fill: 'var(--elev)', fontSize: 11, position: 'right' }} />
              <ReferenceLine y={RISK_THRESHOLDS.PAUSE}       stroke="var(--danger)" strokeDasharray="4 3" label={{ value: 'Pause',  fill: 'var(--danger)', fontSize: 11, position: 'right' }} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--accent)' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Event feed */}
      {events.length > 0 && (
        <Card title="Guardian Actions Fired">
          <div className={styles.events}>
            {events.map((e) => (
              <div key={e.key} className={styles.event}>
                <span className={styles.eventTime}>{e.second}s</span>
                <span className={styles.eventScore}>{e.score}</span>
                <span className={styles.eventAction}>{e.action}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* On-chain tx status */}
      {txStatus && (
        <div className={
          txStatus === 'done'  ? styles.txBannerDone  :
          txStatus === 'error' ? styles.txBannerError :
          styles.txBannerFiring
        }>
          {txStatus === 'firing' && (
            <>
              <span className={styles.txSpinner} />
              Submitting pause transaction to Sui testnet…
            </>
          )}
          {txStatus === 'done' && txDigest && (
            <>
              <span>✓ Pause confirmed on-chain</span>
              <a
                href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.txLink}
              >
                View on Sui Explorer →
              </a>
            </>
          )}
          {txStatus === 'done' && !txDigest && (
            <span>✓ Guardian processed the signal (score may not have crossed threshold in backend)</span>
          )}
          {txStatus === 'error' && (
            <span>⚠ {txError || 'Transaction failed — check backend logs.'}</span>
          )}
        </div>
      )}

      {finished && (
        <div className={styles.summary}>
          <span className={styles.summaryIcon}>✓</span>
          {txDigest
            ? 'Real on-chain pause submitted by the agent — no human clicked anything. Check the Action Log and Sui Explorer for proof.'
            : 'Simulation complete. In a real deployment, the guardian would have submitted these transactions on-chain within the same time window — before a human could even read the alert.'}
        </div>
      )}
    </div>
  );
}

function Signal({ label, value, active, danger }) {
  return (
    <div className={`${styles.signal} ${!active ? styles.signalIdle : danger ? styles.signalDanger : styles.signalOk}`}>
      <span className={styles.signalLabel}>{label}</span>
      <span className={styles.signalValue}>{value}</span>
    </div>
  );
}

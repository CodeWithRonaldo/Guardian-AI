import { useState, useEffect } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import Card from '../../components/Card/Card';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import { useGuardianConfig } from '../../hooks/useGuardianConfig';
import { useProtocol } from '../../hooks/useProtocol';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import {
  GUARDIAN_CONFIG_ID, ADMIN_CAP_ID, PACKAGE_ID, BACKEND_URL,
} from '../../constants/contracts';
import styles from './Configuration.module.css';

const DEFAULTS = {
  thresholds:    { notify: 50, tightenLtv: 70, pause: 85 },
  ltvTightenBps: 500,
  webhookUrl:    '',
};

const STORAGE_KEY = 'guardian_ai_config';

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function validateThresholds(t) {
  const errors = {};
  if (t.notify  >= t.tightenLtv) errors.tightenLtv = 'Must be higher than Notify';
  if (t.tightenLtv >= t.pause)   errors.pause      = 'Must be higher than Tighten LTV';
  if (t.notify < 1)              errors.notify     = 'Must be at least 1';
  if (t.pause  > 99)             errors.pause      = 'Must be 99 or below';
  return errors;
}

export default function Configuration() {
  const config   = useGuardianConfig();
  const protocol = useProtocol();
  const backend  = useBackendStatus();
  const account  = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const saved = loadSaved();
  const [values, setValues] = useState({
    thresholds:    saved?.thresholds    ?? DEFAULTS.thresholds,
    ltvTightenBps: saved?.ltvTightenBps ?? DEFAULTS.ltvTightenBps,
    webhookUrl:    saved?.webhookUrl    ?? DEFAULTS.webhookUrl,
  });

  const [isDirty,      setIsDirty]      = useState(false);
  const [saveStatus,   setSaveStatus]   = useState(null); // null|'saving'|'success'|'error'
  const [saveError,    setSaveError]    = useState('');
  const [toggleStatus, setToggleStatus] = useState(null); // null|'pending'|'success'|'error'
  const [toggleError,  setToggleError]  = useState('');

  // On first backend contact: if localStorage has saved values that differ from
  // what the backend is running (e.g. after a Render restart), auto-re-push them.
  useEffect(() => {
    const localSave = loadSaved();
    if (!backend.config || !BACKEND_URL) return;

    if (!localSave) {
      // No local save — pull backend values into UI
      setValues(prev => ({
        ...prev,
        thresholds:    backend.config.thresholds    ?? prev.thresholds,
        ltvTightenBps: backend.config.ltvTightenBps ?? prev.ltvTightenBps,
      }));
      return;
    }

    // Local save exists — check if backend drifted (e.g. after restart)
    const backendT = backend.config.thresholds ?? {};
    const localT   = localSave.thresholds ?? {};
    const drifted  =
      backendT.notify     !== localT.notify      ||
      backendT.tightenLtv !== localT.tightenLtv  ||
      backendT.pause      !== localT.pause        ||
      backend.config.ltvTightenBps !== localSave.ltvTightenBps;

    if (drifted) {
      // Silently re-push local config to backend
      fetch(`${BACKEND_URL}/config`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          thresholds:    localSave.thresholds,
          ltvTightenBps: localSave.ltvTightenBps,
          webhookUrl:    localSave.webhookUrl ?? '',
        }),
      }).catch(() => {}); // non-fatal
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend.config]);

  const thresholdErrors = validateThresholds(values.thresholds);
  const hasErrors = Object.keys(thresholdErrors).length > 0;

  // ── Change handlers ──────────────────────────────────────────────────────
  function setThreshold(key, raw) {
    const val = Math.max(1, Math.min(99, Number(raw)));
    setValues(prev => ({ ...prev, thresholds: { ...prev.thresholds, [key]: val } }));
    setIsDirty(true);
    setSaveStatus(null);
  }

  function setField(key, val) {
    setValues(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);
    setSaveStatus(null);
  }

  // ── Save all config ──────────────────────────────────────────────────────
  async function handleSave() {
    if (hasErrors) return;
    setSaveStatus('saving');
    setSaveError('');

    try {
      const res = await fetch(`${BACKEND_URL}/config`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          thresholds:    values.thresholds,
          ltvTightenBps: values.ltvTightenBps,
          webhookUrl:    values.webhookUrl,
        }),
        signal: AbortSignal.timeout(8_000),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      setIsDirty(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err.message);
    }
  }

  function handleReset() {
    setValues(DEFAULTS);
    setIsDirty(true);
    setSaveStatus(null);
  }

  // ── On-chain guardian toggle ─────────────────────────────────────────────
  async function handleToggle() {
    if (!account) return;
    const isEnabled = config.enabled;
    setToggleStatus('pending');
    setToggleError('');

    try {
      const tx = new Transaction();
      tx.moveCall({
        target:    `${PACKAGE_ID}::cap::${isEnabled ? 'disable' : 'enable'}`,
        arguments: [
          tx.object(ADMIN_CAP_ID),
          tx.object(GUARDIAN_CONFIG_ID),
        ],
      });

      await signAndExecute({ transaction: tx });

      setToggleStatus('success');
      setTimeout(() => {
        setToggleStatus(null);
        config.refetch?.();
      }, 2000);
    } catch (err) {
      setToggleStatus('error');
      setToggleError(err.message?.includes('owned') ? 'Wrong wallet — connect the AdminCap wallet.' : err.message);
    }
  }

  const guardianOn = config.enabled ?? false;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Configuration</h1>
          <p className={styles.subtitle}>Guardian thresholds, actions, and on-chain permissions</p>
        </div>
      </div>

      {/* ── Guardian on/off ── */}
      <Card title="Guardian Status">
        <div className={styles.toggleRow}>
          <div className={styles.toggleInfo}>
            <p className={styles.statusDesc}>
              The guardian is currently{' '}
              <strong style={{ color: guardianOn ? 'var(--safe)' : 'var(--danger)' }}>
                {config.isPending ? 'loading…' : guardianOn ? 'active' : 'disabled'}
              </strong>.
              {guardianOn
                ? ' Disable it to immediately stop all autonomous actions.'
                : ' Enable it to restore autonomous protection.'}
            </p>
            {config.agentAddress && (
              <p className={styles.addressLine}>
                Agent wallet: <span className={styles.mono}>{config.agentAddress}</span>
              </p>
            )}
            {toggleStatus === 'error' && (
              <p className={styles.toggleError}>{toggleError}</p>
            )}
          </div>

          <div className={styles.toggleRight}>
            <StatusBadge variant={guardianOn ? 'active' : 'offline'} />
            {!account ? (
              <p className={styles.connectHint}>Connect AdminCap wallet to toggle</p>
            ) : (
              <button
                className={`${styles.btnToggle} ${guardianOn ? styles.btnToggleDisable : styles.btnToggleEnable}`}
                onClick={handleToggle}
                disabled={toggleStatus === 'pending' || config.isPending}
              >
                {toggleStatus === 'pending'
                  ? 'Confirm in wallet…'
                  : toggleStatus === 'success'
                  ? '✓ Done'
                  : guardianOn ? 'Disable guardian' : 'Enable guardian'}
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Risk thresholds ── */}
      <Card
        title="Risk Thresholds"
        action={
          <div className={styles.saveRow}>
            {saveStatus === 'success' && <span className={styles.savedMsg}>✓ Saved</span>}
            {saveStatus === 'error'   && <span className={styles.errorMsg}>{saveError}</span>}
            <button className={styles.btnReset} onClick={handleReset}>Reset</button>
            <button
              className={`${styles.btnSave} ${hasErrors || !isDirty ? styles.btnDisabled : ''}`}
              onClick={handleSave}
              disabled={hasErrors || !isDirty || saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save to guardian'}
            </button>
          </div>
        }
      >
        <p className={styles.sectionIntro}>
          The engine scores risk 0–100 every 4 seconds. Set what score triggers each action.
        </p>

        <div className={styles.sliders}>
          <ThresholdSlider
            label="Notify"
            description="Alert the team via webhook. No on-chain action."
            colour="var(--warn)"
            value={values.thresholds.notify}
            min={1}
            max={values.thresholds.tightenLtv - 1}
            error={thresholdErrors.notify}
            onChange={v => setThreshold('notify', v)}
          />
          <ThresholdSlider
            label="Tighten LTV"
            description="Reduce LTV ratio via autonomous on-chain transaction to limit borrowing exposure."
            colour="var(--elev)"
            value={values.thresholds.tightenLtv}
            min={values.thresholds.notify + 1}
            max={values.thresholds.pause - 1}
            error={thresholdErrors.tightenLtv}
            onChange={v => setThreshold('tightenLtv', v)}
          />
          <ThresholdSlider
            label="Pause Protocol"
            description="Halt all protocol activity autonomously. Admin can unpause at any time."
            colour="var(--danger)"
            value={values.thresholds.pause}
            min={values.thresholds.tightenLtv + 1}
            max={99}
            error={thresholdErrors.pause}
            onChange={v => setThreshold('pause', v)}
          />
        </div>

        <div className={styles.rangeSummary}>
          <RangeBar label="Silent"      from={0}                          to={values.thresholds.notify - 1}      colour="var(--text-muted)" />
          <RangeBar label="Notify"      from={values.thresholds.notify}      to={values.thresholds.tightenLtv - 1} colour="var(--warn)" />
          <RangeBar label="Tighten LTV" from={values.thresholds.tightenLtv}  to={values.thresholds.pause - 1}      colour="var(--elev)" />
          <RangeBar label="Pause"       from={values.thresholds.pause}        to={100}                              colour="var(--danger)" />
        </div>
      </Card>

      {/* ── Autonomous action settings ── */}
      <Card title="Action Settings">
        <p className={styles.sectionIntro}>
          Control how aggressively the guardian acts when thresholds are crossed.
        </p>

        <div className={styles.actionSettings}>
          <div className={styles.actionField}>
            <div className={styles.actionFieldLabel}>
              <span className={styles.actionFieldTitle}>LTV Tighten Amount</span>
              <span className={styles.actionFieldDesc}>
                Basis points to reduce LTV ratio when the Tighten LTV threshold is crossed.
                100 bps = 1%. Default is 500 bps (5%).
              </span>
            </div>
            <div className={styles.bpsInputWrap}>
              <input
                type="number"
                className={styles.bpsInput}
                value={values.ltvTightenBps}
                min={100}
                max={5000}
                step={100}
                onChange={e => setField('ltvTightenBps', Number(e.target.value))}
              />
              <span className={styles.bpsUnit}>bps</span>
              <span className={styles.bpsPct}>
                = {(values.ltvTightenBps / 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Notifications ── */}
      <Card title="Notifications">
        <p className={styles.sectionIntro}>
          The guardian POSTs a JSON alert to this URL when the risk score crosses the Notify
          threshold. Works with Discord webhooks, Slack, Telegram bots, or any HTTP endpoint.
        </p>

        <div className={styles.webhookField}>
          <label className={styles.webhookLabel}>Webhook URL</label>
          <input
            type="url"
            className={styles.webhookInput}
            placeholder="https://discord.com/api/webhooks/... or any HTTPS endpoint"
            value={values.webhookUrl}
            onChange={e => setField('webhookUrl', e.target.value)}
          />
          {values.webhookUrl && !values.webhookUrl.startsWith('http') && (
            <p className={styles.fieldError}>Must be a valid HTTP/HTTPS URL</p>
          )}
          <p className={styles.webhookHint}>
            Leave blank to disable notifications. The payload includes risk score, reason, and active signals.
          </p>
        </div>
      </Card>

      {/* ── Live protocol state ── */}
      <Card title="Live Protocol State">
        <div className={styles.stateGrid}>
          <StateItem label="Paused"       value={protocol.paused === null ? '—' : protocol.paused ? 'Yes' : 'No'} />
          <StateItem label="LTV Ratio"    value={protocol.ltvRatio !== null ? `${(protocol.ltvRatio / 100).toFixed(0)}%` : '—'} />
          <StateItem label="Pool Balance" value={protocol.poolBalance !== null ? `${(protocol.poolBalance / 1e9).toLocaleString()} SUI` : '—'} />
        </div>
      </Card>

      {/* ── Permission objects ── */}
      <Card title="Permission Objects">
        <p className={styles.permNote}>
          The <strong>AdminCap</strong> is the only key that can enable, disable, unpause,
          and reset LTV. Keep it in a secure wallet.
        </p>
        <div className={styles.permGrid}>
          <PermRow label="GuardianConfig (shared)" id={GUARDIAN_CONFIG_ID} />
          <PermRow label="AdminCap (your wallet)"  id={ADMIN_CAP_ID} />
        </div>
      </Card>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ThresholdSlider({ label, description, colour, value, min, max, error, onChange }) {
  const fillPct = ((value - 1) / 98) * 100;
  return (
    <div className={styles.sliderBlock}>
      <div className={styles.sliderHeader}>
        <div className={styles.sliderLeft}>
          <span className={styles.sliderLabel} style={{ color: colour }}>{label}</span>
          <span className={styles.sliderDesc}>{description}</span>
        </div>
        <input
          type="number"
          className={styles.sliderNumber}
          style={{ color: colour, borderColor: colour + '55' }}
          value={value}
          min={min}
          max={max}
          onChange={e => onChange(e.target.value)}
        />
      </div>
      <div className={styles.sliderTrackWrap}>
        <input
          type="range"
          className={styles.sliderInput}
          min={min}
          max={max}
          value={value}
          style={{ '--fill': colour, '--fill-pct': `${fillPct}%` }}
          onChange={e => onChange(e.target.value)}
        />
        <div className={styles.sliderTicks}>
          {[0, 25, 50, 75, 100].map(t => (
            <span key={t} className={styles.sliderTick}>{t}</span>
          ))}
        </div>
      </div>
      {error && <p className={styles.sliderError}>{error}</p>}
    </div>
  );
}

function RangeBar({ label, from, to, colour }) {
  const width = Math.max(0, to - from + 1);
  return (
    <div className={styles.rangeBar} style={{ flex: width }}>
      <div className={styles.rangeBarFill} style={{ background: colour, opacity: 0.15 }} />
      <span className={styles.rangeBarLabel} style={{ color: colour }}>{label}</span>
      <span className={styles.rangeBarRange}>{from}–{to}</span>
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

import styles from './Docs.module.css';

const SECTIONS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'limitations',   label: 'Limitations' },
  { id: 'architecture',  label: 'Architecture' },
  { id: 'risk-scoring',  label: 'Risk Scoring' },
  { id: 'integration',   label: 'Integration Guide' },
  { id: 'contracts',     label: 'Contract Reference' },
  { id: 'api',           label: 'Backend API' },
  { id: 'config-ref',    label: 'Configuration' },
  { id: 'security',      label: 'Security Model' },
  { id: 'deployed',      label: 'Deployed Contracts' },
];

export default function Docs() {
  return (
    <div className={styles.page}>
      <div className={styles.layout}>

        {/* ── Sticky TOC ── */}
        <aside className={styles.toc}>
          <p className={styles.tocTitle}>On this page</p>
          <nav>
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`} className={styles.tocLink}>{s.label}</a>
            ))}
          </nav>
        </aside>

        {/* ── Main content ── */}
        <article className={styles.content}>

          {/* OVERVIEW */}
          <section id="overview">
            <h1 className={styles.h1}>GuardianAI Documentation</h1>
            <p className={styles.lead}>
              An autonomous on-chain risk guardian for DeFi protocols built on the Sui blockchain.
              GuardianAI watches Pyth price feeds and on-chain events, scores risk continuously,
              and fires protective circuit-breaker transactions autonomously — faster than any
              human response chain.
            </p>

            <h2 className={styles.h2}>The Problem</h2>
            <p>
              In October 2025, the Cetus DEX on Sui was exploited for $60 million. The contracts
              were not broken — the response was too slow. By the time the team identified the
              incident and could act, liquidity had already been drained.
            </p>
            <p>
              Most DeFi protocols have emergency pause functions. None of them trigger automatically.
              GuardianAI closes that gap.
            </p>

            <h2 className={styles.h2}>What it does</h2>
            <ul className={styles.list}>
              <li>Monitors Pyth oracle price feeds every 3 seconds</li>
              <li>Reads on-chain protocol state every 4 seconds</li>
              <li>Computes a weighted risk score from 0–100</li>
              <li>Autonomously fires on-chain transactions when thresholds are crossed</li>
              <li>Sends webhook alerts to Telegram, Discord, or any HTTP endpoint</li>
              <li>Writes every action to an immutable on-chain audit log</li>
              <li>Stores full diagnostic snapshots on Walrus for permanent records</li>
            </ul>
          </section>

          <Divider />

          {/* LIMITATIONS */}
          <section id="limitations">
            <h2 className={styles.h2}>Honest Limitations</h2>
            <p>
              GuardianAI is a powerful tool but not a silver bullet. Understanding what it
              cannot do is as important as understanding what it can.
            </p>

            <h3 className={styles.h3}>It cannot stop the first polling window</h3>
            <p>
              The risk engine polls on-chain state every 4 seconds. If an attacker drains
              a pool in under 4 seconds, that drain happens before the first detection cycle.
              GuardianAI cannot prevent damage that occurs faster than its polling interval.
            </p>
            <p>
              What it <em>can</em> do is stop everything after that window. On Sui, most
              real exploits involve multiple sequential transactions — flash loan, price
              manipulation, drain, exit. Pausing the protocol mid-sequence breaks the exit
              path and protects remaining liquidity.
            </p>

            <h3 className={styles.h3}>Single signals may not be enough to trigger pause</h3>
            <p>
              A pool drop of 20% in one interval scores 35 points — below the pause threshold
              of 85. The system is designed around <em>combined</em> signals: price deviation
              plus pool drop plus oracle staleness is how a real exploit looks. A 20% pool drop
              combined with Pyth price stress and a stale oracle reaches 85 and triggers pause.
            </p>
            <p>
              The <Code>poolAbsLow</Code> signal (pool ≤5% of baseline → 90 points) is a
              last-resort catch for catastrophic drain, not the primary protection mechanism.
              It exists to protect against the case where the backend was down during the
              initial attack and missed the delta signals.
            </p>

            <h3 className={styles.h3}>It is not pre-crime prevention</h3>
            <p>
              GuardianAI reacts to anomalies it can observe — price, pool balance, oracle
              freshness. It cannot detect novel attack vectors, governance exploits, or
              vulnerabilities in contract logic before they are triggered.
            </p>

            <h3 className={styles.h3}>The backend is a centralised component</h3>
            <p>
              The off-chain risk engine is a centralised process. If it goes down, autonomous
              responses stop. The on-chain contracts remain functional — any wallet holding a
              GuardianCap can still call circuit breakers manually. For production deployments,
              running multiple backend instances with health monitoring is recommended.
            </p>

            <h3 className={styles.h3}>Why it is still valuable</h3>
            <p>
              The Cetus hack played out over <em>minutes</em> — not milliseconds. Human
              response chains require someone to notice the exploit, verify it is real,
              coordinate with the team, connect a wallet, and submit a transaction. GuardianAI
              collapses that chain to one polling cycle. In a real attack combining price
              deviation, pool drain, and oracle stress, the protocol pauses within 4–8 seconds
              — with the majority of liquidity still intact.
            </p>
          </section>

          <Divider />

          {/* ARCHITECTURE */}
          <section id="architecture">
            <h2 className={styles.h2}>Architecture</h2>
            <p>GuardianAI has three layers. Each layer has a clear boundary and can be audited independently.</p>

            <h3 className={styles.h3}>Layer 1 — Move Contracts (on-chain trust layer)</h3>
            <ul className={styles.list}>
              <li><Code>guardian_ai::cap</Code> — defines <Code>GuardianCap</Code> (agent permission) and <Code>AdminCap</Code> (human override). The capability pattern means the agent's permissions are type-enforced by the Move VM, not by application logic.</li>
              <li><Code>guardian_ai::action_log</Code> — a shared append-only object. Every action the guardian takes is written here permanently with a timestamp, risk score, and reason.</li>
              <li><Code>guardian_ai::test_protocol</Code> — a mock DeFi protocol used for testnet demos. In production this is replaced by the integrating protocol's own contract.</li>
            </ul>

            <h3 className={styles.h3}>Layer 2 — Risk Engine (off-chain autonomous agent)</h3>
            <ul className={styles.list}>
              <li>Node.js backend — polls Pyth Hermes API for SUI/USD price feeds</li>
              <li>Subscribes to Sui on-chain events via RPC</li>
              <li>Runs a rule-based weighted scorer every 4 seconds</li>
              <li>Builds and signs Programmable Transaction Blocks using the agent keypair</li>
              <li>Sends webhook notifications for alert-level events</li>
              <li>Stores audit blobs on Walrus after every on-chain action</li>
            </ul>

            <h3 className={styles.h3}>Layer 3 — Dashboard (visibility and control)</h3>
            <ul className={styles.list}>
              <li>React + Vite frontend</li>
              <li>Live risk gauge updated every 4 seconds from the backend engine</li>
              <li>Action Log — reads directly from the on-chain ActionLog object</li>
              <li>Configuration — adjust thresholds live, they take effect immediately</li>
              <li>Guardian toggle — enable/disable the agent with one on-chain transaction</li>
            </ul>

            <h3 className={styles.h3}>Data flow</h3>
            <CodeBlock>{`Pyth Hermes API ──► Risk Engine ──► score < 50  → log only
Sui RPC (chain)  ──►  (Node.js)  ──► score ≥ 50  → webhook alert
                                 ──► score ≥ 70  → tighten_ltv tx
                                 ──► score ≥ 85  → pause_protocol tx
                                              │
                                              ▼
                                   ActionLog (on-chain)
                                   Walrus audit blob
                                   Dashboard update`}</CodeBlock>
          </section>

          <Divider />

          {/* RISK SCORING */}
          <section id="risk-scoring">
            <h2 className={styles.h2}>Risk Scoring</h2>
            <p>
              The risk engine computes a score from 0–100 every 4 seconds using a weighted
              rule-based system. Scores are additive and capped at 100. The approach is
              intentionally rule-based rather than ML — every decision is fully auditable
              and explainable.
            </p>

            <h3 className={styles.h3}>Signals and weights</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Condition</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Price deviation (large)</td><td>Pyth price &gt;10% from TWAP</td><td className={styles.scoreCell}>30</td></tr>
                <tr><td>Price deviation (small)</td><td>Pyth price 3–10% from TWAP</td><td className={styles.scoreCell}>15</td></tr>
                <tr><td>Oracle stale</td><td>Pyth publish_time &gt;30s ago</td><td className={styles.scoreCell}>20</td></tr>
                <tr><td>Pool drop (catastrophic)</td><td>Pool dropped &gt;50% in one 4s window</td><td className={styles.scoreCell}>55</td></tr>
                <tr><td>Pool drop (large)</td><td>Pool dropped &gt;20% in one 4s window</td><td className={styles.scoreCell}>35</td></tr>
                <tr><td>Pool drop (small)</td><td>Pool dropped &gt;5% in one 4s window</td><td className={styles.scoreCell}>15</td></tr>
                <tr><td>Pool critically low</td><td>Pool balance ≤5% of baseline (last resort)</td><td className={styles.scoreCell}>90</td></tr>
                <tr><td>Already paused</td><td>Protocol paused flag set on-chain</td><td className={styles.scoreCell}>10</td></tr>
              </tbody>
            </table>

            <p>
              Scores are additive and capped at 100. Pool drop signals are based on the
              delta between polls — how much the balance changed in the last 4-second window,
              not the total amount drained since launch. <Code>poolAbsLow</Code> is the
              exception — it checks the absolute balance and acts as a last resort when the
              backend restarts after a drain has already happened.
            </p>

            <h3 className={styles.h3}>Example score combinations that trigger pause (≥ 85)</h3>
            <table className={styles.table}>
              <thead>
                <tr><th>Scenario</th><th>Signals</th><th>Score</th></tr>
              </thead>
              <tbody>
                <tr><td>Full exploit (price + pool + oracle)</td><td>30 + 35 + 20</td><td>85</td></tr>
                <tr><td>Flash drain + price stress</td><td>55 + 30</td><td>85</td></tr>
                <tr><td>Pool critically low alone</td><td>90</td><td>90</td></tr>
              </tbody>
            </table>

            <h3 className={styles.h3}>Default thresholds</h3>
            <table className={styles.table}>
              <thead>
                <tr><th>Score range</th><th>Action</th><th>On-chain?</th></tr>
              </thead>
              <tbody>
                <tr><td>0 – 49</td><td>Log only</td><td>No</td></tr>
                <tr><td>50 – 69</td><td>Webhook alert (Telegram / Discord)</td><td>No</td></tr>
                <tr><td>70 – 84</td><td>Tighten LTV ratio</td><td>Yes</td></tr>
                <tr><td>85 – 100</td><td>Pause protocol</td><td>Yes</td></tr>
              </tbody>
            </table>
            <p>All thresholds are configurable in real time from the Configuration panel without restarting the backend.</p>
          </section>

          <Divider />

          {/* INTEGRATION */}
          <section id="integration">
            <h2 className={styles.h2}>Integration Guide</h2>
            <p>
              Integrating GuardianAI into your protocol requires three things: adding circuit
              breaker functions to your Move contract, initialising the guardian objects, and
              running the backend agent pointed at your protocol.
            </p>

            <h3 className={styles.h3}>Step 1 — Add circuit breakers to your Move contract</h3>
            <p>
              Your contract needs to accept <Code>GuardianCap</Code> as a parameter in the
              functions you want the agent to call. The <Code>assert_active</Code> call
              enforces the enabled flag — if the admin disables the guardian, this aborts.
            </p>
            <CodeBlock>{`use guardian_ai::cap::{Self, GuardianCap, GuardianConfig};
use guardian_ai::action_log::{Self, ActionLog};
use sui::clock::Clock;
use std::string::String;

/// Called by the agent when risk score >= pause threshold.
public fun pause_protocol(
    cap:        &GuardianCap,
    config:     &GuardianConfig,
    protocol:   &mut YourProtocol,   // your protocol object
    log:        &mut ActionLog,
    clock:      &Clock,
    risk_score: u8,
    reason:     String,
) {
    cap::assert_active(cap, config);  // aborts if guardian is disabled
    protocol.paused = true;
    action_log::append(log, clock, risk_score, action_log::pause(), reason);
}

/// Called by the agent when risk score >= tighten threshold.
public fun tighten_ltv(
    cap:        &GuardianCap,
    config:     &GuardianConfig,
    protocol:   &mut YourProtocol,
    log:        &mut ActionLog,
    clock:      &Clock,
    new_ltv:    u64,
    risk_score: u8,
    reason:     String,
) {
    cap::assert_active(cap, config);
    assert!(new_ltv < protocol.ltv_ratio, EInvalidLtv);
    protocol.ltv_ratio = new_ltv;
    action_log::append(log, clock, risk_score, action_log::tighten_ltv(), reason);
}`}</CodeBlock>

            <p>
              Add the guardian_ai package as a dependency in your <Code>Move.toml</Code>:
            </p>
            <CodeBlock>{`[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "testnet" }
guardian_ai = { local = "../guardian_ai" }
# or once published:
# guardian_ai = { git = "...", rev = "..." }`}</CodeBlock>

            <h3 className={styles.h3}>Step 2 — Initialise the guardian</h3>
            <p>
              Call <Code>guardian_ai::cap::initialize</Code> once from the protocol team wallet.
              This creates three objects:
            </p>
            <ul className={styles.list}>
              <li><Code>GuardianCap</Code> — transferred to the agent wallet address you provide</li>
              <li><Code>AdminCap</Code> — transferred to the transaction sender (you)</li>
              <li><Code>GuardianConfig</Code> — shared, readable by anyone on-chain</li>
            </ul>
            <CodeBlock>{`# Replace AGENT_WALLET_ADDRESS with your backend agent wallet
sui client call \\
  --package <GUARDIAN_AI_PACKAGE_ID> \\
  --module cap \\
  --function initialize \\
  --args <AGENT_WALLET_ADDRESS> \\
  --gas-budget 10000000`}</CodeBlock>

            <p>Also create the shared ActionLog:</p>
            <CodeBlock>{`sui client call \\
  --package <GUARDIAN_AI_PACKAGE_ID> \\
  --module action_log \\
  --function create_and_share \\
  --gas-budget 10000000`}</CodeBlock>

            <h3 className={styles.h3}>Step 3 — Run the backend</h3>
            <p>Clone the repository and create a <Code>.env</Code> file in <Code>backend/</Code>:</p>
            <CodeBlock>{`AGENT_PRIVATE_KEY=suiprivkey1...      # agent wallet private key
PACKAGE_ID=0x...                      # guardian_ai package ID
PROTOCOL_ID=0x...                     # your Protocol shared object ID
ACTION_LOG_ID=0x...                   # ActionLog shared object ID
GUARDIAN_CONFIG_ID=0x...              # GuardianConfig shared object ID
GUARDIAN_CAP_ID=0x...                 # GuardianCap object ID
SUI_RPC_URL=https://fullnode.testnet.sui.io:443`}</CodeBlock>

            <CodeBlock>{`cd backend
npm install
node src/index.js`}</CodeBlock>

            <p>
              The backend exposes a health endpoint at <Code>http://localhost:3000/health</Code>.
              Deploy to any Node.js host (Render, Railway, Fly.io). The agent wallet needs a
              small amount of SUI for gas — a few SUI is enough for thousands of transactions.
            </p>

            <h3 className={styles.h3}>Step 4 — Connect the dashboard</h3>
            <p>Create a <Code>.env</Code> file in the project root:</p>
            <CodeBlock>{`VITE_PACKAGE_ID=0x...
VITE_PROTOCOL_ID=0x...
VITE_ACTION_LOG_ID=0x...
VITE_GUARDIAN_CONFIG_ID=0x...
VITE_ADMIN_CAP_ID=0x...
VITE_GUARDIAN_CAP_ID=0x...
VITE_BACKEND_URL=https://your-backend.onrender.com
VITE_NETWORK=testnet`}</CodeBlock>

            <CodeBlock>{`npm install
npm run dev      # development
npm run build    # production build`}</CodeBlock>

            <h3 className={styles.h3}>Step 5 — Configure thresholds</h3>
            <p>
              Open the Configuration panel. Adjust the Notify, Tighten LTV, and Pause
              thresholds to match your protocol's risk tolerance. Click{' '}
              <strong>Save to guardian</strong> — the backend updates in real time with no
              restart needed.
            </p>
            <p>
              Optionally add a Telegram or Discord webhook URL to receive instant alerts
              when the notify threshold is crossed.
            </p>
          </section>

          <Divider />

          {/* CONTRACT REFERENCE */}
          <section id="contracts">
            <h2 className={styles.h2}>Move Contract Reference</h2>

            <h3 className={styles.h3}>guardian_ai::cap</h3>
            <p>Defines the capability objects and guardian lifecycle.</p>
            <table className={styles.table}>
              <thead><tr><th>Item</th><th>Type</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><Code>GuardianCap</Code></td><td>Owned object</td><td>Held by the agent wallet. Required parameter for all circuit breaker calls.</td></tr>
                <tr><td><Code>AdminCap</Code></td><td>Owned object</td><td>Held by the protocol team. Required to enable, disable, unpause, and reset.</td></tr>
                <tr><td><Code>GuardianConfig</Code></td><td>Shared object</td><td>Tracks enabled state and agent address. Readable by anyone on-chain.</td></tr>
                <tr><td><Code>initialize(agent, ctx)</Code></td><td>Function</td><td>One-time setup. Creates and distributes all three objects.</td></tr>
                <tr><td><Code>enable(admin, config)</Code></td><td>Function</td><td>Re-arms the guardian after a manual disable.</td></tr>
                <tr><td><Code>disable(admin, config)</Code></td><td>Function</td><td>Instantly disarms the guardian. Agent can no longer call circuit breakers.</td></tr>
                <tr><td><Code>assert_active(cap, config)</Code></td><td>Function</td><td>Called at the top of every circuit breaker. Aborts if guardian is disabled.</td></tr>
              </tbody>
            </table>

            <h3 className={styles.h3}>guardian_ai::action_log</h3>
            <p>Append-only shared object. Every guardian action is written here permanently.</p>
            <table className={styles.table}>
              <thead><tr><th>Item</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><Code>ActionLog</Code></td><td>Shared object. Contains a vector of entries.</td></tr>
                <tr><td><Code>create_and_share(ctx)</Code></td><td>Entry function — creates and shares the log in one transaction.</td></tr>
                <tr><td><Code>append(log, clock, score, action, reason)</Code></td><td>Appends a new entry. Called from circuit breaker functions.</td></tr>
                <tr><td>Action codes</td><td>0 = log, 1 = notify, 2 = tighten_ltv, 3 = pause, 4 = unpause</td></tr>
              </tbody>
            </table>

            <h3 className={styles.h3}>guardian_ai::test_protocol</h3>
            <p>
              A minimal mock protocol for testnet demos and integration testing. Shows exactly
              what a real protocol needs to add. Not intended for production use.
            </p>
            <table className={styles.table}>
              <thead><tr><th>Function</th><th>Caller</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><Code>pause_protocol</Code></td><td>GuardianCap</td><td>Sets paused = true, writes to ActionLog.</td></tr>
                <tr><td><Code>tighten_ltv</Code></td><td>GuardianCap</td><td>Reduces LTV ratio, writes to ActionLog.</td></tr>
                <tr><td><Code>unpause_protocol</Code></td><td>AdminCap</td><td>Resumes normal operation.</td></tr>
                <tr><td><Code>reset_ltv</Code></td><td>AdminCap</td><td>Resets LTV to any value after normalisation.</td></tr>
                <tr><td><Code>simulate_pool_drain</Code></td><td>AdminCap</td><td>Sets pool balance directly. Used for demo scenarios.</td></tr>
              </tbody>
            </table>
          </section>

          <Divider />

          {/* API REFERENCE */}
          <section id="api">
            <h2 className={styles.h2}>Backend API Reference</h2>
            <p>
              The backend exposes a small HTTP API used by the dashboard and for external
              integration. All endpoints return JSON.
            </p>

            <h3 className={styles.h3}>GET /health</h3>
            <p>Liveness check. Returns current guardian state and latest risk score.</p>
            <CodeBlock>{`{ "status": "ok", "guardianEnabled": true, "latestScore": 12 }`}</CodeBlock>

            <h3 className={styles.h3}>GET /status</h3>
            <p>Full runtime state — used by the dashboard to poll live data.</p>
            <CodeBlock>{`{
  "score": 12,
  "guardian": true,
  "lastTxDigest": "AbCd...",
  "price": { "price": 3.1240, "twap": 3.1180, "deviationPct": 0.19, "isStale": false },
  "chain": { "poolBalance": 10000000000000, "ltvRatio": 8000, "paused": false, "poolDropPct": 0 },
  "thresholds": { "notify": 50, "tightenLtv": 70, "pause": 85 },
  "config": { "thresholds": {...}, "ltvTightenBps": 500, "webhookUrl": "(set)" }
}`}</CodeBlock>

            <h3 className={styles.h3}>POST /config</h3>
            <p>Update runtime thresholds, LTV tighten amount, and webhook URL. Takes effect immediately.</p>
            <CodeBlock>{`// Request body
{
  "thresholds": { "notify": 50, "tightenLtv": 70, "pause": 85 },
  "ltvTightenBps": 500,
  "webhookUrl": "telegram://BOT_TOKEN/CHAT_ID"
}`}</CodeBlock>
            <p>Validation: <Code>notify &lt; tightenLtv &lt; pause</Code>, all values 1–99. <Code>ltvTightenBps</Code> must be 100–5000.</p>

            <h3 className={styles.h3}>POST /demo/inject</h3>
            <p>
              Injects exploit-like state and immediately runs the decision loop. Fires a real
              on-chain transaction if the injected score crosses a threshold. Useful for
              integration testing and demos.
            </p>
            <CodeBlock>{`// Request body (all fields optional — defaults shown)
{ "priceDevPct": 22, "poolDropPct": 55, "oracleStale": true }

// Response
{ "ok": true, "score": 90, "digest": "AbCd..." }`}</CodeBlock>
            <p>Returns 400 if guardian is disabled or protocol is already paused. Returns 409 if a transaction is already in progress.</p>

            <h3 className={styles.h3}>POST /demo/reset</h3>
            <p>Clears action suppression so the agent will fire again after a demo. Does not affect on-chain state.</p>
            <CodeBlock>{`{ "ok": true }`}</CodeBlock>
          </section>

          <Divider />

          {/* CONFIG REFERENCE */}
          <section id="config-ref">
            <h2 className={styles.h2}>Configuration Reference</h2>

            <h3 className={styles.h3}>Backend environment variables</h3>
            <table className={styles.table}>
              <thead><tr><th>Variable</th><th>Required</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><Code>AGENT_PRIVATE_KEY</Code></td><td>Yes</td><td>Private key for the agent wallet. Accepts Sui bech32 (<Code>suiprivkey1...</Code>), hex with or without <Code>0x</Code> prefix.</td></tr>
                <tr><td><Code>PACKAGE_ID</Code></td><td>Yes</td><td>guardian_ai package ID on Sui.</td></tr>
                <tr><td><Code>PROTOCOL_ID</Code></td><td>Yes</td><td>Protocol shared object ID.</td></tr>
                <tr><td><Code>ACTION_LOG_ID</Code></td><td>Yes</td><td>ActionLog shared object ID.</td></tr>
                <tr><td><Code>GUARDIAN_CONFIG_ID</Code></td><td>Yes</td><td>GuardianConfig shared object ID.</td></tr>
                <tr><td><Code>GUARDIAN_CAP_ID</Code></td><td>Yes</td><td>GuardianCap owned object ID.</td></tr>
                <tr><td><Code>SUI_RPC_URL</Code></td><td>No</td><td>Defaults to <Code>https://fullnode.testnet.sui.io:443</Code>.</td></tr>
                <tr><td><Code>PORT</Code></td><td>No</td><td>HTTP server port. Defaults to 3000.</td></tr>
                <tr><td><Code>WALRUS_PUBLISHER_URL</Code></td><td>No</td><td>Walrus publisher endpoint. Defaults to testnet publisher.</td></tr>
              </tbody>
            </table>

            <h3 className={styles.h3}>Frontend environment variables</h3>
            <table className={styles.table}>
              <thead><tr><th>Variable</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><Code>VITE_PACKAGE_ID</Code></td><td>guardian_ai package ID</td></tr>
                <tr><td><Code>VITE_PROTOCOL_ID</Code></td><td>Protocol shared object ID</td></tr>
                <tr><td><Code>VITE_ACTION_LOG_ID</Code></td><td>ActionLog shared object ID</td></tr>
                <tr><td><Code>VITE_GUARDIAN_CONFIG_ID</Code></td><td>GuardianConfig shared object ID</td></tr>
                <tr><td><Code>VITE_ADMIN_CAP_ID</Code></td><td>AdminCap object ID (for the enable/disable toggle)</td></tr>
                <tr><td><Code>VITE_GUARDIAN_CAP_ID</Code></td><td>GuardianCap object ID</td></tr>
                <tr><td><Code>VITE_BACKEND_URL</Code></td><td>Backend base URL (no trailing slash)</td></tr>
                <tr><td><Code>VITE_NETWORK</Code></td><td><Code>testnet</Code> or <Code>mainnet</Code>. Defaults to <Code>testnet</Code>.</td></tr>
              </tbody>
            </table>

            <h3 className={styles.h3}>Webhook format</h3>
            <p>The <Code>webhookUrl</Code> field supports three formats:</p>
            <table className={styles.table}>
              <thead><tr><th>Format</th><th>Example</th></tr></thead>
              <tbody>
                <tr><td>Telegram bot</td><td><Code>telegram://BOT_TOKEN/CHAT_ID</Code></td></tr>
                <tr><td>Discord webhook</td><td><Code>https://discord.com/api/webhooks/ID/TOKEN</Code></td></tr>
                <tr><td>Generic HTTP POST</td><td>Any <Code>https://</Code> URL — receives JSON body</td></tr>
              </tbody>
            </table>
            <p>Generic JSON payload:</p>
            <CodeBlock>{`{
  "source": "GuardianAI",
  "riskScore": 72,
  "reason": "Pool balance dropped 23.4% this interval",
  "signals": ["Pool balance dropped 23.4% this interval"],
  "timestamp": "2026-06-11T14:23:01.000Z"
}`}</CodeBlock>
          </section>

          <Divider />

          {/* SECURITY */}
          <section id="security">
            <h2 className={styles.h2}>Security Model</h2>

            <h3 className={styles.h3}>The capability pattern</h3>
            <p>
              The core security guarantee comes from Move's ownership model. The agent holds
              a <Code>GuardianCap</Code> object. Every circuit breaker function requires this
              object as a parameter. If the agent does not own it, the transaction aborts at
              the Move VM level — not in application code.
            </p>
            <p>
              This means:
            </p>
            <ul className={styles.list}>
              <li>The agent's permissions cannot be spoofed or escalated in software</li>
              <li>There is no role-based access control table to misconfigure</li>
              <li>Revoking access means transferring the <Code>GuardianCap</Code> away from the agent — no code change needed</li>
            </ul>

            <h3 className={styles.h3}>What the agent can do</h3>
            <ul className={styles.list}>
              <li>Call <Code>pause_protocol</Code> (sets paused flag)</li>
              <li>Call <Code>tighten_ltv</Code> (reduces LTV ratio)</li>
            </ul>

            <h3 className={styles.h3}>What the agent cannot do</h3>
            <ul className={styles.list}>
              <li>Move or withdraw funds</li>
              <li>Upgrade contracts</li>
              <li>Transfer ownership of any object</li>
              <li>Unpause the protocol (requires AdminCap)</li>
              <li>Call any function not explicitly accepting GuardianCap</li>
            </ul>

            <h3 className={styles.h3}>The kill switch</h3>
            <p>
              The protocol team holds the <Code>AdminCap</Code>. Calling{' '}
              <Code>cap::disable(admin, config)</Code> sets <Code>GuardianConfig.enabled = false</Code>.
              Every circuit breaker calls <Code>assert_active</Code> at the top, which aborts
              if <Code>enabled</Code> is false. The agent is disarmed instantly and globally
              — no transaction it submits can succeed until re-enabled.
            </p>
            <p>
              The dashboard Configuration panel provides a one-click interface for this
              operation.
            </p>

            <h3 className={styles.h3}>Agent wallet security</h3>
            <ul className={styles.list}>
              <li>The agent wallet only needs enough SUI for gas — keep its balance minimal</li>
              <li>Store <Code>AGENT_PRIVATE_KEY</Code> as a secret environment variable — never commit it</li>
              <li>The agent wallet should hold no other assets or capabilities</li>
              <li>If the agent wallet is compromised, disable the guardian immediately via AdminCap and rotate keys</li>
            </ul>

            <h3 className={styles.h3}>Audit trail</h3>
            <p>
              Every on-chain action writes an entry to the shared <Code>ActionLog</Code> object
              with a millisecond timestamp, risk score, action type, and reason string.
              Additionally, the backend stores a full diagnostic blob on Walrus after each
              action — including Pyth price, TWAP, deviation percentage, pool balance, and
              all active signals.
            </p>
          </section>

          <Divider />

          {/* DEPLOYED CONTRACTS */}
          <section id="deployed">
            <h2 className={styles.h2}>Deployed Contracts (Sui Testnet)</h2>
            <p>
              The following objects are live on Sui testnet. The dashboard and backend are
              configured to use these by default.
            </p>

            <h3 className={styles.h3}>Package</h3>
            <table className={styles.table}>
              <thead><tr><th>Name</th><th>ID</th></tr></thead>
              <tbody>
                <tr>
                  <td>guardian_ai package</td>
                  <td><ExplorerLink id="0x50b1a7151841d91039798ceabf37fb2bac34810d789e410e8a27f06e44ac9b2d" type="object" /></td>
                </tr>
              </tbody>
            </table>

            <h3 className={styles.h3}>Shared objects</h3>
            <table className={styles.table}>
              <thead><tr><th>Object</th><th>ID</th></tr></thead>
              <tbody>
                <tr>
                  <td>Protocol (test_protocol)</td>
                  <td><ExplorerLink id="0x53096d53e284b88eb7e72e4f41d8da8bb5025b7d9a6d7834a3be9c9f5d445893" type="object" /></td>
                </tr>
                <tr>
                  <td>ActionLog</td>
                  <td><ExplorerLink id="0xb48afb54dc8ea14e2674e2ebd5b0fb67504b10547cb7e4516da8f1e39231f827" type="object" /></td>
                </tr>
                <tr>
                  <td>GuardianConfig</td>
                  <td><ExplorerLink id="0x9be0eec7ca3b0dfbdafd2671a062c1282ac8ea122ecfa11720f4bf29da1bba51" type="object" /></td>
                </tr>
              </tbody>
            </table>

            <h3 className={styles.h3}>Capability objects</h3>
            <table className={styles.table}>
              <thead><tr><th>Object</th><th>Owner</th><th>ID</th></tr></thead>
              <tbody>
                <tr>
                  <td>AdminCap</td>
                  <td>Protocol team wallet</td>
                  <td><ExplorerLink id="0xc7010bd2474b542bf9c3a3d1ddbf14a55769b26eb3dcf3d877207265be42e757" type="object" /></td>
                </tr>
                <tr>
                  <td>GuardianCap</td>
                  <td>Agent wallet</td>
                  <td><ExplorerLink id="0xaae3c4356b61dd5c35e3835f95afae0b9d549506af30a7f90d99e561b8a9df3c" type="object" /></td>
                </tr>
              </tbody>
            </table>

            <h3 className={styles.h3}>Wallets</h3>
            <table className={styles.table}>
              <thead><tr><th>Role</th><th>Address</th></tr></thead>
              <tbody>
                <tr>
                  <td>Protocol team (AdminCap holder)</td>
                  <td><ExplorerLink id="0xdab28dc254b0fd42f4cd4e69f1d057e45328209f2203dcea1e5b09f364dcf390" type="address" /></td>
                </tr>
                <tr>
                  <td>Agent wallet (GuardianCap holder)</td>
                  <td><ExplorerLink id="0xc56efaa15e3f545c252f33b02ab80d6bcb91328a5304f724a5739d838bc81339" type="address" /></td>
                </tr>
              </tbody>
            </table>
          </section>

        </article>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '40px 0' }} />;
}

function Code({ children }) {
  return <code className={styles.inlineCode}>{children}</code>;
}

function CodeBlock({ children }) {
  return (
    <pre className={styles.codeBlock}>
      <code>{children}</code>
    </pre>
  );
}

function ExplorerLink({ id, type }) {
  const base = type === 'address'
    ? `https://suiscan.xyz/testnet/account/${id}`
    : `https://suiscan.xyz/testnet/object/${id}`;
  const short = `${id.slice(0, 10)}…${id.slice(-6)}`;
  return (
    <a href={base} target="_blank" rel="noopener noreferrer" className={styles.explorerLink}>
      {short}
    </a>
  );
}

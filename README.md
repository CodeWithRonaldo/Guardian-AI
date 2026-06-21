# GuardianAI

Autonomous on-chain risk guardian for DeFi protocols on Sui. Watches Pyth price feeds and on-chain state, scores risk continuously, and fires protective circuit-breaker transactions autonomously, without waiting for a human to respond.

Built for the **Sui Overflow 2026 Hackathon**, Agentic Web track (Autonomous Risk Guardian sub-track) + Walrus.

**Live demo:** [https://guardian-ai-khaki.vercel.app](https://guardian-ai-khaki.vercel.app)  
**Backend:** [guardian-ai-7ujt.onrender.com](https://guardian-ai-7ujt.onrender.com/health)  
**Network:** Sui Testnet

---

## The Problem

In October 2025, Cetus DEX on Sui was exploited for $60 million. The contracts were not broken; the response was too slow. By the time the team identified the incident and could act, liquidity had already been drained.

Most DeFi protocols have emergency pause functions. None of them trigger automatically. GuardianAI closes that gap.

---

## How It Works

GuardianAI has three layers:

**1. Move Contracts (on-chain trust layer)**
- `guardian_ai::cap`: `GuardianCap` (agent permission object) and `AdminCap` (human override). The agent's permissions are type-enforced by the Move VM.
- `guardian_ai::action_log`: Shared append-only object. Every action is written here permanently with a timestamp, risk score, and reason.
- `guardian_ai::test_protocol`: Reference lending protocol that ships with the package so the demo is fully self-contained on testnet. This is the exact interface a real protocol team would add to their own contract, two circuit breaker functions and two admin overrides. See [Integrating GuardianAI Into Your Protocol](#integrating-guardianai-into-your-protocol) for how to drop this into an existing Sui lending protocol.

**2. Risk Engine (off-chain autonomous agent)**
- Node.js backend polling Pyth Hermes API every 3 seconds
- Queries Deepbook's on-chain order book (SUI/DBUSDC pool) for a live DEX mid-price every 4 seconds
- Reads on-chain protocol state every 4 seconds
- Weighted risk scorer (0-100) combining rule-based circuit breaker signals with a statistical AI anomaly detector (z-score over a rolling window) and a DEX-vs-oracle divergence check
- Calls Claude Haiku 4.5 (Anthropic API) to generate a plain-English, technical explanation for every autonomous action, used as the actual on-chain reason and the Walrus audit record
- Autonomously restores LTV to its pre-tighten baseline once risk normalizes, so the response is reversible, not just escalating
- Builds and signs PTBs using the agent keypair
- Sends webhook alerts to Telegram, Discord, or any HTTP endpoint
- Stores full diagnostic snapshots on Walrus after every on-chain action

**3. Dashboard (visibility and control)**
- React + Vite frontend
- Live risk gauge, Action Log, Configuration panel, Docs
- One-click guardian enable/disable and protocol unpause via AdminCap

---

## AI-Generated Reasoning

Every autonomous action carries a real Claude-generated explanation, not a static template. The backend (`backend/src/ai.js`) calls Claude Haiku 4.5 with the active signals and the action being taken, and asks for one precise, technical sentence justifying it. That sentence becomes:

- The `reason` field written to the on-chain `ActionLog`
- The audit explanation stored in the Walrus blob

If the API key is missing or the call fails, the system falls back to the rule-based signal string, so the agent never blocks on an external API call.

Example: instead of a raw signal dump like `Pool balance dropped 25.0% this interval; Oracle stale: 45s`, the on-chain reason reads something like *"Sustained liquidity drain combined with oracle staleness indicates an active exploit; tightening LTV to limit further borrowing exposure."*

---

## Risk Scoring

Scores are additive and capped at 100. The engine combines rule-based circuit breakers with a statistical AI anomaly detector and a DeepBook divergence check. Every signal is auditable and explainable.

| Signal | Condition | Weight |
|---|---|---|
| Price deviation (large) | Pyth price >10% from TWAP | 30 |
| Price deviation (small) | Pyth price 3-10% from TWAP | 15 |
| AI anomaly | Price >2.5 standard deviations from rolling mean (z-score) | 20 |
| DEX-Oracle divergence | Deepbook on-chain mid-price diverges >20% from Pyth oracle | 25 |
| Oracle stale | No Pyth update in >30s | 20 |
| Pool drop (catastrophic) | Pool dropped >50% this poll | 55 |
| Pool drop (large) | Pool dropped >20% this poll | 35 |
| Pool drop (small) | Pool dropped >5% this poll | 15 |
| Pool critically low | Pool balance ≤5% of baseline | 90 |
| Already paused | Protocol paused flag set on-chain | 10 |

**Default thresholds (configurable):**
- Score ≥ 50: Webhook alert
- Score ≥ 70: Tighten LTV on-chain
- Score ≥ 85: Pause protocol on-chain

### Autonomous LTV Restoration

The response isn't one-directional. When the guardian tightens LTV, it records the pre-tighten ratio as a baseline. On every subsequent decision tick, if the risk score has dropped back below a safe threshold (default 40) and the protocol is not paused, the guardian autonomously restores the LTV to that baseline, with its own Claude-generated reason and its own on-chain transaction and audit entry. The protocol team can still intervene manually at any point via AdminCap.

---

## Deployed Contracts (Sui Testnet)

| Object | ID |
|---|---|
| Package | `0x50b1a7151841d91039798ceabf37fb2bac34810d789e410e8a27f06e44ac9b2d` |
| Protocol | `0x53096d53e284b88eb7e72e4f41d8da8bb5025b7d9a6d7834a3be9c9f5d445893` |
| ActionLog | `0xb48afb54dc8ea14e2674e2ebd5b0fb67504b10547cb7e4516da8f1e39231f827` |
| GuardianConfig | `0x9be0eec7ca3b0dfbdafd2671a062c1282ac8ea122ecfa11720f4bf29da1bba51` |
| AdminCap | `0xc7010bd2474b542bf9c3a3d1ddbf14a55769b26eb3dcf3d877207265be42e757` |
| GuardianCap | `0xaae3c4356b61dd5c35e3835f95afae0b9d549506af30a7f90d99e561b8a9df3c` |

---

## Running the Demo

The demo is live at the URLs above and uses the reference deployment on Sui testnet. To run it locally:

### Prerequisites
- Node.js 18+
- Sui CLI

### Frontend

```bash
npm install
npm run dev
```

The frontend reads object IDs from `.env`. A pre-configured `.env` for the reference deployment is in `.env.example`.

### Backend

```bash
cd backend
npm install
node src/index.js
```

The backend requires a `backend/.env` with the agent private key, object IDs, and (optionally) an `ANTHROPIC_API_KEY` for AI-generated reasoning. See `.env.example` in the `backend/` folder.

Health check: `GET /health`

---

## Integrating GuardianAI Into Your Protocol

GuardianAI is designed to be integrated into any existing Sui DeFi protocol. Each protocol gets its own deployment; there are no shared objects between integrations.

### Step 1: Add circuit breakers to your Move contract

Add these two functions to your existing contract. The `assert_active` call checks the enabled flag; if the guardian is disabled by the admin, the call aborts before any state changes.

```move
use guardian_ai::cap::{Self, GuardianCap, GuardianConfig};
use guardian_ai::action_log::{Self, ActionLog};
use sui::clock::Clock;
use std::string::String;

public fun pause_protocol(
    cap:        &GuardianCap,
    config:     &GuardianConfig,
    protocol:   &mut YourProtocol,
    log:        &mut ActionLog,
    clock:      &Clock,
    risk_score: u8,
    reason:     String,
) {
    cap::assert_active(cap, config);
    protocol.paused = true;
    action_log::append(log, clock, risk_score, action_log::pause(), reason);
}

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
}
```

### Step 2: Initialise the guardian (one-time)

Run this from the protocol team wallet. Replace `<AGENT_WALLET>` with the address of the wallet the backend agent will use.

```bash
sui client call \
  --package <GUARDIAN_AI_PACKAGE_ID> \
  --module cap \
  --function initialize \
  --args <AGENT_WALLET> \
  --gas-budget 10000000
```

This creates three objects:
- `GuardianCap`: transferred to the agent wallet
- `AdminCap`: transferred to the transaction sender (the protocol team)
- `GuardianConfig`: shared object, readable by anyone on-chain

Also create the shared ActionLog:

```bash
sui client call \
  --package <GUARDIAN_AI_PACKAGE_ID> \
  --module action_log \
  --function create_and_share \
  --gas-budget 10000000
```

### Step 3: Configure the backend

Create `backend/.env` with the object IDs generated in the previous step:

```
AGENT_PRIVATE_KEY=suiprivkey1...        # private key for the agent wallet
PACKAGE_ID=<GUARDIAN_AI_PACKAGE_ID>
PROTOCOL_ID=<YOUR_PROTOCOL_OBJECT_ID>
ACTION_LOG_ID=<YOUR_ACTION_LOG_ID>
GUARDIAN_CONFIG_ID=<YOUR_GUARDIAN_CONFIG_ID>
GUARDIAN_CAP_ID=<YOUR_GUARDIAN_CAP_ID>
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
ANTHROPIC_API_KEY=sk-ant-...            # optional, enables AI-generated reasoning
```

```bash
cd backend && npm install && node src/index.js
```

### Step 4: Configure the dashboard

Create `.env` in the project root:

```
VITE_PACKAGE_ID=<GUARDIAN_AI_PACKAGE_ID>
VITE_PROTOCOL_ID=<YOUR_PROTOCOL_OBJECT_ID>
VITE_ACTION_LOG_ID=<YOUR_ACTION_LOG_ID>
VITE_GUARDIAN_CONFIG_ID=<YOUR_GUARDIAN_CONFIG_ID>
VITE_ADMIN_CAP_ID=<YOUR_ADMIN_CAP_ID>
VITE_GUARDIAN_CAP_ID=<YOUR_GUARDIAN_CAP_ID>
VITE_BACKEND_URL=https://your-backend-url.com
VITE_NETWORK=testnet
```

```bash
npm install && npm run dev
```

### Step 5: Configure thresholds

Open the Configuration panel in the dashboard. Set the Notify, Tighten LTV, and Pause thresholds to match the protocol's risk tolerance. Optionally add a Telegram or Discord webhook URL for instant alerts. Changes take effect immediately, no backend restart needed.

Full integration reference: see the **Docs** tab in the dashboard.

---

## Security Model

The agent holds a `GuardianCap` object. Every circuit breaker function requires it as a parameter. If the agent doesn't own it, the transaction aborts at the Move VM level.

**What the agent can do:** pause protocol, tighten LTV ratio, restore LTV once risk normalizes.  
**What the agent cannot do:** move funds, upgrade contracts, transfer ownership, unpause.

The `AdminCap` is the kill switch. Calling `cap::disable` instantly disarms the agent, no code change needed. The dashboard Configuration panel provides a one-click interface.

---

## Project Structure

```
├── contracts/guardian_ai/     # Move contracts
│   └── sources/
│       ├── cap.move           # GuardianCap, AdminCap, GuardianConfig
│       ├── action_log.move    # On-chain audit log
│       └── test_protocol.move # Reference lending protocol (self-contained testnet demo)
├── backend/
│   └── src/
│       ├── index.js           # Express server, decision loop, API
│       ├── scorer.js          # Risk scoring engine
│       ├── chain.js           # Sui RPC queries
│       ├── deepbook.js        # Deepbook on-chain mid-price query
│       ├── ai.js               # Claude Haiku integration for risk reasoning
│       ├── executor.js        # PTB builder and signer
│       ├── pyth.js            # Pyth Hermes price feed + z-score anomaly detection
│       └── walrus.js          # Walrus audit blob storage
└── src/                       # React frontend
    └── pages/
        ├── Dashboard/         # Live risk gauge and stats
        ├── ActionLog/         # On-chain audit log viewer
        ├── Configuration/     # Threshold and webhook config
        ├── Simulation/        # Demo scenario runner
        └── Docs/              # Integration documentation
```

---

## Hackathon Tracks

### Agentic Web — Autonomous Risk Guardian

Every required element is present and live on testnet:

| Requirement | How GuardianAI satisfies it |
|---|---|
| Live price feed | Pyth Hermes API (off-chain oracle) and Deepbook on-chain order book (SUI/DBUSDC pool). Both polled every few seconds. |
| AI risk score | Hybrid model: a z-score statistical anomaly detector (adapts to market volatility) plus Claude Haiku 4.5 generating the human-readable risk explanation behind every autonomous action. |
| Autonomous on-chain action | Two actions: `tighten_ltv` (parameter adjustment, with autonomous restoration once risk normalizes) and `pause_protocol` (market halt). Both fire via PTBs signed by the agent, no human in the loop. |
| Move policy object | `GuardianCap`, a Move object owned by the agent wallet. Every circuit breaker function requires it as a parameter. If the agent doesn't hold it, the Move VM aborts the transaction. The agent's scope is type-enforced, not just checked at runtime. |
| Human override | `AdminCap` held by the protocol team. Calling `cap::disable` instantly prevents the agent from taking any further action. The dashboard Configuration panel provides one-click disable, enable, and unpause. |
| Every action logged on-chain | `ActionLog` is a shared, append-only Sui object. Every action, autonomous and manual, is written with a timestamp, risk score, action code, and a Claude-generated plain-English reason. Readable by anyone, forever. |

### Walrus

After every on-chain guardian action, a full diagnostic snapshot is written to Walrus: Pyth price, TWAP, z-score, Deepbook price, pool balance, LTV, the AI-generated explanation, and the transaction digest. The on-chain `ActionLog` is the source of truth; the Walrus blob carries the extended context that would otherwise be lost.

---

## License

MIT

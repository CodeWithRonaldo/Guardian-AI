# GuardianAI

Autonomous on-chain risk guardian for DeFi protocols on Sui. Watches Pyth price feeds and on-chain state, scores risk continuously, and fires protective circuit-breaker transactions autonomously — without waiting for a human to respond.

Built for the **Sui Overflow 2026 Hackathon** — Agentic Web track (Autonomous Risk Guardian sub-track) + Walrus.

**Live demo:** [guardian-ai.vercel.app](https://guardian-ai.vercel.app)  
**Backend:** [guardian-ai-7ujt.onrender.com](https://guardian-ai-7ujt.onrender.com/health)  
**Network:** Sui Testnet

---

## The Problem

In October 2025, Cetus DEX on Sui was exploited for $60 million. The contracts were not broken — the response was too slow. By the time the team identified the incident and could act, liquidity had already been drained.

Most DeFi protocols have emergency pause functions. None of them trigger automatically. GuardianAI closes that gap.

---

## How It Works

GuardianAI has three layers:

**1. Move Contracts (on-chain trust layer)**
- `guardian_ai::cap` — `GuardianCap` (agent permission object) and `AdminCap` (human override). The agent's permissions are type-enforced by the Move VM.
- `guardian_ai::action_log` — Shared append-only object. Every action is written here permanently with a timestamp, risk score, and reason.
- `guardian_ai::test_protocol` — Mock DeFi protocol for testnet demos.

**2. Risk Engine (off-chain autonomous agent)**
- Node.js backend polling Pyth Hermes API every 3 seconds
- Reads on-chain protocol state every 4 seconds
- Rule-based weighted risk scorer (0–100)
- Builds and signs PTBs using the agent keypair
- Sends webhook alerts to Telegram, Discord, or any HTTP endpoint
- Stores full diagnostic snapshots on Walrus after every on-chain action

**3. Dashboard (visibility and control)**
- React + Vite frontend
- Live risk gauge, Action Log, Configuration panel, Docs
- One-click guardian enable/disable and protocol unpause via AdminCap

---

## Risk Scoring

Scores are additive and capped at 100. The scorer is rule-based by design — every decision is fully auditable and explainable.

| Signal | Condition | Weight |
|---|---|---|
| Price deviation (large) | Pyth price >10% from TWAP | 30 |
| Price deviation (small) | Pyth price 3–10% from TWAP | 15 |
| Oracle stale | No Pyth update in >30s | 20 |
| Pool drop (catastrophic) | Pool dropped >50% this poll | 55 |
| Pool drop (large) | Pool dropped >20% this poll | 35 |
| Pool drop (small) | Pool dropped >5% this poll | 15 |
| Pool critically low | Pool balance ≤5% of baseline | 90 |
| Already paused | Protocol paused flag set on-chain | 10 |

**Default thresholds (configurable):**
- Score ≥ 50 → Webhook alert
- Score ≥ 70 → Tighten LTV on-chain
- Score ≥ 85 → Pause protocol on-chain

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

## Quick Start

### Prerequisites
- Node.js 18+
- Sui CLI
- A Sui wallet with testnet SUI

### Frontend

```bash
npm install
```

Create `.env` in the project root:

```
VITE_PACKAGE_ID=0x50b1a7151841d91039798ceabf37fb2bac34810d789e410e8a27f06e44ac9b2d
VITE_PROTOCOL_ID=0x53096d53e284b88eb7e72e4f41d8da8bb5025b7d9a6d7834a3be9c9f5d445893
VITE_ACTION_LOG_ID=0xb48afb54dc8ea14e2674e2ebd5b0fb67504b10547cb7e4516da8f1e39231f827
VITE_GUARDIAN_CONFIG_ID=0x9be0eec7ca3b0dfbdafd2671a062c1282ac8ea122ecfa11720f4bf29da1bba51
VITE_ADMIN_CAP_ID=0xc7010bd2474b542bf9c3a3d1ddbf14a55769b26eb3dcf3d877207265be42e757
VITE_GUARDIAN_CAP_ID=0xaae3c4356b61dd5c35e3835f95afae0b9d549506af30a7f90d99e561b8a9df3c
VITE_BACKEND_URL=https://guardian-ai-7ujt.onrender.com
VITE_NETWORK=testnet
```

```bash
npm run dev
```

### Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```
AGENT_PRIVATE_KEY=suiprivkey1...
PACKAGE_ID=0x50b1a7151841d91039798ceabf37fb2bac34810d789e410e8a27f06e44ac9b2d
PROTOCOL_ID=0x53096d53e284b88eb7e72e4f41d8da8bb5025b7d9a6d7834a3be9c9f5d445893
ACTION_LOG_ID=0xb48afb54dc8ea14e2674e2ebd5b0fb67504b10547cb7e4516da8f1e39231f827
GUARDIAN_CONFIG_ID=0x9be0eec7ca3b0dfbdafd2671a062c1282ac8ea122ecfa11720f4bf29da1bba51
GUARDIAN_CAP_ID=0xaae3c4356b61dd5c35e3835f95afae0b9d549506af30a7f90d99e561b8a9df3c
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
```

```bash
node src/index.js
```

Health check: `GET /health`

---

## Integrating GuardianAI Into Your Protocol

Add two circuit breaker functions to your Move contract:

```move
use guardian_ai::cap::{Self, GuardianCap, GuardianConfig};
use guardian_ai::action_log::{Self, ActionLog};

public fun pause_protocol(
    cap:        &GuardianCap,
    config:     &GuardianConfig,
    protocol:   &mut YourProtocol,
    log:        &mut ActionLog,
    clock:      &sui::clock::Clock,
    risk_score: u8,
    reason:     std::string::String,
) {
    cap::assert_active(cap, config);
    protocol.paused = true;
    action_log::append(log, clock, risk_score, action_log::pause(), reason);
}
```

Then initialise the guardian objects (one-time):

```bash
sui client call \
  --package <GUARDIAN_AI_PACKAGE_ID> \
  --module cap \
  --function initialize \
  --args <YOUR_AGENT_WALLET_ADDRESS> \
  --gas-budget 10000000
```

This creates a `GuardianCap` (→ agent wallet), `AdminCap` (→ your wallet), and `GuardianConfig` (shared). Point the backend `.env` at your new object IDs and start the agent.

Full integration guide: see the **Docs** page in the dashboard.

---

## Security Model

The agent holds a `GuardianCap` object. Every circuit breaker function requires it as a parameter. If the agent doesn't own it, the transaction aborts at the Move VM level.

**What the agent can do:** pause protocol, tighten LTV ratio.  
**What the agent cannot do:** move funds, upgrade contracts, transfer ownership, unpause.

The `AdminCap` is the kill switch. Calling `cap::disable` instantly disarms the agent — no code change needed. The dashboard Configuration panel provides a one-click interface.

---

## Project Structure

```
├── contracts/guardian_ai/     # Move contracts
│   └── sources/
│       ├── cap.move           # GuardianCap, AdminCap, GuardianConfig
│       ├── action_log.move    # On-chain audit log
│       └── test_protocol.move # Mock protocol for demos
├── backend/
│   └── src/
│       ├── index.js           # Express server, decision loop, API
│       ├── scorer.js          # Risk scoring engine
│       ├── chain.js           # Sui RPC queries
│       ├── executor.js        # PTB builder and signer
│       ├── pyth.js            # Pyth Hermes price feed
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

- **Agentic Web — Autonomous Risk Guardian:** Live Pyth price feed, autonomous on-chain circuit breakers via Move capability objects, human override via AdminCap.
- **Walrus:** Full diagnostic snapshots stored on Walrus after every guardian action — immutable, decentralised audit trail.

---

## License

MIT

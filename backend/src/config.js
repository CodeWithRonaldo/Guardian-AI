import 'dotenv/config';

function required(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const CONFIG = {
  agentPrivateKey:   required('AGENT_PRIVATE_KEY'),
  suiRpcUrl:         process.env.SUI_RPC_URL ?? 'https://fullnode.testnet.sui.io:443',
  packageId:         required('PACKAGE_ID'),
  protocolId:        required('PROTOCOL_ID'),
  actionLogId:       required('ACTION_LOG_ID'),
  guardianConfigId:  required('GUARDIAN_CONFIG_ID'),
  guardianCapId:     required('GUARDIAN_CAP_ID'),
  walrusPublisher:   process.env.WALRUS_PUBLISHER_URL ?? 'https://publisher.walrus-testnet.walrus.space',
  port:              Number(process.env.PORT ?? 3000),

  // Risk thresholds — must match frontend constants
  thresholds: {
    notify:     50,
    tightenLtv: 70,
    pause:      85,
  },

//   thresholds: {
//   notify:     10,
//   tightenLtv: 20,
//   pause:      35,   // temporary for testing
// },

  // Poll intervals (ms)
  intervals: {
    pyth:  3_000,
    chain: 4_000,
  },
};

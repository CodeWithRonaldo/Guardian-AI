import 'dotenv/config';

function required(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const CONFIG = {
  agentPrivateKey:   required('AGENT_PRIVATE_KEY'),
  anthropicApiKey:   process.env.ANTHROPIC_API_KEY ?? '', // optional — enables AI-generated reason strings
  suiRpcUrl:         process.env.SUI_RPC_URL ?? 'https://fullnode.testnet.sui.io:443',
  packageId:         required('PACKAGE_ID'),
  protocolId:        required('PROTOCOL_ID'),
  actionLogId:       required('ACTION_LOG_ID'),
  guardianConfigId:  required('GUARDIAN_CONFIG_ID'),
  guardianCapId:     required('GUARDIAN_CAP_ID'),
  walrusPublisher:   process.env.WALRUS_PUBLISHER_URL ?? 'https://publisher.walrus-testnet.walrus.space',
  port:              Number(process.env.PORT ?? 3000),

  // Protocol-specific — override these when integrating into your own contract.
  // Defaults match the guardian_ai::test_protocol reference implementation.
  protocolModule:      process.env.PROTOCOL_MODULE       ?? 'test_protocol',
  pauseFunction:       process.env.PAUSE_FUNCTION        ?? 'pause_protocol',
  tightenLtvFunction:  process.env.TIGHTEN_LTV_FUNCTION  ?? 'tighten_ltv',
  restoreLtvFunction:  process.env.RESTORE_LTV_FUNCTION  ?? 'restore_ltv',
  poolBalanceField:    process.env.POOL_BALANCE_FIELD     ?? 'pool_balance',
  ltvField:            process.env.LTV_FIELD              ?? 'ltv_ratio',
  pausedField:         process.env.PAUSED_FIELD           ?? 'paused',
  poolBaseline:        Number(process.env.POOL_BASELINE   ?? '10000000000000'),

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

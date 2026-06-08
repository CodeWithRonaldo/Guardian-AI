export const PACKAGE_ID   = import.meta.env.VITE_PACKAGE_ID;
export const PROTOCOL_ID  = import.meta.env.VITE_PROTOCOL_ID;
export const ACTION_LOG_ID       = import.meta.env.VITE_ACTION_LOG_ID;
export const GUARDIAN_CONFIG_ID  = import.meta.env.VITE_GUARDIAN_CONFIG_ID;
export const ADMIN_CAP_ID        = import.meta.env.VITE_ADMIN_CAP_ID;
export const GUARDIAN_CAP_ID     = import.meta.env.VITE_GUARDIAN_CAP_ID;
export const NETWORK             = import.meta.env.VITE_NETWORK ?? 'testnet';
export const BACKEND_URL         = import.meta.env.VITE_BACKEND_URL ?? '';

export const MODULES = {
  cap:           `${PACKAGE_ID}::cap`,
  action_log:    `${PACKAGE_ID}::action_log`,
  test_protocol: `${PACKAGE_ID}::test_protocol`,
};

export const ACTION_LABELS = {
  0: 'Log Only',
  1: 'Notify',
  2: 'Tighten LTV',
  3: 'Pause',
  4: 'Unpause',
};

export const RISK_THRESHOLDS = {
  NOTIFY:      50,
  TIGHTEN_LTV: 70,
  PAUSE:       85,
};

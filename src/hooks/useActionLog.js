import { useSuiClientQuery } from '@mysten/dapp-kit';
import { ACTION_LOG_ID, ACTION_LABELS } from '../constants/contracts';

function parseEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((e) => ({
    timestampMs: Number(e.fields?.timestamp_ms ?? 0),
    riskScore:   Number(e.fields?.risk_score   ?? 0),
    action:      Number(e.fields?.action        ?? 0),
    actionLabel: ACTION_LABELS[Number(e.fields?.action ?? 0)] ?? 'Unknown',
    reason:      e.fields?.reason ?? '',
  }));
}

export function useActionLog() {
  const { data, isPending, error, refetch } = useSuiClientQuery(
    'getObject',
    {
      id: ACTION_LOG_ID,
      options: { showContent: true },
    },
    { refetchInterval: 5_000 },
  );

  const fields  = data?.data?.content?.fields ?? null;
  const entries = parseEntries(fields?.entries);

  return {
    isPending,
    error,
    refetch,
    entries,
    entryCount: entries.length,
    latest:     entries.length > 0 ? entries[entries.length - 1] : null,
  };
}

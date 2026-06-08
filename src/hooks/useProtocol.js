import { useSuiClientQuery } from '@mysten/dapp-kit';
import { PROTOCOL_ID } from '../constants/contracts';

export function useProtocol() {
  const { data, isPending, error, refetch } = useSuiClientQuery(
    'getObject',
    {
      id: PROTOCOL_ID,
      options: { showContent: true },
    },
    { refetchInterval: 4_000 },
  );

  const fields = data?.data?.content?.fields ?? null;

  return {
    isPending,
    error,
    refetch,
    paused:      fields ? Boolean(fields.paused) : null,
    ltvRatio:    fields ? Number(fields.ltv_ratio) : null,
    poolBalance: fields ? Number(fields.pool_balance) : null,
    borrows:     fields ? Number(fields.total_borrows) : null,
    name:        fields?.name ?? null,
  };
}

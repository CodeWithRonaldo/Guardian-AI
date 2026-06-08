import { useSuiClientQuery } from '@mysten/dapp-kit';
import { GUARDIAN_CONFIG_ID } from '../constants/contracts';

export function useGuardianConfig() {
  const { data, isPending, error, refetch } = useSuiClientQuery(
    'getObject',
    {
      id: GUARDIAN_CONFIG_ID,
      options: { showContent: true },
    },
    { refetchInterval: 6_000 },
  );

  const fields = data?.data?.content?.fields ?? null;

  return {
    isPending,
    error,
    refetch,
    enabled:      fields ? Boolean(fields.enabled) : null,
    agentAddress: fields?.agent_address ?? null,
  };
}

import { useQuery } from '@tanstack/react-query';
import { BACKEND_URL } from '../constants/contracts';

async function fetchStatus() {
  const res = await fetch(`${BACKEND_URL}/status`, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`Backend HTTP ${res.status}`);
  return res.json();
}

export function useBackendStatus() {
  const { data, isPending, error } = useQuery({
    queryKey:      ['backendStatus'],
    queryFn:       fetchStatus,
    refetchInterval: 4_000,
    enabled:       Boolean(BACKEND_URL),
    retry:         1,
  });

  return {
    isPending,
    error,
    score:          data?.score          ?? null,
    guardianEnabled: data?.guardian      ?? null,
    price:          data?.price          ?? null,
    chain:          data?.chain          ?? null,
  };
}

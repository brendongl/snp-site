/**
 * Staff Mode Hook
 *
 * Detects if ?staff=true is in the URL
 * This is a temporary solution until proper authentication is implemented
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export function useStaffMode(): boolean {
  const searchParams = useSearchParams();

  const isStaff = useMemo(() => {
    return searchParams?.get('staff') === 'true';
  }, [searchParams]);

  return isStaff;
}

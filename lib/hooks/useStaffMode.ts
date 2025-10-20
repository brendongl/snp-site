/**
 * Staff Mode Hook
 *
 * Detects if user is in staff mode by checking:
 * 1. localStorage (staff email stored during login)
 * 2. URL parameter ?staff=true (legacy support)
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';

export function useStaffMode(): boolean {
  const searchParams = useSearchParams();
  const [isStaffFromStorage, setIsStaffFromStorage] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const staffEmail = localStorage.getItem('staff_email');
    const staffName = localStorage.getItem('staff_name');
    setIsStaffFromStorage(!!(staffEmail && staffName));
  }, []);

  const isStaff = useMemo(() => {
    // Check localStorage first (new auth system)
    if (isStaffFromStorage) {
      return true;
    }
    // Fall back to URL parameter (legacy)
    return searchParams?.get('staff') === 'true';
  }, [searchParams, isStaffFromStorage]);

  return isStaff;
}

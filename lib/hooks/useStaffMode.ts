/**
 * Staff Mode Hook
 *
 * Detects if user is authenticated as staff by checking localStorage.
 * Staff must be logged in through /auth/signin - no URL parameter access.
 */

'use client';

import { useState, useEffect } from 'react';

export function useStaffMode(): boolean {
  const [isStaff, setIsStaff] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const staffEmail = localStorage.getItem('staff_email');
    const staffName = localStorage.getItem('staff_name');
    setIsStaff(!!(staffEmail && staffName));
  }, []);

  return isStaff;
}

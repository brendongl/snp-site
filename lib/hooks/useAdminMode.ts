'use client';

import { useState, useEffect } from 'react';

/**
 * Admin Mode Hook
 *
 * Detects if user is an admin by checking the staff_type field in localStorage
 * Returns true only if staff_type === 'Admin'
 */
export function useAdminMode(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const staffType = localStorage.getItem('staff_type');
    setIsAdmin(staffType === 'Admin');
  }, []);

  return isAdmin;
}

'use client';

import { useState, useEffect } from 'react';

/**
 * Admin Mode Hook
 *
 * Detects if user is an admin by checking the staff_type field in localStorage
 * Returns true only if staff_type === 'Admin'
 * Listens for storage changes to update when user logs in/out
 */
export function useAdminMode(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check initial value
    const checkAdminStatus = () => {
      const staffType = localStorage.getItem('staff_type');
      setIsAdmin(staffType === 'Admin');
    };

    checkAdminStatus();

    // Listen for storage changes (when user logs in/out)
    window.addEventListener('storage', checkAdminStatus);

    // Also listen for custom event when localStorage is updated in same window
    const handleStorageUpdate = () => checkAdminStatus();
    window.addEventListener('localStorageUpdated', handleStorageUpdate);

    return () => {
      window.removeEventListener('storage', checkAdminStatus);
      window.removeEventListener('localStorageUpdated', handleStorageUpdate);
    };
  }, []);

  return isAdmin;
}

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Menu, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAdminMode } from '@/lib/hooks/useAdminMode';

export function StaffMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [staffName, setStaffName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isAdmin = useAdminMode();

  // Get staff name from localStorage
  useEffect(() => {
    const name = localStorage.getItem('staff_name');
    setStaffName(name);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleLogout = () => {
    localStorage.removeItem('staff_email');
    localStorage.removeItem('staff_name');
    localStorage.removeItem('staff_id');
    localStorage.removeItem('staff_type');
    setIsOpen(false);
    router.push('/');
  };

  return (
    <div ref={menuRef} className="relative">
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
        aria-label="Staff menu"
        title="Staff menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Dropdown Menu - Fixed positioning to stay in viewport */}
      {isOpen && (
        <div className="fixed right-2 sm:right-4 mt-2 w-56 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 z-[100]" style={{ top: '3rem' }}>
          {/* Logged in as header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs text-muted-foreground mb-1">Logged in as</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {staffName}
              <span className={`ml-2 ${isAdmin ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
                ({isAdmin ? 'admin' : 'staff'})
              </span>
            </p>
          </div>

          <nav className="py-2">
            {/* Play Logs */}
            <Link
              href="/staff/play-logs"
              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-900 dark:text-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <span className="text-lg">📊</span>
              <span>Play Logs</span>
            </Link>

            {/* Check History */}
            <Link
              href="/staff/check-history"
              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-900 dark:text-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <span className="text-lg">✓</span>
              <span>Check History</span>
            </Link>

            {/* Staff Knowledge */}
            <div className="py-1">
              <Link
                href="/staff/knowledge"
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-900 dark:text-gray-100 font-medium"
                onClick={() => setIsOpen(false)}
              >
                <span className="text-lg">🧠</span>
                <span>Staff Knowledge</span>
              </Link>

              {/* Bulk Knowledge Updater - Sub-item */}
              <Link
                href="/staff/add-knowledge"
                className="flex items-center gap-2 px-4 py-2 pl-10 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300 text-sm"
                onClick={() => setIsOpen(false)}
              >
                <span className="text-lg">⭐</span>
                <span>Bulk Knowledge Updater</span>
              </Link>
            </div>

            {/* Divider */}
            <div className="my-2 border-t border-gray-200 dark:border-gray-700" />

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}

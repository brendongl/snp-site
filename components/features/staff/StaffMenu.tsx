'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Menu, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function StaffMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
    setIsOpen(false);
    router.push('/');
  };

  return (
    <div ref={menuRef} className="relative">
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Staff menu"
        title="Staff menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 z-50">
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
            <Link
              href="/staff/knowledge"
              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-900 dark:text-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <span className="text-lg">🧠</span>
              <span>Staff Knowledge</span>
            </Link>

            {/* Game Expert Tracker */}
            <Link
              href="/staff/add-knowledge"
              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-900 dark:text-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <span className="text-lg">⭐</span>
              <span>Game Expert Tracker</span>
            </Link>

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

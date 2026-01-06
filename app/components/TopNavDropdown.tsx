'use client'

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function TopNavDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(!isOpen);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  };

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="hover:underline flex items-center"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Admin menu"
        tabIndex={0}
      >
        Admin
        <svg
          className={`ml-1 w-4 h-4 inline-block transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div
        ref={dropdownRef}
        className={`absolute left-0 mt-2 w-56 bg-gray-800 rounded-md shadow-lg transition-all duration-200 z-50 border border-gray-700 ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        role="menu"
        aria-label="Admin navigation menu"
      >
        <div className="py-1">
          <Link
            href="/schedules-live"
            className="block px-4 py-2 text-blue-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white focus:outline-none"
            role="menuitem"
            onClick={handleLinkClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleLinkClick();
              }
            }}
            tabIndex={isOpen ? 0 : -1}
          >
            League Schedules (Live)
          </Link>
          <Link
            href="/timer"
            className="block px-4 py-2 text-blue-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white focus:outline-none"
            role="menuitem"
            onClick={handleLinkClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleLinkClick();
              }
            }}
            tabIndex={isOpen ? 0 : -1}
          >
            Round Timer
          </Link>
          <Link
            href="/test"
            className="block px-4 py-2 text-blue-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white focus:outline-none"
            role="menuitem"
            onClick={handleLinkClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleLinkClick();
              }
            }}
            tabIndex={isOpen ? 0 : -1}
          >
            Show Permissions (debugging)
          </Link>
        </div>
      </div>
    </div>
  );
}


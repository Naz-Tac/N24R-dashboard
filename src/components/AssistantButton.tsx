'use client';

import { useState, useEffect } from 'react';
import AssistantChat from './AssistantChat';

export default function AssistantButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>('agent');

  useEffect(() => {
    // Try to determine user role from context
    // In production, this would come from auth context or API
    // For now, we'll detect from current path
    const path = window.location.pathname;
    if (path.startsWith('/dashboard') || path.startsWith('/agents') || path.startsWith('/shifts')) {
      setUserRole('admin');
    } else if (path.startsWith('/org')) {
      setUserRole('manager');
    } else if (path.startsWith('/agent')) {
      setUserRole('agent');
    }
  }, []);

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[9998] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label="Open AI Assistant"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          
          {/* Notification Badge (optional) */}
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-success text-xs font-bold text-white">
            ?
          </span>
        </button>
      )}

      {/* Chat Window */}
      <AssistantChat isOpen={isOpen} onClose={() => setIsOpen(false)} userRole={userRole} />
    </>
  );
}

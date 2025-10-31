'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: string;
  actionDetails?: Record<string, any>;
}

interface AssistantChatProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
}

export default function AssistantChat({ isOpen, onClose, userRole = 'agent' }: AssistantChatProps) {
  const pathname = usePathname();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: getWelcomeMessage(userRole),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; type: string; content: string; timestamp: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set suggested actions based on role
  useEffect(() => {
    const writeRoles = ['admin', 'manager', 'dispatcher'];
    if (writeRoles.includes(userRole)) {
      setSuggestedActions([
        'Create a shift tomorrow 9-5',
        'Show analytics summary',
        'Assign agent to next shift',
        'Notify all agents',
      ]);
    } else {
      setSuggestedActions([
        'Show my assignments',
        'Show analytics summary',
        'Help with availability',
      ]);
    }
  }, [userRole]);

  async function fetchHistory() {
    try {
      setHistoryLoading(true);
      const res = await fetch('/api/ai/memory?limit=10', { method: 'GET' });
      const data = await res.json();
      if (res.ok) {
        setHistory(data.data || []);
      }
    } catch (e) {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }

  async function clearMemory() {
    try {
      const res = await fetch('/api/ai/memory', { method: 'DELETE' });
      if (res.ok) {
        setHistory([]);
      }
    } catch (e) {
      // ignore
    }
  }

  function getWelcomeMessage(role: string): string {
    switch (role) {
      case 'admin':
      case 'dispatcher':
        return "👋 Hi Dispatcher! I'm your AI assistant. I can help you with analytics, shift management, agent assignments, and more. What would you like to do?";
      case 'manager':
        return "👋 Hi Manager! I can help you manage your organization's roster, create shifts, view analytics, and request shared agents. How can I assist you?";
      case 'agent':
        return "👋 Hi! I'm here to help you manage your assignments, set availability, and answer questions. What do you need?";
      default:
        return "👋 Hello! How can I help you today?";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Build conversation history (last 5 turns for context)
      const recentMessages = messages.slice(-10); // Last 5 pairs of user/assistant
      const conversationHistory = recentMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
      }));

      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          role: userRole,
          context: {
            pathname,
            timestamp: new Date().toISOString(),
          },
          conversationHistory,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to perform this action.');
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.data?.response || 'Sorry, I encountered an error.',
        timestamp: new Date(),
        action: result.data?.action,
        actionDetails: result.data?.actionDetails,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update suggested actions if provided
      if (result.data?.suggestedActions) {
        setSuggestedActions(result.data.suggestedActions);
      }
    } catch (error: any) {
      console.error('Assistant error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ ${error.message || 'Sorry, I encountered an error. Please try again.'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleActionClick(action: string) {
    setInput(action);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-end p-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md">
        {/* Chat Window */}
        <div className="rounded-lg border border-stroke bg-white shadow-xl dark:border-strokedark dark:bg-boxdark">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stroke p-4 dark:border-strokedark">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-black dark:text-white">AI Assistant</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Always here to help</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={async () => { setShowHistory((s) => !s); if (!showHistory) await fetchHistory(); }}
                className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-gray-800"
              >
                Memory
              </button>
              <button
                onClick={onClose}
                className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close assistant"
              >
                <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Memory Panel */}
          {showHistory && (
            <div className="border-b border-stroke px-4 py-3 text-sm text-slate-700 transition-all dark:border-strokedark dark:text-slate-200">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium">Conversation History (last 10)</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchHistory}
                    className="rounded-md bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={clearMemory}
                    className="rounded-md bg-rose-100 px-2 py-1 text-xs text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50"
                  >
                    Clear Memory
                  </button>
                </div>
              </div>
              {historyLoading ? (
                <p className="text-xs italic text-slate-500">Loading...</p>
              ) : history.length === 0 ? (
                <p className="text-xs italic text-slate-500">No memory yet.</p>
              ) : (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-start gap-2">
                      <span className="mt-0.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-slate-400" />
                      <div>
                        <div className="opacity-70">{new Date(h.timestamp).toLocaleString()}</div>
                        <div className="opacity-90">[{h.type}] {h.content}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-black dark:bg-gray-800 dark:text-white'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  {msg.action && msg.actionDetails && (
                    <div className="mt-2 border-t border-white/20 pt-2 text-xs opacity-80">
                      Action: {msg.action}
                    </div>
                  )}
                  <p className="mt-1 text-xs opacity-70">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg bg-gray-100 px-4 py-2 dark:bg-gray-800">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Actions */}
          {suggestedActions.length > 0 && !loading && (
            <div className="border-t border-stroke px-4 py-3 dark:border-strokedark">
              <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">Quick Actions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleActionClick(action)}
                    className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition-all hover:bg-slate-200 hover:scale-105 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-stroke p-4 dark:border-strokedark">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                disabled={loading}
                className="flex-1 rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary dark:disabled:bg-gray-800"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-opacity-90 disabled:cursor-not-allowed disabled:bg-opacity-50"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

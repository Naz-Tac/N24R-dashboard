"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';

type Message = {
  id: string;
  agent_id: string;
  type: string;
  from: 'agent' | 'manager';
  message: string;
  created_at?: string;
};

export function ManagerChatOverlay({
  agentId,
  agentName,
  open,
  onClose,
}: {
  agentId: string;
  agentName?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const title = useMemo(() => agentName || agentId, [agentId, agentName]);

  async function load() {
    try {
      const r = await fetch(`/api/manager/console/chat?agent_id=${encodeURIComponent(agentId)}`);
      const j = await r.json();
      if (j?.data) setMessages(j.data);
    } catch {}
  }

  async function send() {
    if (!input.trim()) return;
    setSending(true);
    try {
      await fetch('/api/manager/console/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_ids: [agentId], message: input.trim(), channel: 'push', type: 'chat' }),
      });
      setInput('');
      await load();
    } catch {}
    setSending(false);
  }

  useEffect(() => {
    if (!open) return;
    load();
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(load, 10_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agentId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold">Chat with {title}</h3>
          <button onClick={onClose} className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-sm text-gray-500">No messages yet.</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === 'manager' ? 'justify-end' : 'justify-start'}`}>
              <div className={`px-3 py-2 rounded-lg text-sm max-w-[75%] ${m.from === 'manager' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <div>{m.message}</div>
                {m.created_at && (
                  <div className="mt-1 text-[10px] opacity-70">{new Date(m.created_at).toLocaleTimeString()}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <input
            className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 outline-none"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
          />
          <button disabled={sending} onClick={send} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60">Send</button>
        </div>
      </div>
    </div>
  );
}

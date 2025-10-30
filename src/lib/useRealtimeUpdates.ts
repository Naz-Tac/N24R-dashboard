import { useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase public environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimePayload<T = any> {
  eventType: RealtimeEvent;
  new: T | null;
  old: T | null;
  table: string;
}

export interface UseRealtimeUpdatesOptions<T = any> {
  table: string;
  onInsert?: (record: T) => void;
  onUpdate?: (record: T) => void;
  onDelete?: (record: T) => void;
  onChange?: (payload: RealtimePayload<T>) => void;
  enabled?: boolean;
}

/**
 * Custom hook for subscribing to Supabase Realtime updates
 * 
 * @example
 * useRealtimeUpdates({
 *   table: 'agents',
 *   onInsert: (record) => console.log('New agent:', record),
 *   onUpdate: (record) => console.log('Updated agent:', record),
 *   onDelete: (record) => console.log('Deleted agent:', record),
 * });
 */
export function useRealtimeUpdates<T = any>(
  options: UseRealtimeUpdatesOptions<T>
) {
  const { table, onInsert, onUpdate, onDelete, onChange, enabled = true } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (!enabled) {
      console.log(`[Realtime] Skipping subscription for ${table} (disabled)`);
      return;
    }

    const setupChannel = () => {
      console.log(`[Realtime] Setting up channel for table: ${table}`);

      // Create channel with unique name
      const channelName = `${table}-changes-${Date.now()}`;
      const channel = supabase.channel(channelName);

      // Subscribe to all changes on the table
      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
          },
          (payload: any) => {
            const eventType = payload.eventType as RealtimeEvent;
            console.log(`[Realtime] ${eventType} event on ${table}:`, payload);

            // Reset reconnect attempts on successful event
            reconnectAttemptsRef.current = 0;

            // Call specific event handlers
            if (eventType === 'INSERT' && onInsert && payload.new) {
              onInsert(payload.new as T);
            } else if (eventType === 'UPDATE' && onUpdate && payload.new) {
              onUpdate(payload.new as T);
            } else if (eventType === 'DELETE' && onDelete && payload.old) {
              onDelete(payload.old as T);
            }

            // Call generic onChange handler
            if (onChange) {
              onChange({
                eventType,
                new: payload.new || null,
                old: payload.old || null,
                table,
              });
            }
          }
        )
        .subscribe((status) => {
          console.log(`[Realtime] Channel ${channelName} status:`, status);

          if (status === 'CHANNEL_ERROR') {
            handleReconnect();
          } else if (status === 'SUBSCRIBED') {
            console.log(`[Realtime] Successfully subscribed to ${table}`);
            reconnectAttemptsRef.current = 0;
          }
        });

      channelRef.current = channel;
    };

    const handleReconnect = () => {
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.error(
          `[Realtime] Max reconnection attempts (${maxReconnectAttempts}) reached for ${table}`
        );
        return;
      }

      reconnectAttemptsRef.current += 1;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      console.log(
        `[Realtime] Reconnection attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts} for ${table} in ${delay}ms`
      );

      setTimeout(() => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
        }
        setupChannel();
      }, delay);
    };

    setupChannel();

    // Cleanup on unmount
    return () => {
      console.log(`[Realtime] Unsubscribing from ${table}`);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, enabled, onInsert, onUpdate, onDelete, onChange]);
}

/**
 * Utility function to manually trigger a channel subscription
 * Useful for testing or manual control
 */
export function createRealtimeChannel(
  table: string,
  callback: (payload: RealtimePayload) => void
): RealtimeChannel {
  const channelName = `${table}-manual-${Date.now()}`;
  const channel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
      },
      (payload: any) => {
        callback({
          eventType: payload.eventType,
          new: payload.new || null,
          old: payload.old || null,
          table,
        });
      }
    )
    .subscribe((status) => {
      console.log(`[Realtime] Manual channel ${channelName} status:`, status);
    });

  return channel;
}

export { supabase };

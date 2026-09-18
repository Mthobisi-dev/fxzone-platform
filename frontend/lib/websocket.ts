/**
 * FxZone Supabase Realtime WebSocket Client Wrapper
 * Replaces old Render/FastAPI WebSockets with Supabase Realtime Broadcast Channels.
 */

import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type WSCallback = (data: any) => void;

export class FxZoneWebSocket {
  private channel: RealtimeChannel | null = null;
  private channelName: string;
  private listeners: Map<string, Set<WSCallback>> = new Map();

  constructor(path: string) {
    // Sanitize path into valid Supabase channel name e.g. /ws/chat/123 -> chat_123
    const sanitized = path
      .replace(/^\/ws\//, '')
      .replace(/^\//, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    this.channelName = sanitized || 'fxzone_global';
  }

  /**
   * Connect to Supabase Realtime Channel.
   */
  public connect() {
    if (this.channel) return;

    this.channel = supabase.channel(this.channelName, {
      config: { broadcast: { self: true } },
    });

    this.channel
      .on('broadcast', { event: '*' }, (payload) => {
        const eventType = payload.event;
        const data = payload.payload;
        if (eventType) {
          this.emit(eventType, data);
        }
        this.emit('message', data);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.emit('open', null);
        }
      });
  }

  /**
   * Unsubscribe and close Supabase Realtime Channel.
   */
  public close() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  /**
   * Broadcast message over Supabase Realtime.
   */
  public send(payload: any) {
    if (!this.channel) return;
    const eventType = payload.type || payload.event || 'message';
    this.channel.send({
      type: 'broadcast',
      event: eventType,
      payload: payload,
    });
  }

  /**
   * Subscribe to specific data events (e.g. 'prices', 'message', 'notification', 'offer', 'answer', 'candidate').
   */
  public on(event: string, callback: WSCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from specific data events.
   */
  public off(event: string, callback: WSCallback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.warn('[Supabase Realtime Warning]', e);
        }
      });
    }
  }
}

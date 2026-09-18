/**
 * FxZone Supabase Realtime WebSocket Client Wrapper
 * Replaces old Render/FastAPI WebSockets with Supabase Realtime Broadcast Channels.
 */

import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type WSCallback = (data: any) => void;

export type WSState = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'CLOSING' | 'CLOSED';

export class FxZoneWebSocket {
  private channel: RealtimeChannel | null = null;
  private channelName: string;
  private listeners: Map<string, Set<WSCallback>> = new Map();
  private state: WSState = 'IDLE';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(path: string) {
    // Sanitize path into valid Supabase channel name e.g. /ws/chat/123 -> chat_123
    const sanitized = path
      .replace(/^\/ws\//, '')
      .replace(/^\//, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    this.channelName = sanitized || 'fxzone_global';
  }

  public getState(): WSState {
    return this.state;
  }

  /**
   * Connect to Supabase Realtime Channel.
   */
  public connect() {
    if (this.channel && (this.state === 'CONNECTED' || this.state === 'CONNECTING')) return;

    this.state = this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING';

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
          this.state = 'CONNECTED';
          this.reconnectAttempts = 0;
          this.emit('open', null);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          if (this.state !== 'CLOSING' && this.state !== 'CLOSED') {
            this.handleReconnect();
          }
        }
      });
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.state = 'CLOSED';
      this.emit('close', { reason: 'Max reconnect attempts reached' });
      return;
    }

    this.reconnectAttempts++;
    this.state = 'RECONNECTING';
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts) + Math.random() * 500, 10000);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.close();
      this.connect();
    }, delay);
  }

  /**
   * Unsubscribe and close Supabase Realtime Channel.
   */
  public close() {
    this.state = 'CLOSING';
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.state = 'CLOSED';
    this.emit('close', null);
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

/**
 * FxZone WebSocket Client with automatic reconnection and channel subscription.
 */

type WSCallback = (data: any) => void;

export class FxZoneWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Map<string, Set<WSCallback>> = new Map();
  private reconnectTimeout: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseDelay = 1000; // 1 second
  private isManualClose = false;
  private subscriptions: Set<string> = new Set();

  constructor(path: string) {
    // Check if path is absolute or relative
    if (path.startsWith('ws://') || path.startsWith('wss://')) {
      this.url = path;
    } else {
      // IMPORTANT: Vercel cannot proxy WebSocket connections.
      // We MUST connect directly to the backend WS URL, never through the Vercel proxy.
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        (typeof window !== 'undefined' && window.location.host.includes('localhost')
          ? 'http://localhost:8000'
          : 'https://fxzone-backend.onrender.com');

      // Convert http(s) → ws(s)
      const wsUrl = apiUrl.replace(/^http/, 'ws');
      this.url = `${wsUrl}${path.startsWith('/') ? path : '/' + path}`;
    }
  }

  /**
   * Connect to the WebSocket server with the user access token.
   */
  public connect() {
    this.isManualClose = false;
    
    // Inject access token in query parameter for security verification
    const token = typeof window !== 'undefined' ? localStorage.getItem('fxzone_access_token') : null;

    // Skip connecting to protected sockets if unauthenticated
    if (!token && (this.url.includes('/notifications') || this.url.includes('/chat') || this.url.includes('/live'))) {
      return;
    }

    const connectionUrl = token 
      ? `${this.url}${this.url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
      : this.url;

    try {
      this.ws = new WebSocket(connectionUrl);
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  /**
   * Close the WebSocket connection manually.
   */
  public close() {
    this.isManualClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Send a JSON string payload to the server.
   */
  public send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  /**
   * Subscribe to specific data events (e.g. 'prices', 'message', 'notification').
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

  private handleOpen() {
    this.reconnectAttempts = 0;
    this.emit('open', null);
    
    // Resubscribe to active symbols if we were disconnected
    if (this.subscriptions.size > 0) {
      this.send({
        action: 'subscribe',
        symbols: Array.from(this.subscriptions)
      });
    }
  }

  private handleMessage(event: MessageEvent) {
    try {
      const payload = jsonParse(event.data);
      if (payload && payload.type) {
        this.emit(payload.type, payload);
      } else {
        this.emit('message', payload);
      }
    } catch (e) {
      this.emit('raw_message', event.data);
    }
  }

  private handleClose(event: CloseEvent) {
    this.emit('close', event);
    // Don't auto-reconnect on manual close or policy violation (unauthorized code 1008)
    if (!this.isManualClose && event?.code !== 1008) {
      this.scheduleReconnect();
    }
  }

  private handleError(e: Event) {
    this.emit('error', e);
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      loggerError('Max reconnect attempts reached.');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts += 1;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private emit(event: string, data: any) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          loggerError(e);
        }
      });
    }
  }
}

// Inline helper functions to make the module self-contained
function jsonParse(str: string) {
  try { return JSON.parse(str); }
  catch { return null; }
}

function loggerError(e: any) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[WebSocket Client Warning]', e);
  }
}

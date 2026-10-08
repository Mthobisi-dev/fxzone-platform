import { useEffect, useRef } from 'react';
import { FxZoneWebSocket } from '@/lib/websocket';

export function useWebSocket(
  path: string,
  eventListeners: Record<string, (data: any) => void>,
  enabled = true,
) {
  const socketRef = useRef<FxZoneWebSocket | null>(null);
  const listenersRef = useRef(eventListeners);
  useEffect(() => { listenersRef.current = eventListeners; });
  const eventNames = Object.keys(eventListeners).sort().join(',');

  useEffect(() => {
    // Only connect in browser environment and when a path is provided
    if (typeof window === 'undefined' || !path || !enabled) return;

    // Create new WebSocket client
    const socket = new FxZoneWebSocket(path);
    socketRef.current = socket;

    // Register all event listeners
    const registered = eventNames.split(',').filter(Boolean).map((event) => {
      const callback = (data: any) => listenersRef.current[event]?.(data);
      socket.on(event, callback);
      return { event, callback };
    });

    // Establish connection
    void socket.connect();

    // Clean up on unmount or path change
    return () => {
      registered.forEach(({ event, callback }) => {
        socket.off(event, callback);
      });
      socket.close();
      socketRef.current = null;
    };
  }, [path, enabled, eventNames]);

  return socketRef;
}

import { useEffect, useRef } from 'react';
import { FxZoneWebSocket } from '@/lib/websocket';

export function useWebSocket(path: string, eventListeners: Record<string, (data: any) => void>) {
  const socketRef = useRef<FxZoneWebSocket | null>(null);

  useEffect(() => {
    // Only connect in browser environment
    if (typeof window === 'undefined') return;

    // Create new WebSocket client
    const socket = new FxZoneWebSocket(path);
    socketRef.current = socket;

    // Register all event listeners
    Object.entries(eventListeners).forEach(([event, callback]) => {
      socket.on(event, callback);
    });

    // Establish connection
    socket.connect();

    // Clean up on unmount
    return () => {
      Object.entries(eventListeners).forEach(([event, callback]) => {
        socket.off(event, callback);
      });
      socket.close();
    };
  }, [path, JSON.stringify(Object.keys(eventListeners))]);

  return socketRef;
}

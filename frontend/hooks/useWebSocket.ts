import { useEffect, useRef } from 'react';
import { FxZoneWebSocket } from '@/lib/websocket';

export function useWebSocket(path: string, eventListeners: Record<string, (data: any) => void>) {
  const socketRef = useRef<FxZoneWebSocket | null>(null);

  useEffect(() => {
    // Only connect in browser environment and when a path is provided
    if (typeof window === 'undefined' || !path) return;

    // Create new WebSocket client
    const socket = new FxZoneWebSocket(path);
    socketRef.current = socket;

    // Register all event listeners
    Object.entries(eventListeners).forEach(([event, callback]) => {
      socket.on(event, callback);
    });

    // Establish connection
    socket.connect();

    // Clean up on unmount or path change
    return () => {
      Object.entries(eventListeners).forEach(([event, callback]) => {
        socket.off(event, callback);
      });
      socket.close();
      socketRef.current = null;
    };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  return socketRef;
}

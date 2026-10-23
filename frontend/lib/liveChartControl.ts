export interface LiveChartControlAccess {
  viewerId?: string | null;
  hostId?: string | null;
  controllerId?: string | null;
}

function normalized(value: string | null | undefined): string {
  return String(value || '').trim();
}

/** The host always controls the chart; an admitted viewer may be delegated control. */
export function canControlLiveChart({ viewerId, hostId, controllerId }: LiveChartControlAccess): boolean {
  const viewer = normalized(viewerId);
  if (!viewer) return false;
  return viewer === normalized(hostId) || (!!normalized(controllerId) && viewer === normalized(controllerId));
}

/** Only the host or the currently delegated controller may publish chart changes. */
export function canAcceptLiveChartContext({ senderId, hostId, controllerId }: Omit<LiveChartControlAccess, 'viewerId'> & { senderId?: string | null }): boolean {
  const sender = normalized(senderId);
  return !!sender && (sender === normalized(hostId) || (!!normalized(controllerId) && sender === normalized(controllerId)));
}

/** Realtime chart-control events are authoritative only when sent by the host. */
export function isLiveChartControlEventFromHost(senderId: string | null | undefined, hostId: string | null | undefined): boolean {
  const sender = normalized(senderId);
  return !!sender && sender === normalized(hostId);
}

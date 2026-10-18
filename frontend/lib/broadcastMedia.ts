// These are picker hints, not restrictions: browsers may ignore them. Prefer
// an entire display so viewers keep seeing the host as they navigate FxZone.
// The host view omits local video so capture cannot feed back into itself.
type BroadcastCaptureOptions = DisplayMediaStreamOptions & {
  selfBrowserSurface: 'exclude';
  surfaceSwitching: 'include';
  systemAudio: 'exclude';
};

export function broadcastCaptureOptions(): BroadcastCaptureOptions {
  return {
    video: { displaySurface: 'monitor', frameRate: { ideal: 30, max: 30 } },
    audio: true,
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
    systemAudio: 'exclude',
  };
}

export function stopBroadcastTracks(stream: MediaStream): void {
  stream.getTracks().forEach((track) => {
    track.onended = null;
    track.stop();
  });
}

/** True only when the active browser exposes the screen-capture API. */
export function supportsScreenShare(mediaDevices?: Pick<MediaDevices, 'getDisplayMedia'>): boolean {
  return typeof mediaDevices?.getDisplayMedia === 'function';
}

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

export type ShareCapability = 'supported' | 'unsupported' | 'restricted';

export function getScreenShareCapability(navigatorLike: {
  userAgent?: string;
  mediaDevices?: { getDisplayMedia?: unknown };
} | null | undefined): ShareCapability {
  if (typeof navigatorLike?.mediaDevices?.getDisplayMedia !== 'function') return 'unsupported';
  return /iphone|ipad|ipod/i.test(String(navigatorLike.userAgent || '')) ? 'restricted' : 'supported';
}

export function screenShareUnavailableMessage(capability: ShareCapability): string {
  return capability === 'restricted'
    ? 'Screen sharing is restricted by this mobile browser. Open the session in a supported desktop or Android browser to present.'
    : 'This browser cannot share a device screen. Keep watching here or open the session in a browser with native screen capture support.';
}

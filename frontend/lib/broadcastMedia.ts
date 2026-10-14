// These are picker hints, not restrictions: browsers may ignore them. The
// host view also omits local video so entire-screen capture cannot feed back.
type BroadcastCaptureOptions = DisplayMediaStreamOptions & {
  selfBrowserSurface: 'exclude';
  surfaceSwitching: 'include';
  systemAudio: 'exclude';
};

export function broadcastCaptureOptions(): BroadcastCaptureOptions {
  return {
    video: { displaySurface: 'window', frameRate: { ideal: 30, max: 30 } },
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

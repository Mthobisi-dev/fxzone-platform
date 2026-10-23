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

export interface BroadcastCaptureResult {
  stream: MediaStream;
  microphoneTrack: MediaStreamTrack | null;
  sharedAudioTrack: MediaStreamTrack | null;
  microphoneError: string | null;
}

/**
 * Capture the display together with the host microphone. Display audio is
 * optional because browsers only expose it for some tabs/windows. A denied
 * microphone must not discard an otherwise valid screen share; the caller can
 * show the returned warning and keep the broadcast running.
 */
export async function captureBroadcastStream(
  mediaDevices: Pick<MediaDevices, 'getDisplayMedia' | 'getUserMedia'> = navigator.mediaDevices,
): Promise<BroadcastCaptureResult> {
  const displayStream = await mediaDevices.getDisplayMedia(broadcastCaptureOptions());
  const displayAudioTracks = typeof displayStream.getAudioTracks === 'function' ? displayStream.getAudioTracks() : [];
  const sharedAudioTrack = displayAudioTracks[0] || null;
  let microphoneTrack: MediaStreamTrack | null = null;
  let microphoneError: string | null = null;

  if (typeof mediaDevices.getUserMedia === 'function') {
    try {
      const microphoneStream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      microphoneTrack = microphoneStream.getAudioTracks()[0] || null;
      if (microphoneTrack && typeof displayStream.addTrack === 'function') displayStream.addTrack(microphoneTrack);
    } catch (error) {
      microphoneError = error instanceof Error ? error.message : 'Microphone permission was not granted.';
    }
  } else {
    microphoneError = 'This browser does not expose microphone capture.';
  }

  return { stream: displayStream, microphoneTrack, sharedAudioTrack, microphoneError };
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

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
 * Keep a screen-share readable while putting a hard ceiling on the amount of
 * video a peer connection can send. Screen captures can otherwise inherit a
 * 4K/60Hz desktop format and saturate the uplink, which presents to viewers as
 * buffering and delayed input.
 */
export const BROADCAST_VIDEO_MAX_BITRATE = 2_500_000;
export const BROADCAST_VIDEO_MAX_FRAMERATE = 30;
export const BROADCAST_AUDIO_MAX_BITRATE = 128_000;

export async function constrainBroadcastVideoTrack(
  track: Pick<MediaStreamTrack, 'kind'> & { applyConstraints?: (constraints: MediaTrackConstraints) => Promise<void> },
): Promise<void> {
  if (track.kind !== 'video') return;
  configureBroadcastTrack(track);
  if (typeof track.applyConstraints !== 'function') return;
  try {
    await track.applyConstraints({
      width: { max: 1920 },
      height: { max: 1080 },
      frameRate: { max: BROADCAST_VIDEO_MAX_FRAMERATE },
    });
  } catch {
    // A browser may reject display-track constraints after the picker. The
    // sender bitrate ceiling remains active and the original track is valid.
  }
}

export function configureBroadcastTrack(track: Pick<MediaStreamTrack, 'kind'> & { contentHint?: string }): void {
  try {
    track.contentHint = track.kind === 'video' ? 'detail' : 'speech';
  } catch {
    // Older browsers expose contentHint as read-only. Sender parameters below
    // still provide the congestion guard in those browsers.
  }
}

export async function tuneBroadcastSender(
  sender: Pick<RTCRtpSender, 'getParameters' | 'setParameters'>,
  track: Pick<MediaStreamTrack, 'kind'> | null,
): Promise<void> {
  if (track) configureBroadcastTrack(track);
  try {
    const parameters = sender.getParameters();
    const encodings = parameters.encodings?.length ? parameters.encodings : [{}];
    const isVideo = track?.kind === 'video' || encodings.some((encoding) => encoding.maxFramerate !== undefined);
    parameters.encodings = encodings.map((encoding) => ({
      ...encoding,
      ...(isVideo
        ? { maxBitrate: BROADCAST_VIDEO_MAX_BITRATE, maxFramerate: BROADCAST_VIDEO_MAX_FRAMERATE }
        : { maxBitrate: BROADCAST_AUDIO_MAX_BITRATE }),
    }));
    if (isVideo) parameters.degradationPreference = 'maintain-resolution';
    await sender.setParameters(parameters);
  } catch {
    // setParameters is not implemented by some older mobile browsers. The
    // stream remains valid and the browser's default congestion controller is
    // used instead.
  }
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
  const displayVideoTrack = typeof displayStream.getVideoTracks === 'function' ? displayStream.getVideoTracks()[0] : null;
  if (displayVideoTrack) await constrainBroadcastVideoTrack(displayVideoTrack);
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

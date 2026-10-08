/**
 * FxZone WebRTC Client Manager
 * Institutional-grade peer-to-peer screen sharing and real-time audio/video streaming.
 */
import { api } from '@/lib/api';

function buildBaseRtcConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];

  return {
    iceServers,
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };
}

interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
}

export interface WebRTCOptions {
  sessionId?: string | number;
  currentUserId?: string;
  currentUsername?: string;
  isHost?: boolean;
  isPresenter?: boolean;
  onStream?: (stream: MediaStream | null, presenterInfo?: { userId: string; username?: string }) => void;
  onSignal?: (signal: any) => void;
  onPresenterStatusChange?: (isLive: boolean, presenterName?: string) => void;
}

export class WebRTCClient {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private negotiatingPeers: Set<string> = new Set();
  private signalQueues = new Map<string, Promise<void>>();
  private restartAttempts = new Map<string, number>();
  private closed = false;
  private localStream: MediaStream | null = null;
  private sessionId: string;
  private currentUserId: string = '';
  private currentUsername: string = '';
  private isPresenter: boolean = false;
  private onStreamCallback: ((stream: MediaStream | null, presenterInfo?: { userId: string; username?: string }) => void) | null = null;
  private onSignalCallback: ((signal: any) => void) | null = null;
  private onPeerLeftCallback: ((userId: string) => void) | null = null;
  private onPresenterStatusChangeCallback: ((isLive: boolean, presenterName?: string) => void) | null = null;
  private rtcConfig: RTCConfiguration = buildBaseRtcConfig();
  private turnCredentialsPromise: Promise<void> | null = null;

  constructor(options: WebRTCOptions | string | number, isPresenter: boolean = false) {
    if (typeof options === 'object' && options !== null) {
      this.sessionId = String(options.sessionId || '');
      this.currentUserId = String(options.currentUserId || '');
      this.currentUsername = String(options.currentUsername || '');
      this.isPresenter = !!(options.isHost || options.isPresenter);
      if (options.onStream) this.onStreamCallback = options.onStream;
      if (options.onSignal) this.onSignalCallback = options.onSignal;
      if (options.onPresenterStatusChange) this.onPresenterStatusChangeCallback = options.onPresenterStatusChange;
    } else {
      this.sessionId = String(options);
      this.isPresenter = isPresenter;
    }
  }

  public setCurrentUserId(userId: string) {
    this.currentUserId = String(userId || '');
  }

  /**
   * Set or update local MediaStream (Screen Share or Camera).
   */
  public async setLocalStream(stream: MediaStream | null) {
    if (this.closed) return;
    this.localStream = stream;

    if (stream) {
      // Notify local callback
      if (this.onStreamCallback) {
        this.onStreamCallback(stream, { userId: this.currentUserId, username: 'You' });
      }

      // Update tracks in existing peer connections or create new offers
      const peers = Array.from(this.peerConnections.entries());
      for (let i = 0; i < peers.length; i++) {
        const [peerId, pc] = peers[i];
        try {
          const senders = pc.getSenders();
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];

          if (senders.length > 0) {
            const videoSender = senders.find((s: RTCRtpSender) => s.track?.kind === 'video');
            const audioSender = senders.find((s: RTCRtpSender) => s.track?.kind === 'audio');

            if (videoSender && videoTrack) {
              await videoSender.replaceTrack(videoTrack);
            } else if (videoTrack) {
              pc.addTrack(videoTrack, stream);
            }

            if (audioSender && audioTrack) {
              await audioSender.replaceTrack(audioTrack);
            } else if (audioTrack) {
              pc.addTrack(audioTrack, stream);
            }
          } else {
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));
          }

          // Renegotiate connection with peer
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);
          this.sendSignal({
            target_user_id: peerId,
            type: 'offer',
            data: offer,
          });
        } catch (e) {
          console.error(`Error updating stream tracks for peer ${peerId}:`, e);
        }
      }

      // Announce to all room peers that presenter stream has started
      this.sendSignal({
        type: 'presenter_stream_started',
        data: { active: true, presenter_id: this.currentUserId },
      });
    } else {
      // Stream stopped — remove tracks from connections and announce stop
      this.peerConnections.forEach((pc) => {
        pc.getSenders().forEach((sender: RTCRtpSender) => {
          try {
            pc.removeTrack(sender);
          } catch (e) {
            // Safe ignore
          }
        });
      });

      this.sendSignal({
        type: 'presenter_stream_stopped',
        data: { active: false, presenter_id: this.currentUserId },
      });

      if (this.onStreamCallback) {
        this.onStreamCallback(null);
      }
    }
  }

  /**
   * Capture local screen and start streaming with high definition parameters.
   */
  public async startLocalStream(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          cursor: 'always',
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920, max: 2560 },
          height: { ideal: 1080, max: 1440 },
        } as any,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      await this.setLocalStream(stream);

      // Handle user stopping screen share via native browser bar
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.setLocalStream(null);
        };
      }

      return stream;
    } catch (err) {
      console.error('Failed to capture screen stream:', err);
      throw err;
    }
  }

  /**
   * Toggle microphone audio track state.
   */
  public toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Toggle camera / video track state.
   */
  public toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Handle incoming WebRTC signaling payload from WebSocket.
   */
  public async handleSignal(payload: any) {
    if (!payload || this.closed) return;
    const signal = payload.type === 'rtc_signal' ? payload.data : payload;
    const sender = String(signal?.sender_id || signal?.user_id || '');
    // SDP and ICE handlers await browser operations. Process each peer's
    // messages in order so two offers cannot create competing connections.
    const queued = (this.signalQueues.get(sender) || Promise.resolve())
      .then(() => this.closed ? undefined : this.processSignal(payload));
    this.signalQueues.set(sender, queued);
    try { await queued; } finally {
      if (this.signalQueues.get(sender) === queued) this.signalQueues.delete(sender);
    }
  }

  private async processSignal(payload: any) {

    // Normalization across signal wrapper payloads
    const rawData = payload.data || payload;
    const senderId = String(payload.sender_id || rawData.sender_id || payload.user_id || rawData.user_id || '');
    const targetUserId = String(payload.target_user_id || rawData.target_user_id || '');
    const senderUsername = payload.sender_username || rawData.sender_username || rawData.username;
    const signalType = payload.type === 'rtc_signal' ? (rawData.type || 'rtc_signal') : (payload.type || rawData.type);
    const signalData = rawData.data !== undefined ? rawData.data : rawData;

    // Ignore self-dispatched signals to prevent self-connection loops
    if (senderId && this.currentUserId && senderId === this.currentUserId) {
      return;
    }

    // Session signaling uses one private Broadcast topic. SDP and ICE payloads
    // are still addressed to one peer, so every other participant must ignore
    // a message that is not intended for them.
    if (targetUserId && this.currentUserId && targetUserId !== this.currentUserId) {
      return;
    }

    try {
      switch (signalType) {
        case 'peer_joined':
          // Another user joined the room: if we are presenting an active stream, offer to them
          if (this.localStream && senderId) {
            await this.initiatePeerConnection(senderId);
          }
          break;

        case 'request_stream':
          // Peer explicitly requested our stream
          if (this.localStream && senderId) {
            const pc = this.peerConnections.get(senderId);
            if (signalData.restart && pc && pc.signalingState === 'stable') {
              await this.restartPeer(senderId, pc);
            } else {
              await this.initiatePeerConnection(senderId);
            }
          }
          break;

        case 'presenter_stream_started':
          // Presenter started sharing: request stream from presenter
          if (this.onPresenterStatusChangeCallback) {
            this.onPresenterStatusChangeCallback(true, senderUsername);
          }
          if (senderId && !this.localStream) {
            this.sendSignal({
              target_user_id: senderId,
              type: 'request_stream',
              data: {},
            });
          }
          break;

        case 'presenter_stream_stopped':
          // Presenter stopped sharing
          if (this.onPresenterStatusChangeCallback) {
            this.onPresenterStatusChangeCallback(false);
          }
          if (!this.localStream && this.onStreamCallback) {
            this.onStreamCallback(null);
          }
          break;

        case 'offer':
          if (senderId) {
            const offerPayload = signalData.sdp ? signalData : (signalData.offer || signalData);
            await this.handleOffer(senderId, offerPayload, senderUsername);
          }
          break;

        case 'answer':
          if (senderId) {
            const answerPayload = signalData.sdp ? signalData : (signalData.answer || signalData);
            await this.handleAnswer(senderId, answerPayload);
          }
          break;

        case 'candidate':
          if (senderId) {
            const candidatePayload = signalData.candidate ? signalData : (signalData.candidatePayload || signalData);
            await this.handleCandidate(senderId, candidatePayload);
          }
          break;

        case 'peer_left':
          if (senderId) {
            this.handlePeerLeft(senderId);
          }
          break;
      }
    } catch (err) {
      console.error(`WebRTC signal error handling ${signalType} from ${senderId}:`, err);
    }
  }

  /**
   * Clean up a disconnected peer.
   */
  private handlePeerLeft(peerId: string, closedConnection?: RTCPeerConnection) {
    const pc = this.peerConnections.get(peerId);
    // Re-offering replaces an old connection with a new one. A delayed
    // `closed` event from that old connection must never remove the replacement.
    if (closedConnection && pc !== closedConnection) {
      return;
    }
    if (pc) {
      this.peerConnections.delete(peerId);
      pc.onconnectionstatechange = null;
      try {
        pc.close();
      } catch (e) {
        // Safe ignore
      }
    }
    this.pendingCandidates.delete(peerId);
    this.restartAttempts.delete(peerId);
    if (this.onPeerLeftCallback) {
      this.onPeerLeftCallback(peerId);
    }
  }

  /**
   * Presenter initiates connection and sends SDP offer to a specific peer.
   */
  private async initiatePeerConnection(targetUserId: string) {
    if (this.closed || !this.localStream || this.negotiatingPeers.has(targetUserId)) return;

    const existing = this.peerConnections.get(targetUserId);
    // A reconnect can re-announce a peer. Keep its healthy connection rather
    // than resetting the stream and creating competing SDP offers.
    if (existing && existing.signalingState !== 'closed' && (
      existing.connectionState === 'connected' || existing.connectionState === 'connecting' ||
      existing.signalingState === 'have-local-offer'
    )) {
      return;
    }

    this.negotiatingPeers.add(targetUserId);
    try {
      if (existing && existing.signalingState !== 'closed') {
        this.peerConnections.delete(targetUserId);
        existing.onconnectionstatechange = null;
        try {
          existing.close();
        } catch {
          // The replacement below is still safe if the stale peer is already closed.
        }
      }

      const pc = await this.createPeerConnection(targetUserId);
      if (this.closed || !this.localStream) { pc.close(); return; }
      this.peerConnections.set(targetUserId, pc);

      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      this.sendSignal({
        target_user_id: targetUserId,
        type: 'offer',
        data: offer,
      });
    } finally {
      this.negotiatingPeers.delete(targetUserId);
    }
  }

  /**
   * Handle incoming SDP offer from presenter.
   */
  private async handleOffer(senderId: string, offerData: any, senderUsername?: string) {
    let pc = this.peerConnections.get(senderId);
    if (!pc || pc.signalingState === 'closed') {
      pc = await this.createPeerConnection(senderId, senderUsername);
      if (this.closed) { pc.close(); return; }
      this.peerConnections.set(senderId, pc);
    } else if (pc.signalingState === 'have-local-offer') {
      // Deterministic glare handling when two participants share together.
      if (this.currentUserId < senderId) return;
      await pc.setLocalDescription({ type: 'rollback' });
    }

    // If viewer also has local media tracks (e.g. 2-way voice/mic)
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (!pc!.getSenders().some((sender) => sender.track === track)) {
          pc!.addTrack(track, this.localStream!);
        }
      });
    }

    const sessionDesc = offerData instanceof RTCSessionDescription
      ? offerData
      : new RTCSessionDescription(offerData);

    await pc.setRemoteDescription(sessionDesc);

    // Flush any ICE candidates queued before remote description was ready
    await this.flushPendingCandidates(senderId, pc);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignal({
      target_user_id: senderId,
      type: 'answer',
      data: answer,
    });
  }

  /**
   * Handle incoming SDP answer from viewer.
   */
  private async handleAnswer(senderId: string, answerData: any) {
    const pc = this.peerConnections.get(senderId);
    if (!pc) return;

    if (pc.signalingState === 'have-local-offer') {
      const sessionDesc = answerData instanceof RTCSessionDescription
        ? answerData
        : new RTCSessionDescription(answerData);
      await pc.setRemoteDescription(sessionDesc);
      await this.flushPendingCandidates(senderId, pc);
    }
  }

  /**
   * Handle incoming ICE candidate with buffering support.
   */
  private async handleCandidate(senderId: string, candidateData: any) {
    const pc = this.peerConnections.get(senderId);
    const candidateObj = candidateData?.candidate !== undefined ? candidateData : candidateData?.data;
    if (!candidateObj) return;

    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateObj));
      } catch (err) {
        console.warn(`Could not add direct ICE candidate for ${senderId}:`, err);
      }
    } else {
      // Buffer until setRemoteDescription completes
      const queue = this.pendingCandidates.get(senderId) || [];
      queue.push(candidateObj);
      this.pendingCandidates.set(senderId, queue);
    }
  }

  /**
   * Flush pending ICE candidate queue once remote description is set.
   */
  private async flushPendingCandidates(senderId: string, pc: RTCPeerConnection) {
    const queue = this.pendingCandidates.get(senderId);
    if (queue && queue.length > 0) {
      for (let i = 0; i < queue.length; i++) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(queue[i]));
        } catch (e) {
          console.warn('Error flushing buffered ICE candidate:', e);
        }
      }
      this.pendingCandidates.delete(senderId);
    }
  }

  /**
   * Create an RTCPeerConnection with configured handlers.
   */
  private async createPeerConnection(targetUserId: string, targetUsername?: string): Promise<RTCPeerConnection> {
    await this.loadTurnCredentials();
    const pc = new RTCPeerConnection(this.rtcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          target_user_id: targetUserId,
          type: 'candidate',
          data: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const incomingStream = event.streams[0] || new MediaStream([event.track]);
      if (this.onStreamCallback) {
        this.onStreamCallback(incomingStream, { userId: targetUserId, username: targetUsername });
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.closed || this.peerConnections.get(targetUserId) !== pc) return;
      if (pc.connectionState === 'failed') {
        if (this.localStream) {
          void this.restartPeer(targetUserId, pc).catch((error) => console.warn('ICE recovery failed:', error));
        } else {
          this.sendSignal({ type: 'request_stream', target_user_id: targetUserId, data: { restart: true } });
        }
      } else if (pc.connectionState === 'connected') {
        this.restartAttempts.delete(targetUserId);
      } else if (pc.connectionState === 'closed') {
        this.handlePeerLeft(targetUserId, pc);
      }
    };

    return pc;
  }

  private async restartPeer(peerId: string, pc: RTCPeerConnection) {
    const attempts = this.restartAttempts.get(peerId) || 0;
    if (this.closed || attempts >= 2 || pc.signalingState !== 'stable' || this.negotiatingPeers.has(peerId)) return;
    this.restartAttempts.set(peerId, attempts + 1);
    this.negotiatingPeers.add(peerId);
    try {
      // restartIce alone only fires negotiationneeded; no handler was sending
      // the new SDP. Explicitly negotiate refreshed ICE credentials.
      const offer = await pc.createOffer({ iceRestart: true });
      if (this.closed || this.peerConnections.get(peerId) !== pc) return;
      await pc.setLocalDescription(offer);
      this.sendSignal({ type: 'offer', target_user_id: peerId, data: offer });
    } finally { this.negotiatingPeers.delete(peerId); }
  }

  private async loadTurnCredentials(): Promise<void> {
    if (!this.sessionId) return;
    if (!this.turnCredentialsPromise) {
      this.turnCredentialsPromise = (async () => {
        try {
          const credentials = await api.get('/api/webrtc/credentials', {
            params: { sessionId: this.sessionId },
            timeoutMs: 5_000,
          }) as TurnCredentials;
          if (!Array.isArray(credentials?.urls) || !credentials.urls.length || !credentials.username || !credentials.credential) {
            return;
          }
          this.rtcConfig = {
            ...buildBaseRtcConfig(),
            iceServers: [
              ...(buildBaseRtcConfig().iceServers || []),
              {
                urls: credentials.urls,
                username: credentials.username,
                credential: credentials.credential,
              },
            ],
          };
        } catch {
          // TURN is an optional relay fallback. STUN-only connections continue
          // to work when the deployment has no coturn-compatible provider.
        }
      })();
    }
    await this.turnCredentialsPromise;
  }

  /**
   * Send signaling message to parent or WebSocket channel.
   */
  private sendSignal(payload: any) {
    if (!this.closed && this.onSignalCallback) {
      this.onSignalCallback({
        ...payload,
        sender_id: this.currentUserId,
        ...(this.currentUsername ? { sender_username: this.currentUsername } : {}),
      });
    }
  }

  /**
   * Clean up all peer connections and local media tracks.
   */
  public close() {
    this.closed = true;
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.peerConnections.forEach((pc) => {
      pc.onconnectionstatechange = null;
      try {
        pc.close();
      } catch (e) {
        // Safe ignore
      }
    });
    this.peerConnections.clear();
    this.pendingCandidates.clear();
    this.negotiatingPeers.clear();
    this.signalQueues.clear();
    this.restartAttempts.clear();
  }

  public disconnect() {
    this.close();
  }
}

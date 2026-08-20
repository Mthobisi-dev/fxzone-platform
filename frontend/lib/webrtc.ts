/**
 * FxZone WebRTC Client Manager
 * Institutional-grade peer-to-peer screen sharing and real-time audio/video streaming.
 */

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

export interface WebRTCOptions {
  sessionId?: string | number;
  currentUserId?: string;
  isHost?: boolean;
  isPresenter?: boolean;
  onStream?: (stream: MediaStream | null, presenterInfo?: { userId: string; username?: string }) => void;
  onSignal?: (signal: any) => void;
  onPresenterStatusChange?: (isLive: boolean, presenterName?: string) => void;
}

export class WebRTCClient {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private localStream: MediaStream | null = null;
  private sessionId: string;
  private currentUserId: string = '';
  private isPresenter: boolean = false;
  private onStreamCallback: ((stream: MediaStream | null, presenterInfo?: { userId: string; username?: string }) => void) | null = null;
  private onSignalCallback: ((signal: any) => void) | null = null;
  private onPeerLeftCallback: ((userId: string) => void) | null = null;
  private onPresenterStatusChangeCallback: ((isLive: boolean, presenterName?: string) => void) | null = null;

  constructor(options: WebRTCOptions | string | number, isPresenter: boolean = false) {
    if (typeof options === 'object' && options !== null) {
      this.sessionId = String(options.sessionId || '');
      this.currentUserId = String(options.currentUserId || '');
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
    if (!payload) return;

    // Normalization across signal wrapper payloads
    const rawData = payload.data || payload;
    const senderId = String(payload.sender_id || rawData.sender_id || payload.user_id || rawData.user_id || '');
    const senderUsername = payload.sender_username || rawData.sender_username || rawData.username;
    const signalType = payload.type === 'rtc_signal' ? (rawData.type || 'rtc_signal') : (payload.type || rawData.type);
    const signalData = rawData.data !== undefined ? rawData.data : rawData;

    // Ignore self-dispatched signals to prevent self-connection loops
    if (senderId && this.currentUserId && senderId === this.currentUserId) {
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
            await this.initiatePeerConnection(senderId);
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
  private handlePeerLeft(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {
        // Safe ignore
      }
      this.peerConnections.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
    if (this.onPeerLeftCallback) {
      this.onPeerLeftCallback(peerId);
    }
  }

  /**
   * Presenter initiates connection and sends SDP offer to a specific peer.
   */
  private async initiatePeerConnection(targetUserId: string) {
    let pc = this.peerConnections.get(targetUserId);
    if (pc && pc.signalingState !== 'closed') {
      try {
        pc.close();
      } catch (e) {
        // Safe ignore
      }
    }

    pc = this.createPeerConnection(targetUserId);
    this.peerConnections.set(targetUserId, pc);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc!.addTrack(track, this.localStream!);
      });
    }

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
  }

  /**
   * Handle incoming SDP offer from presenter.
   */
  private async handleOffer(senderId: string, offerData: any, senderUsername?: string) {
    let pc = this.peerConnections.get(senderId);
    if (pc && pc.signalingState !== 'closed') {
      try {
        pc.close();
      } catch (e) {
        // Safe ignore
      }
    }

    pc = this.createPeerConnection(senderId, senderUsername);
    this.peerConnections.set(senderId, pc);

    // If viewer also has local media tracks (e.g. 2-way voice/mic)
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc!.addTrack(track, this.localStream!);
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
  private createPeerConnection(targetUserId: string, targetUsername?: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(RTC_CONFIG);

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
      if (pc.connectionState === 'failed') {
        console.warn(`WebRTC connection to ${targetUserId} failed, attempting restart...`);
        pc.restartIce();
      } else if (pc.connectionState === 'closed') {
        this.handlePeerLeft(targetUserId);
      }
    };

    return pc;
  }

  /**
   * Send signaling message to parent or WebSocket channel.
   */
  private sendSignal(payload: any) {
    if (this.onSignalCallback) {
      this.onSignalCallback(payload);
    }
  }

  /**
   * Clean up all peer connections and local media tracks.
   */
  public close() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {
        // Safe ignore
      }
    });
    this.peerConnections.clear();
    this.pendingCandidates.clear();
  }

  public disconnect() {
    this.close();
  }
}

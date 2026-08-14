/**
 * FxZone WebRTC Client Manager
 * High-reliability peer-to-peer screen sharing and real-time audio/video routing.
 */

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

export interface WebRTCOptions {
  sessionId?: string | number;
  isHost?: boolean;
  isPresenter?: boolean;
  onStream?: (stream: MediaStream | null) => void;
  onSignal?: (signal: any) => void;
}

export class WebRTCClient {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private localStream: MediaStream | null = null;
  private sessionId: string;
  private isPresenter: boolean = false;
  private onStreamCallback: ((stream: MediaStream | null) => void) | null = null;
  private onSignalCallback: ((signal: any) => void) | null = null;
  private onPeerLeftCallback: ((userId: string) => void) | null = null;

  constructor(options: WebRTCOptions | string | number, isPresenter: boolean = false) {
    if (typeof options === 'object' && options !== null) {
      this.sessionId = String(options.sessionId || '');
      this.isPresenter = !!(options.isHost || options.isPresenter);
      if (options.onStream) this.onStreamCallback = options.onStream;
      if (options.onSignal) this.onSignalCallback = options.onSignal;
    } else {
      this.sessionId = String(options);
      this.isPresenter = isPresenter;
    }
  }

  /**
   * Set or update local MediaStream (Screen Share or Camera).
   */
  public async setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;

    if (stream) {
      // Notify local callback
      if (this.onStreamCallback && this.isPresenter) {
        this.onStreamCallback(stream);
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
        data: { active: true },
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
        data: { active: false },
      });
    }
  }

  /**
   * Capture local screen and start streaming.
   */
  public async startLocalStream(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          cursor: 'always',
          frameRate: { max: 30 },
        } as any,
        audio: true,
      });

      await this.setLocalStream(stream);

      // Handle user stopping screen share via browser floating UI
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
    const senderId = String(payload.sender_id || payload.user_id || '');
    const signalType = payload.type;
    const signalData = payload.data || payload;

    if (!senderId) return;

    try {
      switch (signalType) {
        case 'peer_joined':
          // Viewer joined the room: if we are presenter with an active stream, send an offer
          if (this.isPresenter && this.localStream) {
            await this.initiatePeerConnection(senderId);
          }
          break;

        case 'request_stream':
          // Peer explicitly requested stream from presenter
          if (this.isPresenter && this.localStream) {
            await this.initiatePeerConnection(senderId);
          }
          break;

        case 'presenter_stream_started':
          // Presenter started sharing: if we are a viewer, request their stream
          if (!this.isPresenter) {
            this.sendSignal({
              target_user_id: senderId,
              type: 'request_stream',
              data: {},
            });
          }
          break;

        case 'presenter_stream_stopped':
          // Presenter stopped sharing
          if (!this.isPresenter) {
            if (this.onStreamCallback) {
              this.onStreamCallback(null);
            }
          }
          break;

        case 'offer':
          await this.handleOffer(senderId, signalData.data || signalData);
          break;

        case 'answer':
          await this.handleAnswer(senderId, signalData.data || signalData);
          break;

        case 'candidate':
          await this.handleCandidate(senderId, signalData.data || signalData);
          break;

        case 'peer_left':
          this.handlePeerLeft(senderId);
          break;
      }
    } catch (err) {
      console.error(`WebRTC signal error handling ${signalType} from ${senderId}:`, err);
    }
  }

  /**
   * Viewer or peer left room.
   */
  private handlePeerLeft(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
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
    if (pc) {
      pc.close();
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
  private async handleOffer(senderId: string, offerData: any) {
    let pc = this.peerConnections.get(senderId);
    if (pc && pc.signalingState !== 'closed') {
      pc.close();
    }

    pc = this.createPeerConnection(senderId);
    this.peerConnections.set(senderId, pc);

    // If viewer also has local media tracks (2-way audio/video)
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc!.addTrack(track, this.localStream!);
      });
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offerData));

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
      await pc.setRemoteDescription(new RTCSessionDescription(answerData));
      await this.flushPendingCandidates(senderId, pc);
    }
  }

  /**
   * Handle incoming ICE candidate with buffering support.
   */
  private async handleCandidate(senderId: string, candidateData: any) {
    const pc = this.peerConnections.get(senderId);
    const candidate = candidateData?.candidate ? candidateData : candidateData?.data;
    if (!candidate) return;

    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn(`Could not add direct ICE candidate for ${senderId}:`, err);
      }
    } else {
      // Buffer until setRemoteDescription completes
      const queue = this.pendingCandidates.get(senderId) || [];
      queue.push(candidate);
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
  private createPeerConnection(targetUserId: string): RTCPeerConnection {
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
        this.onStreamCallback(incomingStream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
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

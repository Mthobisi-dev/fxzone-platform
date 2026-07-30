/**
 * FxZone WebRTC client manager for peer-to-peer screen sharing and audio.
 */

export class WebRTCClient {
  private peerConnections: Map<string | number, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private sessionId: string | number;
  private signalSocket: WebSocket | null = null;
  private onRemoteStreamCallback: ((userId: string | number, stream: MediaStream) => void) | null = null;
  private onPeerLeftCallback: ((userId: string | number) => void) | null = null;
  private isPresenter: boolean = false;
  private onStreamCallback: ((stream: MediaStream | null) => void) | null = null;
  private onSignalCallback: ((signal: any) => void) | null = null;

  constructor(options: {
    sessionId?: string | number;
    isHost?: boolean;
    isPresenter?: boolean;
    onStream?: (stream: MediaStream | null) => void;
    onSignal?: (signal: any) => void;
  } | string | number, isPresenter: boolean = false) {
    if (typeof options === 'object' && options !== null) {
      this.sessionId = options.sessionId || '';
      this.isPresenter = options.isHost || options.isPresenter || false;
      if (options.onStream) {
        this.onStreamCallback = options.onStream;
      }
      if (options.onSignal) {
        this.onSignalCallback = options.onSignal;
      }
    } else {
      this.sessionId = options;
      this.isPresenter = isPresenter;
    }
  }

  /**
   * Set local MediaStream directly.
   */
  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    if (this.onStreamCallback && stream) {
      this.onStreamCallback(stream);
    }
    
    // Add tracks to existing peer connections if stream changes
    if (stream) {
      this.peerConnections.forEach((pc) => {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      });
    }
  }

  /**
   * Enable or disable audio track.
   */
  public toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Enable or disable video track.
   */
  public toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Initialize screen capture and presenter streams.
   */
  public async startLocalStream(): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: true,
      });
      if (this.onStreamCallback) {
        this.onStreamCallback(this.localStream);
      }
      return this.localStream;
    } catch (e) {
      console.error('Failed to get local screen stream:', e);
      throw e;
    }
  }

  /**
   * Set callback for when a remote user joins and shares their stream.
   */
  public onRemoteStream(callback: (userId: string | number, stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  /**
   * Set callback for when a peer leaves the stream room.
   */
  public onPeerLeft(callback: (userId: string | number) => void) {
    this.onPeerLeftCallback = callback;
  }

  /**
   * Initialize signaling link connection.
   */
  public connectSignaling() {
    if (this.onSignalCallback) return; // Routed signaling is active

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = localStorage.getItem('fxzone_access_token');
    
    const url = `${protocol}//${host}/ws/rtc/signal/${this.sessionId}?token=${encodeURIComponent(token || '')}`;
    
    this.signalSocket = new WebSocket(url);
    this.signalSocket.onmessage = this.handleSignalingMessage.bind(this);
    
    this.signalSocket.onopen = () => {
      if (this.isPresenter && this.localStream) {
        // Broadcast to all peers that presenter is live
        this.sendSignal({
          type: 'presenter_live',
          data: {}
        });
      }
    };
  }

  /**
   * Close peer connections and signaling sockets.
   */
  public disconnect() {
    this.close();
  }

  /**
   * Alias of disconnect for compatibility.
   */
  public close() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    if (this.signalSocket) {
      this.signalSocket.close();
      this.signalSocket = null;
    }
  }

  private sendSignal(payload: any) {
    if (this.onSignalCallback) {
      this.onSignalCallback(payload);
    } else if (this.signalSocket && this.signalSocket.readyState === WebSocket.OPEN) {
      this.signalSocket.send(JSON.stringify(payload));
    }
  }

  /**
   * Handle incoming WebRTC signal payloads manually.
   */
  public async handleSignal(payload: any) {
    if (!payload) return;
    const { sender_id, type, data } = payload;
    if (type === 'offer') {
      await this.handleOffer(sender_id, data);
    } else if (type === 'answer') {
      const pc = this.peerConnections.get(sender_id);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
      }
    } else if (type === 'candidate') {
      const pc = this.peerConnections.get(sender_id);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      }
    }
  }

  private async handleSignalingMessage(event: MessageEvent) {
    const message = JSON.parse(event.data);
    const { sender_id, type, data } = message;

    if (type === 'peer_joined') {
      if (this.isPresenter && this.localStream) {
        // Presenter creates a peer connection for this new viewer
        await this.initiatePeerConnection(sender_id);
      }
    } else if (type === 'peer_left') {
      const pc = this.peerConnections.get(sender_id);
      if (pc) {
        pc.close();
        this.peerConnections.delete(sender_id);
      }
      if (this.onPeerLeftCallback) {
        this.onPeerLeftCallback(sender_id);
      }
    } else if (type === 'presenter_live') {
      if (!this.isPresenter) {
        // Viewers join by signaling the presenter
        this.sendSignal({
          target_user_id: sender_id,
          type: 'peer_joined',
          data: {}
        });
      }
    } else if (type === 'offer') {
      await this.handleOffer(sender_id, data);
    } else if (type === 'answer') {
      const pc = this.peerConnections.get(sender_id);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
      }
    } else if (type === 'candidate') {
      const pc = this.peerConnections.get(sender_id);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      }
    }
  }

  private async initiatePeerConnection(targetUserId: string | number) {
    const pc = this.createPeerConnection(targetUserId);
    this.peerConnections.set(targetUserId, pc);

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.sendSignal({
      target_user_id: targetUserId,
      type: 'offer',
      data: offer
    });
  }

  private createPeerConnection(targetUserId: string | number): RTCPeerConnection {
    const configuration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          target_user_id: targetUserId,
          type: 'candidate',
          data: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (this.onRemoteStreamCallback && event.streams[0]) {
        this.onRemoteStreamCallback(targetUserId, event.streams[0]);
      }
      if (this.onStreamCallback && event.streams[0]) {
        this.onStreamCallback(event.streams[0]);
      }
    };

    return pc;
  }

  private async handleOffer(senderId: string | number, offerData: any) {
    const pc = this.createPeerConnection(senderId);
    this.peerConnections.set(senderId, pc);

    await pc.setRemoteDescription(new RTCSessionDescription(offerData));

    // If local presenter has stream, we add it (mostly viewers only receive, but support 2-way)
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignal({
      target_user_id: senderId,
      type: 'answer',
      data: answer
    });
  }
}

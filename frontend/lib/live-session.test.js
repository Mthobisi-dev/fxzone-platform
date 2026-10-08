const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the actual TypeScript classes with controlled browser/network
// boundaries. No production database or media permissions are required.
function load(file, imports, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, console, setTimeout, clearTimeout,
    require: (name) => {
      assert.ok(name in imports, `Unexpected dependency: ${name}`);
      return imports[name];
    },
    ...globals,
  }, { filename: file });
  return exports;
}

function rtcHarness() {
  const peers = [];
  class Peer {
    constructor() {
      this.connectionState = 'new';
      this.signalingState = 'stable';
      this.senders = [];
      this.offers = [];
      peers.push(this);
    }
    addTrack(track) { this.senders.push({ track, replaceTrack: async (next) => { track = next; } }); }
    getSenders() { return this.senders; }
    removeTrack(sender) { this.senders = this.senders.filter((s) => s !== sender); }
    async createOffer(options) { this.offers.push(options); return { type: 'offer', sdp: 'offer-sdp' }; }
    async createAnswer() { return { type: 'answer', sdp: 'answer-sdp' }; }
    async setLocalDescription(sdp) { this.localDescription = sdp; this.signalingState = sdp.type === 'offer' ? 'have-local-offer' : 'stable'; }
    async setRemoteDescription(sdp) { this.remoteDescription = sdp; this.signalingState = sdp.type === 'offer' ? 'have-remote-offer' : 'stable'; }
    async addIceCandidate() {}
    close() { this.connectionState = 'closed'; this.signalingState = 'closed'; }
    restartIce() { this.restarted = true; }
  }
  const { WebRTCClient } = load('webrtc.ts', { '@/lib/api': { api: { get: async () => null } } }, {
    RTCPeerConnection: Peer,
    RTCSessionDescription: class { constructor(sdp) { Object.assign(this, sdp); } },
    RTCIceCandidate: class { constructor(candidate) { Object.assign(this, candidate); } },
  });
  const signals = [];
  const client = new WebRTCClient({ currentUserId: 'host', onSignal: (signal) => signals.push(signal) });
  const track = { kind: 'video', stop() {} };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [] };
  return { client, stream, peers, signals };
}

test('duplicate discovery during an outstanding offer does not replace the peer', async () => {
  const { client, stream, peers, signals } = rtcHarness();
  await client.setLocalStream(stream);
  await client.handleSignal({ type: 'peer_joined', user_id: 'viewer' });
  await client.handleSignal({ type: 'request_stream', sender_id: 'viewer' });
  assert.equal(peers.length, 1);
  assert.equal(signals.filter((s) => s.type === 'offer').length, 1);
});

test('a new offer renegotiates the existing receiving connection', async () => {
  const { client, peers } = rtcHarness();
  const offer = { type: 'offer', sender_id: 'presenter', data: { type: 'offer', sdp: 'first' } };
  await client.handleSignal(offer);
  peers[0].connectionState = 'connected';
  await client.handleSignal({ ...offer, data: { type: 'offer', sdp: 'replacement-track' } });
  assert.equal(peers.length, 1, 'renegotiation must preserve the established ICE transport');
  assert.equal(peers[0].remoteDescription.sdp, 'replacement-track');
});

test('closing during asynchronous peer creation cannot resurrect a peer', async () => {
  const { client, stream, peers, signals } = rtcHarness();
  await client.setLocalStream(stream);
  const joining = client.handleSignal({ type: 'peer_joined', user_id: 'viewer' });
  client.close();
  await joining;
  assert.ok(peers.every((p) => p.connectionState === 'closed'));
  assert.equal(signals.filter((s) => s.type === 'offer').length, 0);
});

test('ICE failure emits a new offer with restart credentials', async () => {
  const { client, stream, peers, signals } = rtcHarness();
  await client.setLocalStream(stream);
  await client.handleSignal({ type: 'peer_joined', user_id: 'viewer' });
  await client.handleSignal({ type: 'answer', sender_id: 'viewer', data: { type: 'answer', sdp: 'answer' } });
  peers[0].connectionState = 'failed';
  await peers[0].onconnectionstatechange();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(signals.filter((s) => s.type === 'offer').length, 2);
  assert.equal(peers[0].offers.at(-1).iceRestart, true);
});

test('signals targeted to another viewer never create a connection', async () => {
  const { client, peers } = rtcHarness();
  await client.handleSignal({ type: 'offer', sender_id: 'other', target_user_id: 'another-viewer', data: { type: 'offer', sdp: 'sdp' } });
  assert.equal(peers.length, 0);
});

test('closing a socket while Auth initializes never subscribes the abandoned channel', async () => {
  let finishAuth;
  let channels = 0;
  const supabase = {
    auth: { getSession: () => new Promise((resolve) => { finishAuth = resolve; }) },
    realtime: { setAuth: async () => {} },
    channel: () => { channels++; return { on() { return this; }, subscribe() { return this; } }; },
    removeChannel: async () => {},
  };
  const { FxZoneWebSocket } = load('websocket.ts', { '@/lib/supabase': { supabase } });
  const socket = new FxZoneWebSocket('/ws/session/test');
  const connecting = socket.connect();
  socket.close();
  finishAuth({ data: { session: { access_token: 'test-only' } } });
  await connecting;
  assert.equal(channels, 0);
  assert.equal(socket.getState(), 'CLOSED');
});

test('admission polling reads only the authenticated membership and never calls join', async () => {
  const filters = [];
  const db = {
    from(table) {
      return {
        select() { return this; },
        eq(column, value) { filters.push([table, column, value]); return this; },
        async maybeSingle() {
          return { data: table === 'session_participants'
            ? { id: 'membership', user_id: 'signed-in-user', role: 'viewer', left_at: null }
            : { status: 'live', viewer_count: 2 } };
        },
      };
    },
    rpc() { assert.fail('Polling must not invoke a mutating RPC'); },
  };
  const json = (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers });
  const { GET } = load('../app/api/sessions/[id]/join/route.ts', {
    'next/server': { NextResponse: { json } },
    '@/lib/supabase': { getUserFromRequest: async () => ({ user: { id: 'signed-in-user' } }), getSupabaseAdmin: () => db },
    '@/lib/api-error': { apiError: (code, message, status) => json({ error: { code, message } }, { status }) },
  });
  const response = await GET({ url: '?user_id=another-user' }, { params: Promise.resolve({ id: 'session' }) });
  assert.equal(response.status, 200);
  assert.equal(response.body.role, 'viewer');
  assert.ok(filters.some(([table, column, value]) => table === 'session_participants' && column === 'user_id' && value === 'signed-in-user'));
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('unauthenticated admission polling cannot query private memberships', async () => {
  const { GET } = load('../app/api/sessions/[id]/join/route.ts', {
    'next/server': { NextResponse: { json: () => assert.fail('Unexpected success') } },
    '@/lib/supabase': {
      getUserFromRequest: async () => ({ user: null, error: 'expired' }),
      getSupabaseAdmin: () => assert.fail('Unauthenticated database access'),
    },
    '@/lib/api-error': { apiError: (code, message, status) => ({ status, code }) },
  });
  assert.equal((await GET({}, { params: Promise.resolve({ id: 'session' }) })).status, 401);
});

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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, console, setTimeout, clearTimeout,
    require: (name) => {
      if (name === '@/lib/broadcastMedia') return load('broadcastMedia.ts', {});
      assert.ok(name in imports, `Unexpected dependency: ${name}`);
      return imports[name];
    },
    ...globals,
  }, { filename: file });
  return exports;
}

// Minimal hook scheduler for exercising actual component event handlers. The
// boundary doubles replace browser/network APIs, never admission/media logic.
function componentHarness(file, imports, globals = {}) {
  const React = require('react');
  const slots = [];
  const effects = [];
  const timers = new Map();
  let cursor = 0;
  let nextTimer = 0;
  const changed = (before, after) => !before || !after || before.length !== after.length || after.some((value, i) => value !== before[i]);
  const react = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].deps, deps)) slots[index] = { deps, callback };
      return slots[index].callback;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].deps, deps)) {
        effects.push(() => { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: callback() }; });
      }
    },
  };
  const loadedComponent = load(file, { ...imports, react }, {
    setTimeout: (callback) => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: (id) => timers.delete(id),
    setInterval: () => ++nextTimer, clearInterval() {},
    ...globals,
  });
  return {
    timers,
    render(name, props = {}) { cursor = 0; const tree = loadedComponent[name](props); effects.splice(0).forEach((effect) => effect()); return tree; },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); timers.clear(); },
  };
}

function elements(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => elements(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children, predicate)];
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('follower enters automatically only after approval; the host enters directly', async () => {
  for (const initialRole of ['pending', 'host']) {
    let status = initialRole;
    let joinCalls = 0;
    const Room = () => null;
    const harness = componentHarness('../app/(dashboard)/session/[id]/page.tsx', {
      'next/navigation': { useParams: () => ({ id: 'room' }), useRouter: () => ({ push() {} }) },
      '@/hooks/useAuth': { useAuth: () => ({ user: { id: initialRole === 'host' ? 'host' : 'viewer' }, token: 'test', isAuthenticated: true, isLoading: false }) },
      '@/components/live/SessionRoom': { SessionRoom: Room },
      'lucide-react': require('lucide-react'),
      '@/lib/liveSessionPermissions': load('liveSessionPermissions.ts', {}),
      '@/lib/api': { api: {
        get: async (url) => url.endsWith('/join') ? { id: 'member', role: status, session_status: 'live' } : { id: 'room', host_id: 'host', host: { displayName: 'Host' }, title: 'Room', status: 'live' },
        post: async () => { joinCalls++; return { id: 'member', role: initialRole }; },
      } },
    });
    harness.render('default');
    await settle();
    let tree = harness.render('default');
    assert.equal(elements(tree, (node) => node.type === Room).length, initialRole === 'host' ? 1 : 0);
    if (initialRole === 'pending') {
      status = 'viewer';
      await [...harness.timers.values()][0]();
      tree = harness.render('default');
      assert.equal(elements(tree, (node) => node.type === Room).length, 1);
    }
    assert.equal(elements(tree, (node) => node.type === Room)[0].props.isHost, initialRole === 'host');
    assert.equal(joinCalls, 1, 'approval polling must not resubmit join requests');
    harness.unmount();
  }
});

test('double Share clicks open one picker and leaving before selection releases every capture track', async () => {
  let finishCapture;
  let captures = 0;
  let stopped = 0;
  const Controls = () => null;
  class RTC { close() {} async setLocalStream() {} }
  const harness = componentHarness('../components/live/SessionRoom.tsx', {
    './ScreenShare': { ScreenShare: () => null }, './SessionChat': { SessionChat: () => null },
    './SessionControls': { SessionControls: Controls },
    '@/hooks/useAuth': { useAuth: () => ({ user: { id: 'host' }, token: 'test', isAuthenticated: true }) },
    '@/hooks/useHydrated': { useHydrated: () => true },
    '@/hooks/useWebSocket': { useWebSocket: () => ({ current: { getState: () => 'CONNECTED', send: () => true } }) },
    'lucide-react': require('lucide-react'), '@/lib/webrtc': { WebRTCClient: RTC },
    '@/lib/api': { api: { get: async () => [] } },
    '@/lib/liveSessionPermissions': load('liveSessionPermissions.ts', {}),
    '../ui/Button': { Button: () => null }, '../ui/Avatar': { Avatar: () => null },
  }, {
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    navigator: { mediaDevices: { getDisplayMedia: () => { captures++; return new Promise((resolve) => { finishCapture = resolve; }); } } },
  });
  const tree = harness.render('SessionRoom', { sessionId: 'room', hostId: 'host', isHost: true, hostName: 'Host', sessionTitle: 'Room', onLeave() {} });
  const control = elements(tree, (node) => node.type === Controls)[0];
  control.props.onToggleShare(true);
  control.props.onToggleShare(true);
  assert.equal(captures, 1);
  harness.unmount();
  finishCapture({ getTracks: () => [{ stop() { stopped++; } }, { stop() { stopped++; } }] });
  await settle();
  assert.equal(stopped, 2);
});

test('repeated admission retries share one request and cannot subscribe before it is approved', async () => {
  let joins = 0;
  let finishJoin;
  const Room = () => null;
  const harness = componentHarness('../app/(dashboard)/session/[id]/page.tsx', {
    'next/navigation': { useParams: () => ({ id: 'room' }), useRouter: () => ({ push() {} }) },
    '@/hooks/useAuth': { useAuth: () => ({ user: { id: 'viewer' }, token: 'test', isAuthenticated: true, isLoading: false }) },
    '@/components/live/SessionRoom': { SessionRoom: Room },
    'lucide-react': require('lucide-react'),
    '@/lib/liveSessionPermissions': load('liveSessionPermissions.ts', {}),
    '@/lib/api': { api: {
      get: async () => ({ id: 'room', host_id: 'host', host: {}, status: 'live' }),
      post: () => {
        joins++;
        if (joins === 1) return Promise.reject(new Error('Connection failed'));
        return new Promise((resolve) => { finishJoin = resolve; });
      },
    } },
  }, { console: { ...console, error() {} } });
  harness.render('default');
  await settle();
  const tree = harness.render('default');
  const retry = elements(tree, (node) => node.type === 'button' && node.props.children === 'Try again')[0];
  retry.props.onClick();
  retry.props.onClick();
  assert.equal(joins, 2, 'a double click should add only one retry');
  finishJoin({ id: 'member', role: 'pending' });
  await settle();
  assert.equal(elements(harness.render('default'), (node) => node.type === Room).length, 0);
  harness.unmount();
});

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

test('only a host can control broadcast media and either a host or admin can end a session', () => {
  const { canControlLiveBroadcastMedia, canEndLiveBroadcast } = load('liveSessionPermissions.ts', {});

  assert.equal(canControlLiveBroadcastMedia(true), true);
  assert.equal(canControlLiveBroadcastMedia(false), false);
  assert.equal(canEndLiveBroadcast({ isHost: true, isAdmin: false }), true);
  assert.equal(canEndLiveBroadcast({ isHost: false, isAdmin: true }), true);
  assert.equal(canEndLiveBroadcast({ isHost: false, isAdmin: false }), false);
});

test('only admitted viewer and host roles may enter a live broadcast room', () => {
  const { canEnterLiveBroadcastRoom, getLiveSessionRoleLabel } = load('liveSessionPermissions.ts', {});

  assert.equal(canEnterLiveBroadcastRoom('host'), true);
  assert.equal(canEnterLiveBroadcastRoom('viewer'), true);
  assert.equal(canEnterLiveBroadcastRoom('pending'), false);
  assert.equal(canEnterLiveBroadcastRoom('rejected'), false);
  assert.equal(canEnterLiveBroadcastRoom(null), false);
  assert.equal(getLiveSessionRoleLabel('host'), 'Host');
  assert.equal(getLiveSessionRoleLabel('viewer'), 'Viewer');
  assert.equal(getLiveSessionRoleLabel('pending'), 'Awaiting approval');
});

test('a session owner is shown host controls instead of a viewer join request', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/(dashboard)/sessions/page.tsx'), 'utf8');

  assert.match(source, /const isSessionHost = Boolean\(user && String\(user\.id\) === String\(session\.hostId\)\);/);
  assert.match(source, /isSessionHost \? 'Open Host Room' : 'Request Access'/);
});

test('duplicate discovery during an outstanding offer does not replace the peer', async () => {
  const { client, stream, peers, signals } = rtcHarness();
  await client.setLocalStream(stream);
  await client.handleSignal({ type: 'peer_joined', user_id: 'viewer' });
  await client.handleSignal({ type: 'request_stream', sender_id: 'viewer' });
  assert.equal(peers.length, 1);
  assert.equal(signals.filter((s) => s.type === 'offer').length, 1);
});

test('host screen sharing never renders its own capture back into the captured page', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { ScreenShare } = load('../components/live/ScreenShare.tsx', {
    react: React, 'lucide-react': require('lucide-react'),
  });
  const stream = { active: true, getVideoTracks: () => [] };
  const host = renderToStaticMarkup(React.createElement(ScreenShare, { stream, presenterName: 'Host', isLocal: true }));
  assert.ok(!host.includes('<video'), 'rendering the local capture creates a hall-of-mirrors feedback loop');
  assert.match(host, /You are sharing your screen/);
  const viewer = renderToStaticMarkup(React.createElement(ScreenShare, { stream, presenterName: 'Host' }));
  assert.match(viewer, /<video/);
});

test('screen capture discourages sharing the broadcast tab and stops audio when native sharing ends', async () => {
  let captureOptions;
  let stopped = 0;
  const video = { kind: 'video', stop() { stopped++; } };
  const audio = { kind: 'audio', stop() { stopped++; } };
  const stream = { getTracks: () => [video, audio], getVideoTracks: () => [video], getAudioTracks: () => [audio] };
  const { WebRTCClient } = load('webrtc.ts', { '@/lib/api': { api: {} } }, {
    navigator: { mediaDevices: { getDisplayMedia: async (options) => { captureOptions = options; return stream; } } },
  });
  const client = new WebRTCClient({ currentUserId: 'host', isHost: true });
  await client.startLocalStream();
  assert.equal(captureOptions.selfBrowserSurface, 'exclude');
  assert.equal(captureOptions.video.displaySurface, 'monitor');
  await video.onended();
  assert.equal(stopped, 2, 'ending a video capture must also release its audio track');
  client.close();
});

test('host ignores its own stream announcements, including another tab with the same identity', async () => {
  const { client, stream, peers } = rtcHarness();
  await client.setLocalStream(stream);
  await client.handleSignal({ type: 'peer_joined', user_id: 'host' });
  await client.handleSignal({ type: 'request_stream', sender_id: 'host' });
  assert.equal(peers.length, 0);
  client.close();
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

test('a viewer only accepts presentation offers from the live-session host', async () => {
  const { WebRTCClient } = load('webrtc.ts', { '@/lib/api': { api: { get: async () => null } } }, {
    RTCPeerConnection: class {
      constructor() { this.connectionState = 'new'; this.signalingState = 'stable'; this.senders = []; }
      getSenders() { return this.senders; }
      async createAnswer() { return { type: 'answer', sdp: 'answer-sdp' }; }
      async setLocalDescription(sdp) { this.localDescription = sdp; }
      async setRemoteDescription(sdp) { this.remoteDescription = sdp; }
      async addIceCandidate() {}
      close() { this.connectionState = 'closed'; this.signalingState = 'closed'; }
    },
    RTCSessionDescription: class { constructor(sdp) { Object.assign(this, sdp); } },
    RTCIceCandidate: class { constructor(candidate) { Object.assign(this, candidate); } },
  });
  const signals = [];
  const client = new WebRTCClient({
    currentUserId: 'viewer',
    presenterId: 'host',
    onSignal: (signal) => signals.push(signal),
  });

  await client.handleSignal({ type: 'presenter_stream_started', sender_id: 'attacker' });
  await client.handleSignal({ type: 'offer', sender_id: 'attacker', data: { type: 'offer', sdp: 'attacker-sdp' } });
  assert.equal(signals.length, 0);

  await client.handleSignal({ type: 'offer', sender_id: 'host', data: { type: 'offer', sdp: 'host-sdp' } });
  assert.equal(signals.filter((signal) => signal.type === 'answer' && signal.target_user_id === 'host').length, 1);
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

test('joining a session returns a clear forbidden response when the user does not follow its host', async () => {
  const json = (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers });
  const { POST } = load('../app/api/sessions/[id]/join/route.ts', {
    'next/server': { NextResponse: { json } },
    '@/lib/supabase': {
      getUserFromRequest: async () => ({ user: { id: 'viewer' } }),
      getSupabaseAdmin: () => ({
        rpc: async () => ({ data: null, error: { message: 'Follow the host before requesting access' } }),
      }),
    },
    '@/lib/api-error': { apiError: (code, message, status) => json({ error: { code, message } }, { status }) },
  });

  const response = await POST({}, { params: Promise.resolve({ id: 'session' }) });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
  assert.equal(response.body.error.message, 'Follow the host before requesting access');
});

test('an explicit follow intent never toggles an existing follow off during a broadcast access request', async () => {
  let deleted = false;
  const followQuery = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data: { id: 'existing-follow' }, error: null }; },
    delete() { deleted = true; return this; },
    insert() { return this; },
    then(resolve) { return Promise.resolve({ error: null }).then(resolve); },
  };
  const db = {
    from(table) {
      if (table === 'users') {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() { return { data: { id: 'host', username: 'host', role: 'trader' }, error: null }; },
        };
      }
      return followQuery;
    },
  };
  const json = (body, options = {}) => ({ body, status: options.status || 200 });
  const { POST } = load('../app/api/social/users/[id]/follow/route.ts', {
    'next/server': { NextResponse: { json } },
    '@/lib/supabase': {
      getUserFromRequest: async () => ({ user: { id: 'viewer', email: 'viewer@example.test', user_metadata: {} } }),
      getSupabaseAdmin: () => db,
      ensureUserProfile: async () => true,
    },
    '@/lib/server/notifications': { createNotification: async () => {} },
    '@/lib/server/socialCounters': { getFollowCounts: async () => ({ followers_count: 1, following_count: 2 }) },
    '@/lib/systemAccounts': { isHiddenSystemAccount: () => false },
  });

  const response = await POST({ json: async () => ({ following: true }) }, { params: Promise.resolve({ id: 'host' }) });
  assert.equal(response.status, 200);
  assert.equal(response.body.is_following, true);
  assert.equal(deleted, false);
});

test('the session list reports an unapplied live-session schema migration safely', async () => {
  let selectedFields = '';
  const db = {
    from() {
      return {
        select(fields) { selectedFields = fields; return this; },
        neq() { return this; },
        order() { return this; },
        async limit() {
          return {
            data: null,
            error: { code: '42703', message: 'column live_sessions.requires_approval does not exist' },
          };
        },
      };
    },
  };
  const json = (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers });
  const { GET } = load('../app/api/sessions/route.ts', {
    'next/server': { NextResponse: { json } },
    '@/lib/supabase': { supabaseAdmin: db },
    '@/lib/api-error': { apiError: (code, message, status) => json({ error: { code, message } }, { status }) },
  });

  const response = await GET();
  assert.match(selectedFields, /requires_approval/);
  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, 'SERVICE_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(response.body), /requires_approval|column live_sessions/i);
});

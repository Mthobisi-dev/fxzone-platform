const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  broadcastCaptureOptions,
  captureBroadcastStream,
  configureBroadcastTrack,
  constrainBroadcastVideoTrack,
  tuneBroadcastSender,
  supportsScreenShare,
} = require('./broadcastMedia.ts');

test('screen capture prefers the entire display so a host can navigate between FxZone pages', () => {
  const options = broadcastCaptureOptions();

  assert.equal(options.video.displaySurface, 'monitor');
  assert.equal(options.surfaceSwitching, 'include');
});

test('screen share availability follows the current browser media API', () => {
  assert.equal(supportsScreenShare(undefined), false);
  assert.equal(supportsScreenShare({}), false);
  assert.equal(supportsScreenShare({ getDisplayMedia() {} }), true);
});

test('screen-share tracks are tuned for readable motion without saturating the connection', async () => {
  const videoTrack = { kind: 'video' };
  const sender = {
    getParameters() { return { encodings: [{}] }; },
    async setParameters(parameters) { this.parameters = parameters; },
  };

  configureBroadcastTrack(videoTrack);
  await tuneBroadcastSender(sender, videoTrack);

  assert.equal(videoTrack.contentHint, 'detail');
  assert.equal(sender.parameters.degradationPreference, 'maintain-resolution');
  assert.equal(sender.parameters.encodings[0].maxFramerate, 30);
  assert.equal(sender.parameters.encodings[0].maxBitrate, 2_500_000);
});

test('screen-share capture constrains oversized desktop frames before publishing', async () => {
  const constraints = [];
  const track = {
    kind: 'video',
    applyConstraints: async (value) => { constraints.push(value); },
  };

  await constrainBroadcastVideoTrack(track);

  assert.deepEqual(constraints, [{
    width: { max: 1920 },
    height: { max: 1080 },
    frameRate: { max: 30 },
  }]);
});

test('broadcast capture adds a microphone track while preserving display audio', async () => {
  const stopped = [];
  const displayVideo = { kind: 'video', stop() { stopped.push('display-video'); } };
  const displayAudio = { kind: 'audio', stop() { stopped.push('display-audio'); } };
  const microphone = { kind: 'audio', stop() { stopped.push('microphone'); } };
  const display = {
    getVideoTracks: () => [displayVideo],
    getAudioTracks: () => [displayAudio],
    addTrack(track) { displayAudio.added = track; },
  };
  const result = await captureBroadcastStream({
    getDisplayMedia: async () => display,
    getUserMedia: async () => ({ getAudioTracks: () => [microphone] }),
  });

  assert.equal(result.microphoneTrack, microphone);
  assert.equal(result.sharedAudioTrack, displayAudio);
  assert.equal(displayAudio.added, microphone);
  assert.equal(result.microphoneError, null);
});

test('broadcast capture keeps screen sharing alive when microphone permission is denied', async () => {
  const display = { getVideoTracks: () => [], getAudioTracks: () => [], addTrack() {} };
  const result = await captureBroadcastStream({
    getDisplayMedia: async () => display,
    getUserMedia: async () => { throw new Error('permission denied'); },
  });

  assert.equal(result.stream, display);
  assert.equal(result.microphoneTrack, null);
  assert.match(result.microphoneError, /permission denied/i);
});

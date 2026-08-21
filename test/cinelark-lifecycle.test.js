'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = resolve(__dirname, '..');

function makeHarness({
  chapters = [
    { title: 'Intro', start: 0 },
    { title: 'Episode', start: 90 },
  ],
  preferenceValues = { auto_skip_title_intros: true },
} = {}) {
  const handlers = new Map();
  const timers = [];
  const seeks = [];
  const mpvState = {
    path: 'https://media.example/play/video/01ABC?token=<redacted>',
    duration: 1800,
    position: 0,
  };

  const context = {
    iina: {
      core: {
        status: { paused: false },
        window: { loaded: false },
        getChapters: () => chapters,
        seekTo: (position) => seeks.push(position),
      },
      event: { on: (name, callback) => handlers.set(name, callback) },
      mpv: {
        getString: (name) => (name === 'path' ? mpvState.path : null),
        getNumber: (name) => {
          if (name === 'duration') return mpvState.duration;
          if (name === 'time-pos') return mpvState.position;
          return null;
        },
      },
      overlay: {
        loadFile: () => {},
        onMessage: () => {},
        postMessage: () => {},
        setClickable: () => {},
        show: () => {},
      },
      preferences: {
        get: (key) => preferenceValues[key],
      },
      input: { onKeyDown: () => {}, offKeyDown: () => {} },
      console: { log: () => {} },
      file: {},
      utils: {},
    },
    require: (specifier) => require(resolve(root, specifier)),
    setTimeout: (callback, milliseconds) => {
      timers.push({ callback, milliseconds });
      return timers.length;
    },
    clearTimeout: () => {},
    Promise,
    Math,
    Number,
    Object,
    Array,
    String,
    Boolean,
    RegExp,
    JSON,
    isFinite,
    parseFloat,
  };

  vm.runInNewContext(
    readFileSync(resolve(root, 'main.js'), 'utf8'),
    context,
    { filename: 'main.js' }
  );

  return { handlers, mpvState, seeks, timers };
}

async function finishDetection(harness) {
  const delayTimerIndex = harness.timers.findIndex((timer) => timer.milliseconds === 500);
  assert.notEqual(delayTimerIndex, -1);
  const [delayTimer] = harness.timers.splice(delayTimerIndex, 1);
  delayTimer.callback();
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

test('chapter timing fallback participates in Auto-Skip for network streams', async () => {
  const harness = makeHarness({
    chapters: [
      { title: 'Chapter 1', start: 0 },
      { title: 'Chapter 2', start: 90 },
    ],
    preferenceValues: {
      auto_skip_title_intros: true,
      detect_chapter_timing: true,
    },
  });
  harness.handlers.get('iina.plugin-overlay-loaded')();
  harness.handlers.get('mpv.file-loaded')();
  await finishDetection(harness);

  assert.deepEqual(harness.seeks, [89]);
});

test('Auto-Skip resets and runs for every CineLark replacement episode', async () => {
  const harness = makeHarness();
  harness.handlers.get('iina.plugin-overlay-loaded')();

  harness.handlers.get('mpv.file-loaded')();
  await finishDetection(harness);
  assert.deepEqual(harness.seeks, [89]);

  harness.handlers.get('mpv.end-file')();
  harness.mpvState.path = 'https://media.example/play/video/01DEF?token=<redacted>';
  harness.handlers.get('mpv.file-loaded')();
  await finishDetection(harness);
  assert.deepEqual(harness.seeks, [89, 89]);
});

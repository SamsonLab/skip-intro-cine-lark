'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  getLocalFilePath,
  isNetworkMediaPath,
  isSupportedMediaPath,
  isVideoFilePath,
} = require('../detectors/shared.js');

test('CineLark opaque HTTPS playback URLs are supported network media', () => {
  const url = 'https://media.example/play/video/01ABC?token=<redacted>';

  assert.equal(getLocalFilePath(url), null);
  assert.equal(isVideoFilePath(url), false);
  assert.equal(isNetworkMediaPath(url), true);
  assert.equal(isSupportedMediaPath(url), true);
});

test('local video support remains unchanged', () => {
  assert.equal(isNetworkMediaPath('/Media/Show.S01E02.mkv'), false);
  assert.equal(isSupportedMediaPath('/Media/Show.S01E02.mkv'), true);
  assert.equal(isSupportedMediaPath('file:///Media/Show.S01E02.mkv'), true);
});

test('unsupported local documents and non-HTTP schemes remain rejected', () => {
  assert.equal(isSupportedMediaPath('/Media/notes.txt'), false);
  assert.equal(isSupportedMediaPath('ftp://media.example/video.mkv'), false);
  assert.equal(isSupportedMediaPath(null), false);
});

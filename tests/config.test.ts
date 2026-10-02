import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.ts';

describe('Config Module Tests', () => {
  it('should load geminiApiKey from environment or config', () => {
    assert.ok(config.geminiApiKey, 'geminiApiKey deve estar definida');
    assert.strictEqual(typeof config.geminiApiKey, 'string');
  });

  it('should have voice options configured', () => {
    assert.strictEqual(config.voiceName, 'en-US-JennyNeural');
    assert.strictEqual(typeof config.voiceReplyEnabled, 'boolean');
  });

  it('should default session path to auth_info_baileys', () => {
    assert.strictEqual(config.sessionPath, './auth_info_baileys');
  });
});

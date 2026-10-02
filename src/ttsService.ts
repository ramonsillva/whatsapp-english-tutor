import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import path from 'path';
import os from 'os';
import { config } from './config.js';

export async function synthesizeSpeech(text: string): Promise<string> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(config.voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const tempFile = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`);
  await tts.toFile(tempFile, text);
  return tempFile;
}

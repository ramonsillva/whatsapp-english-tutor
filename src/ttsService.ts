import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { config } from './config.js';

export async function synthesizeSpeechBuffer(text: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(config.voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  return new Promise((resolve, reject) => {
    try {
      const { audioStream } = tts.toStream(text);
      const chunks: Buffer[] = [];

      audioStream.on('data', (chunk) => {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else {
          chunks.push(Buffer.from(chunk));
        }
      });

      audioStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      audioStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

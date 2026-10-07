import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { processUserMessage } from './geminiService.js';
import { synthesizeSpeechBuffer } from './ttsService.js';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const upload = multer({ storage: multer.memoryStorage() });

// Endpoint de conversação (texto ou áudio)
app.post('/api/chat', upload.single('audio'), async (req, res) => {
  try {
    const text = req.body.text || '';
    const audioFile = req.file;

    let audioBase64: string | undefined = undefined;
    let mimeType = 'audio/webm';

    if (audioFile) {
      audioBase64 = audioFile.buffer.toString('base64');
      mimeType = audioFile.mimetype || 'audio/webm';
    }

    if (!text && !audioBase64) {
      return res.status(400).json({ error: 'Nenhum texto ou áudio fornecido.' });
    }

    // Processa com a IA pedagógica
    const replyText = await processUserMessage('web_user_ramon', text, audioBase64, mimeType);

    // Gera áudio de resposta se o modo de voz estiver habilitado
    let audioUrl: string | null = null;
    if (config.voiceReplyEnabled) {
      try {
        const audioBuffer = await synthesizeSpeechBuffer(replyText);
        const base64Voice = audioBuffer.toString('base64');
        audioUrl = `data:audio/mp3;base64,${base64Voice}`;
      } catch (err) {
        console.error('Erro ao gerar voz:', err);
      }
    }

    res.json({
      replyText,
      audioUrl,
    });
  } catch (error: any) {
    console.error('Erro na API de chat:', error);
    res.status(500).json({ error: error.message || 'Erro ao processar mensagem.' });
  }
});

app.listen(port, () => {
  console.log(`\n======================================================`);
  console.log(`🌐 Tutor Web rodando em: http://localhost:${port}`);
  console.log(`💬 Abra o link no seu navegador para praticar inglês!`);
  console.log(`======================================================\n`);
});

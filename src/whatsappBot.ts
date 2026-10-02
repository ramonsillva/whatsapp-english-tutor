import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import fs from 'fs/promises';
import { config } from './config.js';
import { processUserMessage } from './geminiService.js';
import { synthesizeSpeech } from './ttsService.js';

// Conjunto de IDs de mensagens enviadas pelo bot para evitar loop no self-chat
const botSentMessageIds = new Set<string>();

export async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n======================================================');
      console.log('📲 ESCANEIE O QR CODE ABAIXO COM O SEU WHATSAPP:');
      console.log('======================================================\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(
        `Conexão encerrada (status: ${statusCode}). Reconectando?...`,
        shouldReconnect ? 'SIM' : 'NÃO'
      );
      if (shouldReconnect) {
        setTimeout(() => startWhatsAppBot(), 3000);
      }
    } else if (connection === 'open') {
      console.log('\n======================================================');
      console.log(' Conectado com sucesso ao WhatsApp!');
      console.log('💬 O Tutor de Inglês está pronto para bater papo!');
      console.log('======================================================\n');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      if (msg.key.remoteJid === 'status@broadcast') continue;

      const senderJid = msg.key.remoteJid;
      // Ignora status, grupos (@g.us) e canais/newsletters (@newsletter)
      if (!senderJid || senderJid.endsWith('@g.us') || senderJid.endsWith('@newsletter')) continue;

      const myJid = sock.user?.id || '';
      const myNumber = myJid.split(':')[0].replace(/[^0-9]/g, '');
      const myLid = sock.user?.lid ? sock.user.lid.split(':')[0].replace(/[^0-9]/g, '') : '';
      const senderRaw = senderJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
      const senderNumber = senderRaw;

      // Verifica se a mensagem veio estritamente da conversa de "Mensagens Salvas" consigo mesmo ("Você")
      const isSelfChat = (myNumber && senderRaw === myNumber) || (myLid && senderRaw === myLid);

      // Trava de segurança máxima: se selfChatOnly for true ou se não for o chat próprio, IGNORA IMEDIATAMENTE
      if (config.selfChatOnly && !isSelfChat) {
        continue;
      }

      // Se você estiver conversando com um colega/amigo (fromMe é true mas não é no seu chat de anotações), NUNCA INTERCEPTA
      if (msg.key.fromMe && !isSelfChat) {
        continue;
      }

      // Se alguém de fora mandou mensagem (colega, parente, etc), NUNCA RESPONDE se não for self-chat
      if (!isSelfChat) {
        continue;
      }

      // Extração robusta do conteúdo de mensagem
      const messageContent =
        msg.message?.ephemeralMessage?.message ||
        msg.message?.viewOnceMessage?.message ||
        msg.message?.viewOnceMessageV2?.message ||
        msg.message;

      const userText =
        messageContent?.conversation ||
        messageContent?.extendedTextMessage?.text ||
        '';

      const isAudio =
        Boolean(messageContent?.audioMessage);
      const isText = Boolean(userText.trim());

      console.log(`[WhatsApp Detail] sender=${senderNumber}, isSelfChat=${isSelfChat}, isText=${isText}, isAudio=${isAudio}, text="${userText}"`);

      // Ignora se foi o próprio bot que enviou esta mensagem
      if (msg.key.id && botSentMessageIds.has(msg.key.id)) continue;

      if (
        config.allowedNumbers.length > 0 &&
        !config.allowedNumbers.includes(senderNumber)
      ) {
        continue;
      }

      if (!isAudio && !isText) continue;

      try {
        await sock.sendPresenceUpdate('composing', senderJid);
        let audioBase64: string | undefined = undefined;

        if (isAudio) {
          console.log(`[WhatsApp] Recebeu áudio de ${senderNumber}`);
          const buffer = (await downloadMediaMessage(
            msg,
            'buffer',
            {}
          )) as Buffer;
          audioBase64 = buffer.toString('base64');
        } else {
          console.log(`[WhatsApp] Recebeu texto de ${senderNumber}: "${userText}"`);
        }

        // Processa com Gemini (Prompt Pedagógico)
        const replyText = await processUserMessage(
          senderJid,
          userText,
          audioBase64,
          'audio/ogg'
        );

        // Envia resposta em texto e registra o id
        const sentMsg = await sock.sendMessage(senderJid, { text: replyText });
        if (sentMsg?.key?.id) {
          botSentMessageIds.add(sentMsg.key.id);
        }

        // Se o usuário mandou áudio e o modo de voz estiver ativo, responde com áudio também
        if (isAudio && config.voiceReplyEnabled) {
          try {
            await sock.sendPresenceUpdate('recording', senderJid);
            const audioPath = await synthesizeSpeech(replyText);
            const audioBuffer = await fs.readFile(audioPath);
            await sock.sendMessage(
              senderJid,
              {
                audio: audioBuffer,
                mimetype: 'audio/mp4',
                ptt: true, // ptt: true faz aparecer como áudio de voz gravado na hora
              },
              { quoted: msg }
            );
            await fs.unlink(audioPath).catch(() => {});
          } catch (audioErr) {
            console.error('Erro ao gerar voz TTS:', audioErr);
          }
        }
      } catch (err: any) {
        console.error('Erro ao processar mensagem do usuário:', err);
      }
    }
  });
}

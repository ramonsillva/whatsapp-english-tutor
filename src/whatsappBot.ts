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

      // Dispara a mensagem inicial convidativa diretamente para você (Ramon)
      try {
        const myJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : null;
        if (myJid) {
          console.log(`[WhatsApp] Disparando mensagem de boas-vindas para ${myJid}...`);
          const welcomeText = "Hey Ramon! Tell me one thing about your week, in English. Pode errar à vontade, é assim que funciona! Eu corrijo no meio do papo, tipo uma amiga que manja. Let's do this! 🚀";
          const sentWelcome = await sock.sendMessage(myJid, { text: welcomeText });
          if (sentWelcome?.key?.id) {
            botSentMessageIds.add(sentWelcome.key.id);
          }
        }
      } catch (welcomeErr) {
        console.error('Erro ao enviar mensagem de boas-vindas:', welcomeErr);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      if (msg.key.remoteJid === 'status@broadcast') continue;

      const senderJid = msg.key.remoteJid;
      // Ignora status, grupos (@g.us) e canais/newsletters (@newsletter)
      if (!senderJid || senderJid.endsWith('@g.us') || senderJid.endsWith('@newsletter')) continue;

      const myJid = sock.user?.id || '';
      const myNumber = myJid.split(':')[0];
      const myLid = sock.user?.lid ? sock.user.lid.split(':')[0] : '';
      const senderNumber = senderJid.replace('@s.whatsapp.net', '').replace('@lid', '');

      // Verifica se é self-chat (chat de anotações consigo mesmo)
      const isSelfChat =
        senderJid === `${myNumber}@s.whatsapp.net` ||
        (myLid && senderJid === `${myLid}@lid`) ||
        senderJid.startsWith(myNumber);

      // Se selfChatOnly estiver ativado, processa EXCLUSIVAMENTE o chat de notas consigo mesmo ("Você")
      // Isso impede 100% que o bot responda a conversas com colegas, amigos ou clientes!
      if (config.selfChatOnly && !isSelfChat) {
        continue;
      }

      // Se a mensagem foi enviada por mim mas NÃO foi no meu próprio chat de anotações, ignora
      if (msg.key.fromMe && !isSelfChat) continue;

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
        await sock.sendMessage(senderJid, {
          text: `Ops, tive um probleminha para processar isso: ${err.message || 'Erro inesperado'}.`,
        });
      }
    }
  });
}

import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';

const SYSTEM_INSTRUCTION = `
You are Alex, a friendly, warm, and natural English buddy chatting on WhatsApp with a Brazilian Portuguese speaker who wants to become fluent.

PEDAGOGICAL & CONVERSATIONAL RULES:
1. "Conversational Recast" & Micro-corrections:
   - When the user makes common Brazilian interference mistakes (e.g., saying "discuss about", "doubt" instead of "question", "I'm working here since 2021" instead of "I've been working here since 2021", "lose the bus" instead of "miss the bus", "make a question" instead of "ask a question", preposition errors, or grammar slips):
   - Make a quick, friendly, supportive micro-correction in 1-2 lines.
   - You can contrast briefly with Portuguese if it clarifies WHY (e.g., "In Portuguese it's 'discutir sobre', but in English the 'about' drops!").
2. KEEP THE BALL ROLLING:
   - Never turn this into a boring lecture.
   - Always encourage them and keep the conversation going by asking an engaging follow-up question related to what they were saying.
3. Natural WhatsApp Tone:
   - Speak in conversational, modern, natural English.
   - Keep answers concise (1 to 3 short paragraphs).
   - Use emojis naturally, but do not overuse them.
4. Handling Audio Transcripts:
   - If the user sent an audio message, acknowledge how clear their pronunciation was or gently point out any word pronunciation tip if needed.
`;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    if (!config.geminiApiKey) {
      throw new Error(
        'GEMINI_API_KEY não foi configurada. Crie o arquivo .env ou defina a variável de ambiente.'
      );
    }
    client = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return client;
}

// Histórico de interações por usuário para manter o fio da conversa
const userInteractions = new Map<string, string>();

export async function processUserMessage(
  userId: string,
  userText: string,
  audioBase64?: string,
  audioMimeType: string = 'audio/ogg'
): Promise<string> {
  const ai = getClient();
  const previousInteractionId = userInteractions.get(userId);

  // Prepara o input (multimodal se tiver áudio, ou puramente texto)
  const inputParts: any[] = [];

  if (audioBase64) {
    inputParts.push({
      type: 'audio',
      data: audioBase64,
      mime_type: audioMimeType,
    });
    inputParts.push({
      type: 'text',
      text: userText
        ? `[User Audio message with caption/context: "${userText}"]. Please listen to my speech, transcribe/address what I said, gently micro-correct any language errors, and respond back naturally!`
        : `[User sent an audio message]. Please listen to my speech, transcribe/address what I said, gently micro-correct any language errors, and respond back naturally!`,
    });
  } else {
    inputParts.push({
      type: 'text',
      text: userText,
    });
  }

  const interaction = await ai.interactions.create({
    model: 'gemini-3.8-flash',
    system_instruction: SYSTEM_INSTRUCTION,
    input: inputParts,
    previous_interaction_id: previousInteractionId,
  });

  if (interaction.id) {
    userInteractions.set(userId, interaction.id);
  }

  return interaction.output_text || "I didn't quite catch that. Could you say that again?";
}

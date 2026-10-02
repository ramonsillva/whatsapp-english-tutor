import dotenv from 'dotenv';
dotenv.config();

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  voiceReplyEnabled: process.env.VOICE_REPLY_ENABLED === 'true',
  voiceName: process.env.VOICE_NAME || 'en-US-JennyNeural',
  allowedNumbers: process.env.ALLOWED_NUMBERS ? process.env.ALLOWED_NUMBERS.split(',').map(s => s.trim()) : [],
  sessionPath: './auth_info_baileys',
};

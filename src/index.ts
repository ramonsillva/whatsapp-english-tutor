import { startWhatsAppBot } from './whatsappBot.js';

console.log('🚀 Iniciando Tutor de Inglês via WhatsApp...');
startWhatsAppBot().catch((err) => {
  console.error('Falha fatal na inicialização:', err);
});

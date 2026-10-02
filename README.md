# 🇬🇧 English Conversational Tutor (WhatsApp + Gemini + Baileys)

Bot parceiro para destravar e aprimorar o inglês através de conversas naturais no WhatsApp (texto e áudio), com micro-correções pedagógicas contextuais no estilo *Conversational Recast*.

---

## 🎯 Como funciona a dinâmica

1. **Micro-correção não invasiva**: Se você mandar expressões com interferência do português (ex: *"We need to discuss about the project"*, *"I have a doubt"* ou *"I work here since 2021"*), o bot corrige pontual e carinhosamente na hora (ex: *"Discuss the project, sem 'about'! Em inglês a gente corta"*).
2. **Continuidade de conversa**: Ele nunca encerra a conversa na correção; em seguida faz uma pergunta provocativa sobre o assunto para você continuar praticando.
3. **Áudio Multimodal**:
   - Envie mensagens de voz: o **Gemini** analisa o áudio e a gramática.
   - O bot responde em texto e também em **áudio de voz neural nativa** (Microsoft Edge TTS - en-US-JennyNeural).

---

## 🚀 Como Iniciar

### 1. Coloque sua chave no arquivo `.env`
Abra o arquivo [.env](file:///d:/Proj/ing/.env) e insira sua chave gratuita da Google AI Studio:
```env
GEMINI_API_KEY=sua_chave_aqui
```

### 2. Iniciar o bot
No terminal na pasta `d:\Proj\ing`, rode:
```bash
npm start
```
*(ou `npm run dev` para recarregar alterações automaticamente)*

### 3. Conectar ao WhatsApp
- Um **QR Code** será exibido no terminal.
- Abra o WhatsApp no seu celular > **Aparelhos Conectados** > **Conectar um aparelho**.
- Aponte a câmera para o QR Code do terminal.
- Pronto! Comece a conversar mandando uma mensagem ou áudio em inglês.

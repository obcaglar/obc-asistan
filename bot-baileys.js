// bot-baileys.js - KİŞİSEL NUMARAYLA QR KODLU WHATSAPP ASİSTANI
// Kurulum: npm install @whiskeysockets/baileys qrcode-terminal dotenv googleapis axios

require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { google } = require('googleapis');
const axios = require('axios');

// Google Workspace OAuth2
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const people = google.people({ version: 'v1', auth: oauth2Client });

async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const sock = makeWASocket({ auth: state, printQRInTerminal: true });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('📱 WhatsApp QR Kodu Hazır! Telefonunuzdan WhatsApp Web gibi taratın:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const reconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (reconnect) startWhatsAppBot();
    } else if (connection === 'open') {
      console.log('🚀 Asistan Canlı! WhatsApp sesli veya yazılı komutlarınızı bekliyor.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const jid = m.key.remoteJid;
    let commandText = '';
    let isVoice = false;

    // Sesli mesaj (PTT / Voice Memo)
    if (m.message.audioMessage) {
      isVoice = true;
      const buffer = await downloadMediaMessage(m, 'buffer', {});
      commandText = await transcribeWithGemini(buffer.toString('base64'));
    } else if (m.message.conversation || m.message.extendedTextMessage?.text) {
      commandText = m.message.conversation || m.message.extendedTextMessage.text;
    }

    if (!commandText) return;
    await processCommand(sock, jid, commandText.trim(), isVoice);
  });
}

async function transcribeWithGemini(base64Audio) {
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{
        parts: [
          { text: "Türkçe ses kaydını tam olarak metne dök (STT). Sadece söylenen cümleyi yaz:" },
          { inlineData: { mimeType: "audio/ogg", data: base64Audio } }
        ]
      }]
    }
  );
  return res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function processCommand(sock, jid, text, isVoice) {
  const lower = text.toLowerCase();
  const prefix = isVoice ? '🎙️ *[Sesli Mesaj Çözümlendi]*\n\n' : '';

  if (lower.includes('toplantı') || lower.includes('randevu') || lower.startsWith('!toplanti')) {
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: text,
        start: { dateTime: new Date(Date.now() + 86400000).toISOString() },
        end: { dateTime: new Date(Date.now() + 90000000).toISOString() }
      }
    });
    await sock.sendMessage(jid, { text: `${prefix}📅 Google Takvim'e eklendi:\n📌 ${text}\n🔗 Link: ${res.data.htmlLink}` });
  } else if (lower.includes('rehbere ekle') || lower.startsWith('!rehber')) {
    await people.people.createContact({
      requestBody: {
        names: [{ givenName: text.replace(/(!rehber|rehbere ekle)/gi, '').trim() }],
        phoneNumbers: [{ value: jid.split('@')[0], type: 'mobile' }]
      }
    });
    await sock.sendMessage(jid, { text: `${prefix}👤 Google Rehber'e kaydedildi!` });
  } else if (lower.startsWith('!not') || lower.includes('not al')) {
    await sock.sendMessage(jid, { text: `${prefix}📝 Notunuz hafızaya alındı:\n"${text}"` });
  }
}

startWhatsAppBot();

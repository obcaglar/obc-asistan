import { CalendarItem, ContactItem, NoteItem } from "./assistant-engine";

export interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  transcript?: string;
  duration?: string;
  time: string;
  type: "text" | "audio";
  meta: {
    type: "calendar" | "contact" | "note";
    id: string;
    syncedToGoogle?: boolean;
    usedGemini?: boolean;
  } | null;
}

export const INITIAL_CALENDAR_EVENTS: CalendarItem[] = [
  {
    id: "evt-1",
    title: "Bütçe ve Mali Değerlendirme Toplantısı",
    date: "2026-10-29",
    startTime: "14:30",
    endTime: "15:30",
    attendee: "Mehmet Bey & Mali Ekip",
    location: "Google Meet",
    source: "🎙️ WhatsApp Sesli Komut",
    createdTime: "Bugün 10:15",
  },
  {
    id: "evt-2",
    title: "Haftalık Sprint Planlama ve Sunum",
    date: "2026-11-02",
    startTime: "10:00",
    endTime: "11:00",
    attendee: "Yazılım Ekibi",
    location: "Ofis Toplantı Odası 2",
    source: "💬 WhatsApp Metin Komutu",
    createdTime: "Dün 17:00",
  },
];

export const INITIAL_CONTACTS: ContactItem[] = [
  {
    id: "cnt-1",
    name: "Av. Hakan Yılmaz",
    phone: "+90 532 888 7766",
    email: "hakan@yilmazhukuk.com",
    company: "Yılmaz Hukuk Bürosu",
    notes: "Sözleşme danışmanı, WhatsApp sesli mesaj ile eklendi",
    addedDate: "28 Ekim 2026",
  },
  {
    id: "cnt-2",
    name: "Zeynep Kaya",
    phone: "+90 541 333 4455",
    email: "zeynep.kaya@kreatif.com",
    company: "Kreatif Tasarım Ajansı",
    notes: "Logo revizyonları sorumlusu",
    addedDate: "26 Ekim 2026",
  },
];

export const INITIAL_NOTES: NoteItem[] = [
  {
    id: "not-1",
    title: "Sunucu ve Altyapı Kontrolü",
    content:
      "Haftalık sunucu yedeklerini her Cuma saat 18:00'de doğrula ve Cloudflare SSL durumunu kontrol et.",
    category: "İş / Altyapı",
    time: "Bugün 09:40",
  },
  {
    id: "not-2",
    title: "Haftalık Market Listesi",
    content:
      "Organik filtre kahve, çavdar ekmeği, sızma zeytinyağı ve maden suyu.",
    category: "Kişisel",
    time: "27 Ekim 2026",
  },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "msg-0",
    sender: "bot",
    text: '👋 Merhaba! WhatsApp ⇄ Google Workspace Asistanınız (Next.js Full-Stack) hazır.\n\nİster yazarak, isterseniz *mikrofon simgesine basıp sesli konuşarak* komut verebilirsiniz:\n\n• 🎙️ *Sesli:* Mikrofona basıp konuşun (Örn: *"Yarın saat üçe randevu ekle"*)\n• 📅 *Toplantı:* `!toplanti Yarın 14:30 Toplantı`\n• 👤 *Rehber:* `!rehber [İsim] [Telefon]`\n• 📝 *Not:* `!not [Metin]`\n\nYukarıdaki **"📦 Projeyi İndir (.ZIP)"** butonu ile sunucu dosyalarınızı doğrudan indirebilirsiniz.',
    time: "09:00",
    type: "text",
    meta: null,
  },
];

export const ANTIGRAVITY_FILES: Record<"prompt" | "rules" | "config", string> = {
  prompt: `# 🚀 ANTIGRAVITY PROJE AKTARIM & SİSTEM PROMPTU (MASTER PROMPT)

Merhaba Antigravity! Bu projeyi senin ortamına aktardım. Lütfen aşağıdaki mimari bağlamı, dosya yapısını ve entegrasyon kurallarını okuyarak projeyi devral.

## 1. PROJENİN AMACI VE ÖZETİ
Bu proje, **WhatsApp (Sesli & Yazılı Mesajlar)** üzerinden gelen kullanıcı komutlarını yakalayıp çözümleyen ve **Google Workspace (Google Calendar API, Google People/Contacts API ve Not Defteri)** ile çift yönlü senkronize çalışan tam kapsamlı bir **Next.js (App Router)** asistanıdır.

- **Sesli Mesaj Desteği (Voice Note / PTT):** WhatsApp'tan gönderilen \`audio/ogg\` formatındaki ses kayıtları indirilir, **Google Gemini (\`gemini-3-flash-preview\`)** multimodal API'si ile Türkçe metne çevrilir (STT) ve doğal dildeki niyet (intent) ayrıştırılır.
- **Google Takvim Entegrasyonu:** \`!toplanti\`, \`!randevu\` veya doğal dildeki ("Yarın saat 14:30'da Ahmet Bey ile toplantı planla") mesajları Google Calendar v3 API ile kullanıcının birincil (\`primary\`) takvimine etkinlik olarak ekler.
- **Google Kişiler (Contacts) Entegrasyonu:** \`!rehber\`, \`!kisi\` veya "Rehbere ekle: İsim Telefon Şirket" komutlarını Google People API v1 (\`people.createContact\`) ile Google Rehber'e kaydeder.
- **Not Defteri:** \`!not\` veya "Not al: ..." mesajlarını kategorize ederek kaydeder.

---

## 2. MEVCUT DOSYA YAPISI (NEXT.JS APP ROUTER)
Proje kök dizininde aşağıdaki dosyalar yer almaktadır:

- \`src/app/page.tsx\` : Tailwind CSS ile tasarlanmış, WhatsApp Web simülatörü (Web Speech API + MediaRecorder mikrofon destekli), Google Takvim (.ICS çıktısı), Google Kişiler (.VCF çıktısı), Not Defteri, Canlı Meta Graph API Mesaj Test Aracı ve Google Identity Services (GIS) OAuth2 istemcisini barındıran ana kontrol paneli.
- \`src/app/api/webhook/route.ts\` : **Vercel Serverless Function** uyumlu resmi Meta WhatsApp Cloud API Webhook uç noktası (\`GET\` doğrulama & \`POST\` mesaj/ses işleme).
- \`src/app/api/assistant/route.ts\` : Web simülatörü ve API istemcileri için Gemini 3 Flash + Google Calendar/People API senkronizasyon uç noktası.
- \`src/lib/assistant-engine.ts\` : Gemini multimodal ses/metin çözümleme, Türkçe doğal dil tarih/saat ayrıştırıcı ve Google OAuth2 REST istemcisi.
- \`bot-baileys.js\` : Meta Business onayı gerektirmeden, kişisel WhatsApp numarasıyla terminalde **QR Kod** okutarak çalışan \`@whiskeysockets/baileys\` tabanlı alternatif bot.
- \`.env.example\` : Gerekli ortam değişkenleri şablonu.

---

## 3. ORTAM DEĞİŞKENLERİ (ENVIRONMENT VARIABLES)
Uygulama aşağıdaki \`.env\` anahtarlarıyla çalışır:
\`\`\`env
GEMINI_API_KEY=AIzaSy...
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
GOOGLE_REDIRECT_URI=https://developers.google.com/oauthplayground
GOOGLE_REFRESH_TOKEN=1//04xxxx
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_PHONE_NUMBER_ID=1092837465...
WHATSAPP_VERIFY_TOKEN=whatsapp_gizli_anahtar_2026
\`\`\`

---

## 4. SENDEN BEKLENEN GÖREVLER (NEXT STEPS)
1. Mevcut dosya ağacını (\`src/app/page.tsx\`, \`src/app/api/webhook/route.ts\`, \`src/lib/assistant-engine.ts\`, \`bot-baileys.js\`) doğrula.
2. Yapacağımız yeni geliştirmelerde hem **Next.js API (\`/api/webhook\` & \`/api/assistant\`)** hem de **Önyüz Kontrol Paneli (\`src/app/page.tsx\`)** arasındaki senkronizasyonu koru.
3. Doğal dil tarih/saat çözümlemesini (NLP) güçlendirmek için Gemini API'den yapılandırılmış JSON döndürerek etkinlik tarihi, başlangıç/bitiş saati ve katılımcı bilgilerini otomatik çıkaran akıllı ayrıştırıcıyı aktif tut.`,

  rules: `# .antigravityrules - Proje Mimari ve Kodlama Kuralları

## Genel Prensipler
- Dil: Tüm kullanıcı arayüzü metinleri, WhatsApp bot yanıtları ve hata mesajları akıcı **Türkçe** olmalıdır.
- Zaman Dilimi: Tüm Google Takvim (Google Calendar API) etkinliklerinde varsayılan saat dilimi \`Europe/Istanbul\` (\`UTC+03:00\`) olarak kullanılmalıdır.

## AI & Ses İşleme (Speech-to-Text & NLU)
- Ses çözümleme ve metin analizi için her zaman \`gemini-3-flash-preview\` modeli kullanılmalıdır.
- WhatsApp'tan gelen ses kayıtları Meta Graph API üzerinden \`arraybuffer\` olarak çekilip \`base64\` formatında (\`mimeType: "audio/ogg"\`) Gemini'ye iletilmelidir.

## Sunucu ve Dağıtım (Deployment) Kuralları
- \`src/app/api/webhook/route.ts\` dosyası Vercel Serverless ortamında çalıştığı için uzun süren işlemlerde Meta'nın yeniden deneme (retry) yapmaması adına \`200 OK\` yanıtı hızlıca dönülmeli ve hata yönetimi \`try/catch\` bloklarıyla korunmalıdır.
- Hassas anahtarlar (\`WHATSAPP_ACCESS_TOKEN\`, \`GOOGLE_REFRESH_TOKEN\`, \`GEMINI_API_KEY\`) asla istemci koduna gömülmemeli, her zaman \`process.env\` üzerinden okunmalıdır.`,

  config: JSON.stringify(
    {
      project: "whatsapp-google-workspace-assistant",
      version: "3.0.0",
      framework: "nextjs-app-router",
      language: "tr",
      entrypoints: {
        frontend: "src/app/page.tsx",
        serverless_webhook: "src/app/api/webhook/route.ts",
        assistant_api: "src/app/api/assistant/route.ts",
        qr_bot: "bot-baileys.js",
      },
      integrations: [
        {
          name: "Meta WhatsApp Cloud API",
          version: "v20.0",
          features: [
            "text_messages",
            "audio_ogg_voice_notes",
            "webhook_verification",
          ],
        },
        {
          name: "Google Workspace APIs",
          services: ["Google Calendar API v3", "Google People API v1"],
          auth: "OAuth2 Refresh Token + Google Identity Services (GIS)",
        },
        {
          name: "Google Gemini API",
          model: "gemini-3-flash-preview",
          capabilities: ["audio_transcription_tr", "intent_parsing"],
        },
      ],
      env_required: [
        "GEMINI_API_KEY",
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REDIRECT_URI",
        "GOOGLE_REFRESH_TOKEN",
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_VERIFY_TOKEN",
      ],
    },
    null,
    2
  ),
};

export const BACKEND_TEMPLATES: Record<
  "baileys" | "node" | "google" | "env" | "docker" | "verceljson",
  string
> = {
  baileys: `// bot-baileys.js - KİŞİSEL NUMARAYLA QR KODLU WHATSAPP ASİSTANI
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
    \`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=\${process.env.GEMINI_API_KEY}\`,
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
  const prefix = isVoice ? '🎙️ *[Sesli Mesaj Çözümlendi]*\\n\\n' : '';

  if (lower.includes('toplantı') || lower.includes('randevu') || lower.startsWith('!toplanti')) {
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: text,
        start: { dateTime: new Date(Date.now() + 86400000).toISOString() },
        end: { dateTime: new Date(Date.now() + 90000000).toISOString() }
      }
    });
    await sock.sendMessage(jid, { text: \`\${prefix}📅 Google Takvim'e eklendi:\\n📌 \${text}\\n🔗 Link: \${res.data.htmlLink}\` });
  } else if (lower.includes('rehbere ekle') || lower.startsWith('!rehber')) {
    await people.people.createContact({
      requestBody: {
        names: [{ givenName: text.replace(/(!rehber|rehbere ekle)/gi, '').trim() }],
        phoneNumbers: [{ value: jid.split('@')[0], type: 'mobile' }]
      }
    });
    await sock.sendMessage(jid, { text: \`\${prefix}👤 Google Rehber'e kaydedildi!\` });
  } else if (lower.startsWith('!not') || lower.includes('not al')) {
    await sock.sendMessage(jid, { text: \`\${prefix}📝 Notunuz hafızaya alındı:\\n"\${text}"\` });
  }
}

startWhatsAppBot();`,

  node: `// server.js - RESMİ META CLOUD API WEBHOOK SUNUCUSU (STANDALONE EXPRESS)
// Not: Next.js projenizde bu uç nokta src/app/api/webhook/route.ts içinde zaten yerleşik olarak çalışmaktadır!
// Bağımsız Express sunucusu olarak çalıştırmak isterseniz:

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { google } = require('googleapis');

const app = express();
app.use(bodyParser.json());

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const people = google.people({ version: 'v1', auth: oauth2Client });

app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return;

  const sender = msg.from;
  let text = '';
  let isVoice = false;

  if (msg.type === 'text') {
    text = msg.text.body;
  } else if (msg.type === 'audio') {
    isVoice = true;
    text = await fetchAndTranscribeMetaAudio(msg.audio.id);
  }

  if (text) {
    await syncWithGoogle(sender, text, isVoice);
  }
});

async function fetchAndTranscribeMetaAudio(mediaId) {
  const meta = await axios.get(\`https://graph.facebook.com/v20.0/\${mediaId}\`, {
    headers: { Authorization: \`Bearer \${process.env.WHATSAPP_ACCESS_TOKEN}\` }
  });
  const audio = await axios.get(meta.data.url, {
    headers: { Authorization: \`Bearer \${process.env.WHATSAPP_ACCESS_TOKEN}\` },
    responseType: 'arraybuffer'
  });
  const b64 = Buffer.from(audio.data).toString('base64');
  const res = await axios.post(
    \`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=\${process.env.GEMINI_API_KEY}\`,
    { contents: [{ parts: [{ text: "Türkçe sesi metne çevir:" }, { inlineData: { mimeType: "audio/ogg", data: b64 } }] }] }
  );
  return res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function syncWithGoogle(to, text, isVoice) {
  const lower = text.toLowerCase();
  let reply = '';
  if (lower.includes('toplantı') || lower.includes('randevu')) {
    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: { summary: text, start: { dateTime: new Date(Date.now() + 86400000).toISOString() }, end: { dateTime: new Date(Date.now() + 90000000).toISOString() } }
    });
    reply = \`📅 Google Takvim'e kaydedildi: \${text}\`;
  } else if (lower.includes('rehber')) {
    await people.people.createContact({ requestBody: { names: [{ givenName: text }] } });
    reply = \`👤 Google Kişiler'e eklendi: \${text}\`;
  } else {
    reply = \`📝 Notunuz alındı: "\${text}"\`;
  }

  await axios.post(\`https://graph.facebook.com/v20.0/\${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages\`, {
    messaging_product: 'whatsapp',
    to: to,
    text: { body: reply }
  }, { headers: { Authorization: \`Bearer \${process.env.WHATSAPP_ACCESS_TOKEN}\` } });
}

app.listen(process.env.PORT || 3000, () => console.log('Sunucu 3000 portunda çalışıyor.'));`,

  google: `====================================================================
GOOGLE WORKSPACE (CALENDAR & PEOPLE API) OAUTH2 HAZIRLIK ADIMLARI
====================================================================

1. Google Cloud Projesi Oluşturma:
   • https://console.cloud.google.com adresine gidin.
   • 'Yeni Proje' oluşturun (Örn: "WhatsApp Asistan").

2. API'leri Etkinleştirme:
   • 'APIs & Services' > 'Library' sekmesine gidin.
   • "Google Calendar API" aratıp ETKİNLEŞTİRİN.
   • "Google People API" aratıp ETKİNLEŞTİRİN.

3. OAuth Consent Screen (Onay Ekranı):
   • 'OAuth consent screen' sekmesinde 'External' seçin.
   • Scopes (İzinler) kısmına şunları ekleyin:
     - https://www.googleapis.com/auth/calendar.events
     - https://www.googleapis.com/auth/contacts

4. Client ID & Secret Alma:
   • 'Credentials' > 'Create Credentials' > 'OAuth Client ID' tıklayın.
   • Uygulama türü: "Web application"
   • Authorized redirect URI:
     https://developers.google.com/oauthplayground

5. Refresh Token (Kalıcı Token) Alma:
   • https://developers.google.com/oauthplayground adresine gidin.
   • Sağ üstteki çarktan (Settings) "Use your own OAuth credentials" kutusunu işaretleyin.
   • Client ID ve Secret yapıştırıp Calendar v3 ve People v1 izinlerini onaylayın.
   • "Exchange authorization code for tokens" butonuna basarak 'Refresh token' elde edin.`,

  env: `# .env.local - Next.js & Canlı Ortam Değişkenleri
PORT=3000

# Meta Developers (WhatsApp Cloud API Kullanıyorsanız):
WHATSAPP_VERIFY_TOKEN=whatsapp_gizli_anahtar_2026
WHATSAPP_ACCESS_TOKEN=EAAG... (Kalıcı Sistem Belirteci)
WHATSAPP_PHONE_NUMBER_ID=109283746592817

# Google Cloud OAuth 2.0 Bilgileri:
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
GOOGLE_REDIRECT_URI=https://developers.google.com/oauthplayground
GOOGLE_REFRESH_TOKEN=1//04xxxx-xxxxxxxx

# Multimodal Yapay Zeka (Sesli Not STT & NLU):
GEMINI_API_KEY=AIzaSy...`,

  docker: `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "bot-baileys.js"]`,

  verceljson: `// ====================================================================
// NEXT.JS APP ROUTER WEBHOOK ENDPOINT: src/app/api/webhook/route.ts
// Vercel üzerinde ekstra vercel.json ayarına gerek kalmadan
// https://SENIN-SITEN.vercel.app/api/webhook adresinde otomatik çalışır!
// ====================================================================

import { NextRequest, NextResponse } from "next/server";
import { processAssistantInput } from "@/lib/assistant-engine";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || "whatsapp_gizli_anahtar_2026";

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Doğrulama başarısız" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  // WhatsApp yazılı ve sesli (audio/ogg) mesajları yakalar,
  // Gemini 3 Flash ile çözümler ve Google Calendar / Contacts API'ye kaydeder.
  // Tam kaynak kod: src/app/api/webhook/route.ts
}`,
};

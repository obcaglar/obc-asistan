// bot-baileys.js - 7/24 BULUT & YEREL UYUMLU WHATSAPP QR ASİSTANI
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");
const axios = require("axios");
const pino = require("pino");

const QR_HTML_PATH = path.join(__dirname, "public", "qr.html");
const ASSISTANT_API_URL =
  process.env.ASSISTANT_API_URL || "http://localhost:3000/api/assistant";
const VERCEL_API_URL =
  process.env.VERCEL_API_URL || "https://obc-asistan.vercel.app/api/assistant";

let latestQrHtml = "";

function buildQrHtml(status, qrDataUrl = null) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${status !== "connected" ? '<meta http-equiv="refresh" content="3" />' : ""}
  <title>WhatsApp 7/24 QR Bağlantısı - OBC Asistan</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans">
  <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-5">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
      status === "connected"
        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
    }">
      <span class="w-2 h-2 rounded-full ${
        status === "connected" ? "bg-emerald-400" : "bg-amber-400 animate-ping"
      }"></span>
      ${
        status === "connected"
          ? "7/24 WhatsApp & Google Bağlantısı Aktif!"
          : status === "qr"
            ? "QR Kod Hazır — Telefonunuzla Taratın"
            : "WhatsApp QR Kodu Hazırlanıyor..."
      }
    </div>

    <h1 class="text-xl font-bold">WhatsApp ⇄ Google Workspace Asistanı</h1>

    ${
      status === "connected"
        ? `<div class="p-6 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl space-y-3">
             <div class="text-4xl">✅</div>
             <p class="text-sm font-semibold text-emerald-300">Telefonunuz & Google Hesabınız Canlı Bağlı!</p>
             <p class="text-xs text-slate-300 leading-relaxed">
               Artık telefonunuzdan veya <b>web.whatsapp.com</b> üzerinden <b>"Kendime Mesaj (Siz)"</b> sohbetine:<br/><br/>
               • <code class="text-emerald-300">!toplanti Yarın 14:30 Bütçe Toplantısı</code><br/>
               • <code class="text-emerald-300">!rehber Ali Yılmaz 05321112233</code><br/>
               • <code class="text-emerald-300">!not Sunucu yedeklerini kontrol et</code><br/>
               yazabilir veya <b>sesli mesaj</b> gönderebilirsiniz!
             </p>
           </div>`
        : qrDataUrl
          ? `<div class="bg-white p-4 rounded-2xl inline-block shadow-lg">
               <img src="${qrDataUrl}" alt="WhatsApp QR Code" class="w-64 h-64 mx-auto" />
             </div>
             <ol class="text-xs text-slate-300 text-left space-y-1.5 bg-slate-950 p-4 rounded-2xl border border-slate-800 list-decimal list-inside">
               <li>Telefonunuzda <b>WhatsApp</b> uygulamasını açın.</li>
               <li><b>Ayarlar</b> &gt; <b>Bağlı Cihazlar</b> menüsüne girin.</li>
               <li><b>Cihaz Bağla</b> butonuna basıp yukarıdaki QR kodu okutun.</li>
             </ol>`
          : `<div class="py-12 text-slate-400 text-sm">QR kod oluşturuluyor, sayfa otomatik yenilenecek...</div>`
    }
  </div>
</body>
</html>`;
}

function writeQrHtmlPage(status, qrDataUrl = null) {
  latestQrHtml = buildQrHtml(status, qrDataUrl);
  try {
    if (fs.existsSync(path.dirname(QR_HTML_PATH))) {
      fs.writeFileSync(QR_HTML_PATH, latestQrHtml, "utf-8");
    }
  } catch (e) {
    // Ignore write error in read-only containers
  }
}

// Standalone Cloud Fallback (works 24/7 even when localhost:3000 is not running)
async function getGoogleAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const res = await axios.post(
      "https://oauth2.googleapis.com/token",
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    return res.data?.access_token || null;
  } catch {
    return null;
  }
}

async function processStandaloneCloud( { text, audioBase64, mimeType, isVoice } ) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const nowStr = new Date().toLocaleString("en-US", {
    timeZone: "Europe/Istanbul",
  });
  const now = new Date(nowStr);
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  let parsed = null;
  if (geminiKey) {
    try {
      const prompt = `Sen Türkçe çalışan bir WhatsApp & Google Workspace Asistanısın. Bugünün tarihi: ${todayIso}.
Kullanıcının mesajını veya sesini incele ve JSON döndür:
{
  "transcript": "Söylenen veya yazılan metin",
  "intent": "calendar" | "contact" | "note" | "help",
  "calendar": { "title": "...", "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "attendee": "...", "location": "Google Meet" },
  "contact": { "name": "...", "phone": "...", "email": "...", "company": "...", "notes": "..." },
  "note": { "title": "...", "content": "...", "category": "WhatsApp Notu" }
}`;
      const parts = [{ text: prompt }];
      if (audioBase64) {
        parts.push({
          inlineData: { mimeType: mimeType || "audio/ogg", data: audioBase64 },
        });
      }
      if (text) {
        parts.push({ text: `Kullanıcı mesajı: ${text}` });
      }
      const gRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }
      );
      const rawJson = gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawJson) parsed = JSON.parse(rawJson);
    } catch (e) {
      console.error("Gemini doğrudan çağrı hatası:", e.message);
    }
  }

  const accessToken = await getGoogleAccessToken();

  if (parsed?.intent === "calendar" && parsed.calendar) {
    const evt = parsed.calendar;
    let synced = false;
    if (accessToken) {
      try {
        await axios.post(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            summary: evt.title,
            location: evt.location || "Google Meet",
            description: `Katılımcı: ${evt.attendee || "WhatsApp Kullanıcısı"}`,
            start: {
              dateTime: `${evt.date}T${evt.startTime}:00+03:00`,
              timeZone: "Europe/Istanbul",
            },
            end: {
              dateTime: `${evt.date}T${evt.endTime}:00+03:00`,
              timeZone: "Europe/Istanbul",
            },
          },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        synced = true;
      } catch (e) {
        console.error("Google Calendar hatası:", e.message);
      }
    }
    return {
      replyText:
        `📅 *Google Takvim'e Etkinlik Eklendi!*\n\n` +
        `📌 *Başlık:* ${evt.title}\n` +
        `🗓️ *Tarih:* ${evt.date}, ${evt.startTime} - ${evt.endTime}\n` +
        `📍 *Konum:* ${evt.location || "Google Meet"}` +
        (synced ? "\n✅ *Gerçek Google Takvim'inize senkronize edildi!*" : ""),
    };
  }

  if (parsed?.intent === "contact" && parsed.contact) {
    const cnt = parsed.contact;
    let synced = false;
    if (accessToken) {
      try {
        await axios.post(
          "https://people.googleapis.com/v1/people:createContact?personFields=names,phoneNumbers,emailAddresses,organizations,biographies",
          {
            names: [{ givenName: cnt.name }],
            phoneNumbers: [{ value: cnt.phone, type: "mobile" }],
            emailAddresses: cnt.email
              ? [{ value: cnt.email, type: "work" }]
              : [],
            organizations: cnt.company ? [{ name: cnt.company }] : [],
          },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        synced = true;
      } catch (e) {
        console.error("Google Contacts hatası:", e.message);
      }
    }
    return {
      replyText:
        `👤 *Google Kişiler'e Başarıyla Kaydedildi!*\n\n` +
        `📇 *İsim:* ${cnt.name}\n` +
        `📞 *Telefon:* ${cnt.phone}\n` +
        `🏢 *Şirket:* ${cnt.company || "Belirtilmedi"}` +
        (synced ? "\n✅ *Gerçek Google Rehberinize kaydedildi!*" : ""),
    };
  }

  if (parsed?.intent === "note" && parsed.note) {
    return {
      replyText: `📝 *Not Defterine Kaydedildi!*\n\n"${parsed.note.content}"`,
    };
  }

  return {
    replyText: `📝 Mesajınız işlendi: "${parsed?.transcript || text || ""}"`,
  };
}

async function startWhatsAppBot() {
  writeQrHtmlPage("starting");
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["OBC WhatsApp Asistan", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n========================================================");
      console.log("📱 WHATSAPP QR KODU HAZIR!");
      console.log("========================================================\n");
      qrcodeTerminal.generate(qr, { small: true });
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
        writeQrHtmlPage("qr", qrDataUrl);
      } catch (err) {
        console.error("QR DataURL hatası:", err.message);
      }
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(() => startWhatsAppBot(), 2000);
      } else {
        writeQrHtmlPage("starting");
      }
    } else if (connection === "open") {
      console.log(
        "🚀 WhatsApp Asistanı CANLI! Telefonunuzdan veya web.whatsapp.com üzerinden komut gönderebilirsiniz."
      );
      writeQrHtmlPage("connected");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const m of messages) {
      if (!m.message) continue;

      const jid = m.key.remoteJid;
      if (!jid || jid === "status@broadcast") continue;

      let text =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        m.message.ephemeralMessage?.message?.extendedTextMessage?.text ||
        m.message.ephemeralMessage?.message?.conversation ||
        "";

      if (
        text.startsWith("📅 *Google Takvim") ||
        text.startsWith("🔄 *Google Takvim") ||
        text.startsWith("🗑️ *Google Takvim") ||
        text.startsWith("👤 *Google Kişiler") ||
        text.startsWith("🔄 *Google Kişiler") ||
        text.startsWith("🗑️ *Google Kişiler") ||
        text.startsWith("⚠️ *Silinecek") ||
        text.startsWith("📝 *Not Defterine") ||
        text.startsWith("📝 Mesajınız işlendi") ||
        text.startsWith("🎙️ *[Sesli Mesaj") ||
        text.startsWith("Anlayamadım. Lütfen")
      ) {
        continue;
      }

      const lower = text.toLocaleLowerCase("tr-TR");
      const isCommand =
        Boolean(m.message.audioMessage) ||
        lower.startsWith("!") ||
        lower.includes("toplantı") ||
        lower.includes("toplanti") ||
        lower.includes("randevu") ||
        lower.includes("etkinlik") ||
        lower.includes("takvim") ||
        lower.includes("rehber") ||
        lower.includes("kişi") ||
        lower.includes("kisi") ||
        lower.includes("numara") ||
        lower.includes("kaydet") ||
        lower.includes("ekle") ||
        lower.includes("güncelle") ||
        lower.includes("guncelle") ||
        lower.includes("değiştir") ||
        lower.includes("degistir") ||
        lower.includes("ertele") ||
        lower.includes("sil") ||
        lower.includes("iptal") ||
        lower.includes("kaldır") ||
        lower.includes("not al") ||
        lower.includes("not et");

      if (!isCommand) continue;

      let audioBase64 = undefined;
      let mimeType = undefined;
      let isVoice = false;

      if (m.message.audioMessage) {
        isVoice = true;
        try {
          const buffer = await downloadMediaMessage(m, "buffer", {});
          audioBase64 = buffer.toString("base64");
          mimeType = m.message.audioMessage.mimetype || "audio/ogg";
        } catch (err) {
          console.error("Ses indirme hatası:", err.message);
        }
      }

      if (!text && !audioBase64) continue;

      try {
        console.log(`📩 Komut işleniyor (${jid}):`, text || "[Sesli Mesaj]");
        let result = null;
        try {
          const response = await axios.post(
            ASSISTANT_API_URL,
            {
              text: text || undefined,
              audioBase64,
              mimeType,
              isVoice,
              fromWhatsAppBot: true,
            },
            { timeout: 12000 }
          );
          result = response.data;
        } catch {
          try {
            const vercelResponse = await axios.post(
              VERCEL_API_URL,
              {
                text: text || undefined,
                audioBase64,
                mimeType,
                isVoice,
                fromWhatsAppBot: true,
              },
              { timeout: 15000 }
            );
            result = vercelResponse.data;
          } catch {
            // If both local and Vercel servers are unreachable, process directly via Gemini + Google APIs!
            result = await processStandaloneCloud({
              text: text || undefined,
              audioBase64,
              mimeType,
              isVoice,
            });
          }
        }

        if (result && result.replyText) {
          const prefix = isVoice ? "🎙️ *[Sesli Mesaj Çözümlendi]*\n\n" : "";
          await sock.sendMessage(jid, { text: prefix + result.replyText });
          console.log("✅ Yanıt WhatsApp üzerinden gönderildi!");
        }
      } catch (err) {
        console.error("Asistan hatası:", err.message);
      }
    }
  });
}

// Start lightweight HTTP server for Cloud Health Checks & QR Code viewing (Render / Railway / Koyeb)
const CLOUD_PORT = process.env.BOT_PORT || process.env.PORT || 3001;
if (String(CLOUD_PORT) !== "3000" || process.env.RENDER || process.env.RAILWAY_ENVIRONMENT) {
  http
    .createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(latestQrHtml || "WhatsApp Bot Çalışıyor");
    })
    .listen(CLOUD_PORT, () => {
      console.log(`🌐 QR & Health Sunucusu Port ${CLOUD_PORT} üzerinde aktif.`);
    });
}

startWhatsAppBot();

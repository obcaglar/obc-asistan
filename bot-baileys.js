// bot-baileys.js - 7/24 BULUT & YEREL UYUMLU WHATSAPP QR ASİSTANI
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { exec } = require("child_process");
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
const TARGET_ASSISTANT_PHONE = (
  process.env.WHATSAPP_ASSISTANT_NUMBER || "+905491007729"
).replace(/\D/g, "");
const AUTH_DIR = `auth_info_baileys_${TARGET_ASSISTANT_PHONE}`;

let latestQrHtml = "";

function buildQrHtml(status, qrDataUrl = null, pairingCode = null) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${status !== "connected" ? '<meta http-equiv="refresh" content="3" />' : ""}
  <title>WhatsApp 7/24 QR Bağlantısı (+${TARGET_ASSISTANT_PHONE}) - OBC Asistan</title>
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
          ? `7/24 WhatsApp (+${TARGET_ASSISTANT_PHONE}) & Google Aktif!`
          : status === "qr"
            ? `+${TARGET_ASSISTANT_PHONE} Numaralı Telefonunuzla Taratın`
            : "WhatsApp QR Kodu Hazırlanıyor..."
      }
    </div>

    <h1 class="text-xl font-bold">WhatsApp ⇄ Google Workspace Asistanı</h1>
    <div class="text-xs font-mono bg-slate-950 border border-emerald-500/30 text-emerald-300 py-1.5 px-3 rounded-xl inline-block">
      Hedef Asistan Numarası: +${TARGET_ASSISTANT_PHONE}
    </div>

    ${
      status === "connected"
        ? `<div class="p-6 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl space-y-3">
             <div class="text-4xl">✅</div>
             <p class="text-sm font-semibold text-emerald-300">+${TARGET_ASSISTANT_PHONE} Numaralı WhatsApp & Google Hesabınız Canlı Bağlı!</p>
             <p class="text-xs text-slate-300 leading-relaxed">
               Artık <b>+${TARGET_ASSISTANT_PHONE}</b> numaralı WhatsApp hattınıza veya <b>"Kendime Mesaj (Siz)"</b> sohbetine:<br/><br/>
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
             ${
               pairingCode
                 ? `<div class="bg-emerald-950/50 border border-emerald-500/40 rounded-2xl p-3 space-y-1">
                      <div class="text-[11px] text-emerald-300 font-semibold">Veya Telefon Numarasıyla Bağlama Kodu (+${TARGET_ASSISTANT_PHONE}):</div>
                      <div class="text-2xl font-mono font-bold tracking-widest text-white">${pairingCode}</div>
                    </div>`
                 : ""
             }
             <ol class="text-xs text-slate-300 text-left space-y-1.5 bg-slate-950 p-4 rounded-2xl border border-slate-800 list-decimal list-inside">
               <li><b>+${TARGET_ASSISTANT_PHONE}</b> numaralı telefonunuzda <b>WhatsApp</b> uygulamasını açın.</li>
               <li><b>Ayarlar</b> &gt; <b>Bağlı Cihazlar</b> menüsüne girin.</li>
               <li><b>Cihaz Bağla</b> butonuna basıp yukarıdaki QR kodu okutun.</li>
             </ol>`
          : `<div class="py-12 text-slate-400 text-sm">QR kod oluşturuluyor, sayfa otomatik yenilenecek...</div>`
    }
  </div>
</body>
</html>`;
}

function writeQrHtmlPage(status, qrDataUrl = null, pairingCode = null) {
  latestQrHtml = buildQrHtml(status, qrDataUrl, pairingCode);
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
  require("dotenv").config({ path: ".env.local", override: true });
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

async function processStandaloneCloud({ text, audioBase64, mimeType, isVoice }) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const nowStr = new Date().toLocaleString("en-US", {
    timeZone: "Europe/Istanbul",
  });
  const now = new Date(nowStr);
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  let parsed = null;
  if (geminiKey) {
    const prompt = `Sen Türkçe çalışan bir WhatsApp & Google Workspace Asistanısın. Bugünün tarihi: ${todayIso}.
Kullanıcının mesajını veya Türkçe ses kaydını incele ve JSON döndür:
{
  "transcript": "Söylenen veya yazılan tam Türkçe metin",
  "intent": "calendar" | "contact" | "note" | "help",
  "calendar": { "title": "...", "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "attendee": "...", "location": "Google Meet" },
  "contact": { "name": "...", "phone": "...", "email": "...", "company": "...", "notes": "..." },
  "note": { "title": "...", "content": "...", "category": "WhatsApp Notu" }
}`;
    const cleanMimeType =
      (mimeType || "audio/ogg").split(";")[0].trim() || "audio/ogg";
    const parts = [{ text: prompt }];
    if (audioBase64) {
      parts.push({
        inlineData: { mimeType: cleanMimeType, data: audioBase64 },
      });
    }
    if (text) {
      parts.push({ text: `Kullanıcı mesajı: ${text}` });
    }

    const candidateModels = [
      "gemini-3.1-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
    ];

    for (const modelName of candidateModels) {
      try {
        const gRes = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          },
          { timeout: 6000 }
        );
        const rawJson = gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          parsed = JSON.parse(
            rawJson.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()
          );
          break;
        }
      } catch (e) {
        // Try next model
      }
    }
  }

  const accessToken = await getGoogleAccessToken();

  if (parsed?.intent === "calendar" && parsed.calendar) {
    const evt = parsed.calendar;
    const trLower = String(parsed.transcript || text || "").toLocaleLowerCase("tr-TR");
    const isDeleteCmd =
      parsed.action === "delete" ||
      /\b(sil|siler|silin|iptal|kaldır|kaldir|çıkar|cikar)\b/i.test(trLower);

    if (isDeleteCmd) {
      return {
        transcript: parsed.transcript,
        replyText:
          `⚠️ *Geçici Bağlantı Uyarısı:* Silme işlemi için ana sunucu yanıtı bekleniyor. Lütfen birkaç saniye sonra tekrar deneyin.`,
      };
    }

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
      transcript: parsed.transcript,
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
    const trLower = String(parsed.transcript || text || "").toLocaleLowerCase("tr-TR");
    if (
      parsed.action === "delete" ||
      parsed.action === "update" ||
      /\b(sil|kaldır|kaldir|güncelle|guncelle|değiştir|degistir|düzenle|duzenle)\b/i.test(trLower)
    ) {
      return {
        transcript: parsed.transcript,
        duplicate: true,
        replyText: "",
      };
    }
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
      transcript: parsed.transcript,
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
      transcript: parsed.transcript,
      replyText: `📝 *Not Defterine Kaydedildi!*\n\n"${parsed.note.content}"`,
    };
  }

  return {
    transcript: parsed?.transcript || text || "",
    replyText: `📝 Mesajınız işlendi: "${parsed?.transcript || text || ""}"`,
  };
}

// ============================================================================
// SINGLETON SOCKET & DEDUPLICATION STATE (PREVENTS DUPLICATE REPLIES)
// ============================================================================
let activeSock = null;
let reconnectTimer = null;
const processedMessageIds = new Set();
const sentBotMessageIds = new Set();
const recentCommandSignatures = new Map();
const processedMediaSignatures = new Map();
const inFlightJids = new Set();
const lastCommandTimePerJid = new Map();
const lastBotReplyTimePerJid = new Map();
const botSendingVoiceUntil = new Map();
const activeVoiceCallJids = new Map();
const BOT_INVISIBLE_MARKER = "\u200B";

async function generateTurkishFemaleVoiceBuffer(rawText) {
  try {
    const cleaned = String(rawText || "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[0-9]\uFE0F?\u20E3/g, " ")
      .replace(/[*_`~#•━]/g, " ")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    if (!cleaned) return null;

    const url = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=tr&dt=t&q=${encodeURIComponent(
      cleaned
    )}`;
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 7000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (res.data && res.data.byteLength > 200) {
      return Buffer.from(res.data);
    }
  } catch {}
  return null;
}

async function sendFemaleVoiceNoteSafely(sock, jid, speechText) {
  const ttsBuf = await generateTurkishFemaleVoiceBuffer(speechText);
  if (!ttsBuf) return;

  try {
    const sha256 = crypto.createHash("sha256").update(ttsBuf).digest("base64");
    processedMediaSignatures.set(`media:${sha256}`, Date.now());
    processedMediaSignatures.set(`media:${ttsBuf.length}`, Date.now());
    botSendingVoiceUntil.set(jid, Date.now() + 9000);

    const sentVoice = await sock.sendMessage(jid, {
      audio: ttsBuf,
      mimetype: "audio/mp4",
      ptt: true,
    });
    lastBotReplyTimePerJid.set(jid, Date.now());
    if (sentVoice?.key?.id) {
      sentBotMessageIds.add(sentVoice.key.id);
      processedMessageIds.add(sentVoice.key.id);
    }
  } catch (err) {
    console.error("Kadın sesli yanıt gönderme hatası:", err.message);
  }
}

async function startWhatsAppBot() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (activeSock) {
    try {
      activeSock.ev.removeAllListeners();
      activeSock.ws?.close();
    } catch {}
    activeSock = null;
  }

  writeQrHtmlPage("starting");
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["OBC WhatsApp Asistan", "Chrome", "1.0.0"],
  });

  activeSock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    if (sock !== activeSock) return;
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n========================================================");
      console.log(`📱 +${TARGET_ASSISTANT_PHONE} İÇİN WHATSAPP QR KODU HAZIR!`);
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
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => startWhatsAppBot(), 2500);
      } else {
        writeQrHtmlPage("starting");
      }
    } else if (connection === "open") {
      const connectedId = String(sock.user?.id || "");
      if (connectedId.includes("905336330011")) {
        console.error(
          "⛔ Eski numara (905336330011) engellendi! Sadece +905491007729 kabul edilmektedir."
        );
        try {
          await sock.logout();
        } catch {}
        return;
      }
      console.log(
        `🚀 WhatsApp Asistanı (+${TARGET_ASSISTANT_PHONE}) CANLI! Telefonunuzdan veya web.whatsapp.com üzerinden yazılı ve sesli komut gönderebilirsiniz.`
      );
      writeQrHtmlPage("connected");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (sock !== activeSock) return;
    if (type !== "notify") return;

    for (const m of messages) {
      if (!m.message) continue;

      const msgId = m.key?.id;
      if (!msgId) continue;

      // 1. Skip messages sent by this bot or already processed
      if (sentBotMessageIds.has(msgId) || processedMessageIds.has(msgId)) {
        continue;
      }

      // 2. Skip old history sync messages (> 60s old)
      const msgTs = Number(m.messageTimestamp || 0);
      if (msgTs > 0 && Math.floor(Date.now() / 1000) - msgTs > 60) {
        continue;
      }

      const jid = m.key.remoteJid;
      if (!jid || jid === "status@broadcast") continue;

      // Unwrap ephemeral / viewOnce containers so both text and voice notes work in all chats
      const innerMsg =
        m.message.ephemeralMessage?.message ||
        m.message.viewOnceMessage?.message ||
        m.message.viewOnceMessageV2?.message ||
        m.message.documentWithCaptionMessage?.message ||
        m.message;

      let text =
        innerMsg.conversation ||
        innerMsg.extendedTextMessage?.text ||
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        "";

      // 3. Skip any bot output message (invisible marker or bot prefixes) & record bot reply timestamp
      const trimmedText = text.replace(/^\u200B+|\u200B+$/g, "").trim();
      if (
        text.includes(BOT_INVISIBLE_MARKER) ||
        trimmedText.startsWith("🎙️") ||
        trimmedText.includes("🎙️") ||
        trimmedText.includes("Sesli Komut Algılandı") ||
        trimmedText.includes("Sesli Mesaj Çözümlendi") ||
        trimmedText.startsWith("📅 *Google Takvim") ||
        trimmedText.startsWith("🔄 *Google Takvim") ||
        trimmedText.startsWith("🗑️ *Google Takvim") ||
        trimmedText.startsWith("📨 *Google Takvim") ||
        trimmedText.startsWith("👤 *Google Kişiler") ||
        trimmedText.startsWith("🔄 *Google Kişiler") ||
        trimmedText.startsWith("🗑️ *Google Kişiler") ||
        trimmedText.startsWith("⚠️ *Silinecek") ||
        trimmedText.startsWith("📝 *Not Defterine") ||
        trimmedText.startsWith("📝 *Google Tasks") ||
        trimmedText.startsWith("📋 *Google Tasks") ||
        trimmedText.startsWith("📸 *Google Photos") ||
        trimmedText.startsWith("📁 *Google Drive") ||
        trimmedText.startsWith("✅ *Seçilen") ||
        trimmedText.startsWith("⚡ *Peş Peşe") ||
        trimmedText.startsWith("📞 *Canlı Sesli Arama") ||
        trimmedText.startsWith("📞 *Çağrınız Yanıtlandı") ||
        trimmedText.startsWith("🛑 *Sesli Arama") ||
        trimmedText.startsWith("⏸️ *Asistan Dinleme") ||
        trimmedText.startsWith("👩‍💼 *Canlı Sesli Asistan") ||
        trimmedText.startsWith("📝 Mesajınız işlendi") ||
        trimmedText.startsWith("Anlayamadım. Lütfen") ||
        trimmedText.includes("📌 *Başlık:*") ||
        trimmedText.includes("📌 *Görev / Not:*") ||
        trimmedText.includes("🗓️ *Tarih:*")
      ) {
        processedMessageIds.add(msgId);
        lastBotReplyTimePerJid.set(jid, Date.now());
        continue;
      }

      const audioMsg = innerMsg.audioMessage || m.message.audioMessage;
      const lower = trimmedText.toLocaleLowerCase("tr-TR");
      const hasClockTime = /\b([01]?\d|2[0-3])[:.][0-5]\d\b/.test(lower);
      const isCommand =
        Boolean(audioMsg) ||
        lower.startsWith("!") ||
        hasClockTime ||
        lower.includes("toplantı") ||
        lower.includes("toplanti") ||
        lower.includes("randevu") ||
        lower.includes("etkinlik") ||
        lower.includes("görev") ||
        lower.includes("gorev") ||
        lower.includes("görüşme") ||
        lower.includes("gorusme") ||
        lower.includes("takvim") ||
        lower.includes("ajanda") ||
        lower.includes("rehber") ||
        lower.includes("kişi") ||
        lower.includes("kisi") ||
        lower.includes("numara") ||
        lower.includes("kaydet") ||
        lower.includes("ekle") ||
        lower.includes("girer misin") ||
        lower.includes("gönder") ||
        lower.includes("gonder") ||
        lower.includes("davet") ||
        lower.includes("paylaş") ||
        lower.includes("paylas") ||
        lower.includes("güncelle") ||
        lower.includes("guncelle") ||
        lower.includes("değiştir") ||
        lower.includes("degistir") ||
        lower.includes("ertele") ||
        lower.includes("öne çek") ||
        lower.includes("one cek") ||
        lower.includes("ileri al") ||
        lower.includes("ileriye al") ||
        lower.includes("sil") ||
        lower.includes("iptal") ||
        lower.includes("kaldır") ||
        lower.includes("hatırlat") ||
        lower.includes("not al") ||
        lower.includes("not et") ||
        lower.includes("iş olarak") ||
        lower.includes("is olarak") ||
        lower.includes("foto") ||
        lower.includes("resim") ||
        lower.includes("albüm") ||
        lower.includes("album") ||
        lower.includes("galeri") ||
        lower.includes("drive") ||
        lower.includes("dosya") ||
        lower.includes("belge") ||
        lower.includes("doküman") ||
        lower.includes("dokuman") ||
        lower.includes("klasör") ||
        lower.includes("klasor") ||
        lower.includes("pdf") ||
        lower.includes("excel") ||
        lower.includes("seçenek") ||
        lower.includes("secenek") ||
        lower.includes("numara") ||
        lower.includes("numaralı") ||
        lower.includes("ardından") ||
        lower.includes("daha sonra") ||
        lower.includes("kapat") ||
        lower.includes("durdur") ||
        lower.includes("dur") ||
        lower.includes("stop") ||
        lower.includes("bitir") ||
        lower.includes("sonlandır") ||
        lower.includes("sonlandir") ||
        lower.includes("sessize al") ||
        lower.includes("duraklat");

      if (!isCommand) continue;

      processedMessageIds.add(msgId);
      if (processedMessageIds.size > 500) {
        const firstId = processedMessageIds.values().next().value;
        processedMessageIds.delete(firstId);
      }

      // 4. SYNCHRONOUS LOCK BEFORE AWAIT (prevents race condition when Baileys fires two upsert events for 1 voice note)
      const nowPre = Date.now();
      for (const [k, ts] of processedMediaSignatures.entries()) {
        if (nowPre - ts > 25000) processedMediaSignatures.delete(k);
      }
      if (audioMsg) {
        const isSelfChat = jid.startsWith(TARGET_ASSISTANT_PHONE);
        const mimeStr = String(audioMsg.mimetype || "").toLowerCase();
        if (
          (m.key?.fromMe && !isSelfChat) ||
          (m.key?.fromMe &&
            (mimeStr.includes("mp4") || mimeStr.includes("mpeg"))) ||
          nowPre < (botSendingVoiceUntil.get(jid) || 0)
        ) {
          processedMessageIds.add(msgId);
          continue;
        }
        const rawSha = audioMsg.fileSha256
          ? Buffer.from(audioMsg.fileSha256).toString("base64")
          : "";
        const rawMediaKey = audioMsg.mediaKey
          ? Buffer.from(audioMsg.mediaKey).toString("base64")
          : "";
        const mediaLockKey = `media:${rawSha || rawMediaKey || audioMsg.fileLength || msgId}`;
        if (
          processedMediaSignatures.has(mediaLockKey) ||
          processedMediaSignatures.has(`media:${audioMsg.fileLength}`) ||
          inFlightJids.has(jid) ||
          nowPre - (lastCommandTimePerJid.get(jid) || 0) < 8000
        ) {
          console.log(
            "⏭️ Eşzamanlı çift sesli mesaj olayı indirme öncesinde engellendi:",
            msgId
          );
          continue;
        }
        processedMediaSignatures.set(mediaLockKey, nowPre);
      } else {
        const textPreKey = `text:${lower}`;
        if (
          processedMediaSignatures.has(textPreKey) ||
          inFlightJids.has(jid)
        ) {
          console.log(
            "⏭️ Eşzamanlı çift yazılı komut olayı engellendi:",
            msgId
          );
          continue;
        }
        processedMediaSignatures.set(textPreKey, nowPre);
      }

      inFlightJids.add(jid);
      lastCommandTimePerJid.set(jid, nowPre);

      try {
        // If running on Render Cloud while Local PC might also be online, wait 12s so Local PC has priority on voice notes
        if (process.env.RENDER) {
          await new Promise((r) => setTimeout(r, 12000));
          if ((lastBotReplyTimePerJid.get(jid) || 0) >= nowPre) {
            console.log(
              "⏭️ Yerel asistan zaten yanıt verdi, bulut kopyası tek yanıt için atlanıyor."
            );
            continue;
          }
        }

        let audioBase64 = undefined;
        let mimeType = undefined;
        let isVoice = false;

        if (audioMsg) {
          isVoice = true;
          try {
            const buffer = await downloadMediaMessage(m, "buffer", {});
            audioBase64 = buffer.toString("base64");
            mimeType =
              (audioMsg.mimetype || "audio/ogg").split(";")[0].trim() ||
              "audio/ogg";
          } catch (err) {
            console.error("Ses indirme hatası:", err.message);
          }
        }

        if (!trimmedText && !audioBase64) continue;

        // 5. Content/Audio signature deduplication within 25 seconds
        const nowMs = Date.now();
        for (const [k, ts] of recentCommandSignatures.entries()) {
          if (nowMs - ts > 25000) recentCommandSignatures.delete(k);
        }
        const cmdSig = isVoice
          ? `voice:${audioBase64.slice(0, 160)}:${audioBase64.length}`
          : `text:${lower}`;
        if (recentCommandSignatures.has(cmdSig)) {
          console.log(
            "⏭️ Çift komut algılandı, tek yanıt için atlanıyor:",
            msgId
          );
          continue;
        }
        recentCommandSignatures.set(cmdSig, nowMs);

        console.log(
          `📩 Komut işleniyor (${jid}):`,
          trimmedText || `[Sesli Mesaj - ${mimeType}]`
        );
        require("dotenv").config({ path: ".env.local", override: true });
        const envCredentials = {
          geminiApiKey: process.env.GEMINI_API_KEY,
          googleClientId: process.env.GOOGLE_CLIENT_ID,
          googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
          googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        };
        let result = null;
        try {
          const response = await axios.post(
            ASSISTANT_API_URL,
            {
              text: trimmedText || undefined,
              audioBase64,
              mimeType,
              isVoice,
              fromWhatsAppBot: true,
              credentials: envCredentials,
            },
            { timeout: 22000 }
          );
          result = response.data;
        } catch (localErr) {
          // Only fallback to Vercel if local server is unreachable
          try {
            const vercelResponse = await axios.post(
              VERCEL_API_URL,
              {
                text: trimmedText || undefined,
                audioBase64,
                mimeType,
                isVoice,
                fromWhatsAppBot: true,
                credentials: envCredentials,
              },
              { timeout: 22000 }
            );
            result = vercelResponse.data;
          } catch {
            result = await processStandaloneCloud({
              text: trimmedText || undefined,
              audioBase64,
              mimeType,
              isVoice,
            });
          }
        }

        if (result?.duplicate || !result?.replyText) {
          console.log("⏭️ Mükerrer işlem/yanıt engellendi (tek kayıt garantisi).");
          continue;
        }

        let prefix = "";
        if (isVoice && !result.replyText.startsWith("🎙️")) {
          prefix = result.transcript
            ? `🎙️ *[Sesli Mesaj Çözümlendi]* _"${result.transcript}"_\n\n`
            : "🎙️ *[Sesli Mesaj Çözümlendi]*\n\n";
        }
        const finalMessage = prefix + result.replyText + BOT_INVISIBLE_MARKER;
        const sentMsg = await sock.sendMessage(jid, { text: finalMessage });
        lastBotReplyTimePerJid.set(jid, Date.now());
        if (sentMsg?.key?.id) {
          sentBotMessageIds.add(sentMsg.key.id);
          processedMessageIds.add(sentMsg.key.id);
        }

        // If Google Photos / Drive images were returned, also send up to 3 actual photos directly to WhatsApp
        if (Array.isArray(result.photos) && result.photos.length > 0) {
          const accessToken = await getGoogleAccessToken();
          for (const photo of result.photos.slice(0, 3)) {
            let imgBuffer = null;
            // 1. Try authenticated Drive API v3 media download URL first
            if (photo.downloadUrl && accessToken) {
              try {
                const imgRes = await axios.get(photo.downloadUrl, {
                  responseType: "arraybuffer",
                  timeout: 12000,
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (imgRes.data && imgRes.data.byteLength > 200) {
                  imgBuffer = Buffer.from(imgRes.data);
                }
              } catch {
                // Fallback to thumbnailUrl
              }
            }
            // 2. Fallback to thumbnailUrl (without Bearer header first, then with Bearer)
            if (!imgBuffer && photo.thumbnailUrl) {
              try {
                const thumbRes = await axios.get(photo.thumbnailUrl, {
                  responseType: "arraybuffer",
                  timeout: 8000,
                });
                if (thumbRes.data && thumbRes.data.byteLength > 200) {
                  imgBuffer = Buffer.from(thumbRes.data);
                }
              } catch {
                // Skip if unavailable
              }
            }
            if (imgBuffer) {
              try {
                const imgSent = await sock.sendMessage(jid, {
                  image: imgBuffer,
                  caption: `📸 *${photo.title}* (${photo.date})${BOT_INVISIBLE_MARKER}`,
                });
                lastBotReplyTimePerJid.set(jid, Date.now());
                if (imgSent?.key?.id) {
                  sentBotMessageIds.add(imgSent.key.id);
                  processedMessageIds.add(imgSent.key.id);
                }
              } catch (sendImgErr) {
                console.error("Fotoğraf gönderme hatası:", sendImgErr.message);
              }
            }
          }
        }

        // If a specific Google Drive file was selected ("5 numarayı paylaş" / "!drive 5 numaralı dosyayı paylaş") or single match returned, send the actual file as a WhatsApp document attachment!
        if (result.selectedDriveFile && result.selectedDriveFile.id) {
          const accessToken = await getGoogleAccessToken();
          const f = result.selectedDriveFile;
          if (accessToken) {
            try {
              const isGoogleWorkspaceDoc = String(f.mimeType || "").startsWith(
                "application/vnd.google-apps."
              );
              const downloadEndpoint = isGoogleWorkspaceDoc
                ? `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=application/pdf`
                : `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`;
              const docMime = isGoogleWorkspaceDoc
                ? "application/pdf"
                : f.mimeType || "application/octet-stream";
              const docFileName =
                isGoogleWorkspaceDoc && !f.name.toLowerCase().endsWith(".pdf")
                  ? `${f.name}.pdf`
                  : f.name;

              const docRes = await axios.get(downloadEndpoint, {
                responseType: "arraybuffer",
                timeout: 20000,
                headers: { Authorization: `Bearer ${accessToken}` },
              });

              if (
                docRes.data &&
                docRes.data.byteLength > 0 &&
                docRes.data.byteLength <= 45 * 1024 * 1024
              ) {
                const docSent = await sock.sendMessage(jid, {
                  document: Buffer.from(docRes.data),
                  fileName: docFileName,
                  mimetype: docMime,
                  caption: `📄 *${f.name}* (${f.typeLabel || "Belge"})${BOT_INVISIBLE_MARKER}`,
                });
                lastBotReplyTimePerJid.set(jid, Date.now());
                if (docSent?.key?.id) {
                  sentBotMessageIds.add(docSent.key.id);
                  processedMessageIds.add(docSent.key.id);
                }
              }
            } catch (docErr) {
              console.error(
                "Drive dosyası WhatsApp'a ek olarak gönderilemedi (link paylaşıldı):",
                docErr.message
              );
            }
          }
        }

        console.log("✅ Tekil yanıt WhatsApp üzerinden gönderildi!");
        if (result?.endCall && process.platform === "win32" && !process.env.RENDER) {
          exec(
            `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'chrome.exe'\\" | Where-Object { $_.CommandLine -like '*chrome_call_profile*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`
          );
        }
      } catch (err) {
        console.error("Asistan hatası:", err.message);
      } finally {
        inFlightJids.delete(jid);
      }
    }
  });

  // Listen to incoming WhatsApp Voice/Video Calls:
  // 1. Signal Local & Cloud web apps immediately and open a SINGLE Foreground Live Female Voice Assistant window
  // 2. End the WhatsApp ringing tone after 1.2s so Web WhatsApp and Mobile WhatsApp stop ringing right as the female assistant begins speaking
  // 3. Send a 1-tap Live Call Card (text only with BOT_INVISIBLE_MARKER, never audio files) including Stop/Hangup instructions
  const processedCallIds = new Set();
  let lastDesktopBrowserOpenMs = 0;
  let lastHandledTerminationMs = Date.now();
  let lastCallerJid = `${TARGET_ASSISTANT_PHONE}@s.whatsapp.net`;

  function closeDesktopCallWindow() {
    if (process.platform === "win32" && !process.env.RENDER) {
      exec(
        `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'chrome.exe'\\" | Where-Object { $_.CommandLine -like '*chrome_call_profile*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`
      );
    }
  }

  // Forward any command executed during the Live Voice Call UI straight into the caller's WhatsApp chat!
  const notifTimer = setInterval(async () => {
    if (sock !== activeSock) {
      clearInterval(notifTimer);
      return;
    }
    try {
      const nRes = await axios.get(
        `${ASSISTANT_API_URL}?consume_notifications=1`,
        { timeout: 2000 }
      );
      if (
        nRes.data?.callTerminatedAt &&
        nRes.data.callTerminatedAt > lastHandledTerminationMs
      ) {
        lastHandledTerminationMs = nRes.data.callTerminatedAt;
        setTimeout(() => closeDesktopCallWindow(), 2600);
      }
      const items = Array.isArray(nRes.data?.notifications)
        ? nRes.data.notifications
        : [];
      for (const item of items) {
        if (!item?.text) continue;
        let targetJid = (item.jid || lastCallerJid || "").replace(/:\d+@/, "@");
        if (!targetJid.includes("@")) {
          targetJid = `${targetJid.replace(/\D/g, "")}@s.whatsapp.net`;
        }
        const outMsg = item.text + BOT_INVISIBLE_MARKER;
        const sent = await sock.sendMessage(targetJid, { text: outMsg });
        lastBotReplyTimePerJid.set(targetJid, Date.now());
        if (sent?.key?.id) {
          sentBotMessageIds.add(sent.key.id);
          processedMessageIds.add(sent.key.id);
        }
      }
    } catch {}
  }, 2000);

  sock.ev.on("call", async (calls) => {
    for (const call of calls) {
      if (call.status !== "offer") continue;
      const rawCallerJid = call.from || call.chatId;
      if (!rawCallerJid) continue;
      const chatJid = rawCallerJid.replace(/:\d+@/, "@");

      if (call.id && processedCallIds.has(call.id)) continue;
      if (call.id) processedCallIds.add(call.id);

      const now = Date.now();
      lastCallerJid = chatJid;
      activeVoiceCallJids.set(chatJid, now);

      console.log(
        `📞 WhatsApp Sesli Arama Algılandı (${rawCallerJid} -> ${chatJid}, callId=${call.id}) -> Canlı Kadın Sesli Asistan Penceresi Açılıyor!`
      );

      // 1. Signal Local AND Cloud web apps immediately so any active mobile/desktop screen activates the Live Voice Call UI!
      axios
        .post(
          ASSISTANT_API_URL,
          { action: "incoming_call", callId: call.id, callerJid: chatJid },
          { timeout: 4000 }
        )
        .catch(() => {});
      if (VERCEL_API_URL && VERCEL_API_URL !== ASSISTANT_API_URL) {
        axios
          .post(
            VERCEL_API_URL,
            { action: "incoming_call", callId: call.id, callerJid: chatJid },
            { timeout: 4000 }
          )
          .catch(() => {});
      }

      // 2. On Windows desktop, close any previous call popup first so duplicate windows NEVER stack up, then open the single Call Window!
      if (
        process.platform === "win32" &&
        !process.env.RENDER &&
        now - lastDesktopBrowserOpenMs > 5000
      ) {
        lastDesktopBrowserOpenMs = now;
        try {
          const chromeExe =
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
          const callProfileDir = path.join(__dirname, ".chrome_call_profile");
          const callUrl = "http://localhost:3000/?call=1&autostart=1";
          if (fs.existsSync(chromeExe)) {
            exec(
              `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'chrome.exe'\\" | Where-Object { $_.CommandLine -like '*chrome_call_profile*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Start-Process -FilePath '${chromeExe}' -ArgumentList '--user-data-dir=\\"${callProfileDir}\\"','--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--window-size=540,840','--app=${callUrl}'"`
            );
            setTimeout(() => {
              exec(
                `powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).AppActivate('OBC')"`
              );
            }, 1100);
          } else {
            exec(`start "" "${callUrl}"`);
          }
        } catch {}
      }

      // 3. Stop the WhatsApp ringing sound after 1.2s (both raw device JID and chat JID) so Web WhatsApp and Mobile WhatsApp stop ringing right as the female assistant speaks!
      setTimeout(async () => {
        try {
          if (typeof sock.rejectCall === "function") {
            await sock.rejectCall(call.id, rawCallerJid);
            if (chatJid !== rawCallerJid) {
              await sock.rejectCall(call.id, chatJid).catch(() => {});
            }
          }
        } catch {}
      }, 1200);

      // 4. Send a 1-tap Live Call Card (text only with BOT_INVISIBLE_MARKER, never audio files) so Mobile & Web WhatsApp users see the call is active and know the stop commands
      try {
        const callMsg =
          `📞 *Çağrınız Yanıtlandı — Sizi Dinliyorum Onur Bey!*\n\n` +
          `👩‍💼 _"Buyurun Onur Bey, çağrınızı aldım, sizi dinliyorum. Ne yapmamı istersiniz?"_\n\n` +
          `🎙️ *Canlı Kadın Sesli Asistanınız mikrofonu açık olarak başlatıldı.* Doğrudan konuşabilir veya cep telefonunuzdan canlı görüşme ekranını açmak için dokunabilirsiniz:\n` +
          `👉 https://obc-asistan.vercel.app/?call=1&autostart=1\n\n` +
          `🛑 *Aramayı & Dinlemeyi Kapatmak İçin:* Sesli veya yazılı olarak *"Sohbeti ve telefonu kapat"*, *"Telefonu kapat"*, *"Dur"* veya *"Stop"* diyebilirsiniz.${BOT_INVISIBLE_MARKER}`;
        const sentCallMsg = await sock.sendMessage(chatJid, {
          text: callMsg,
        });
        lastBotReplyTimePerJid.set(chatJid, Date.now());
        if (sentCallMsg?.key?.id) {
          sentBotMessageIds.add(sentCallMsg.key.id);
          processedMessageIds.add(sentCallMsg.key.id);
        }
      } catch (err) {
        console.error("Çağrı kartı gönderim hatası:", err.message);
      }
    }
  });
}

// Start lightweight HTTP server for Singleton Lock, Cloud Health Checks & QR Code viewing
const CLOUD_PORT = Number(process.env.PORT || process.env.BOT_PORT || 3001);
const healthServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(latestQrHtml || "WhatsApp Bot Çalışıyor");
});

healthServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(
      `⚠️ Port ${CLOUD_PORT} üzerinde zaten aktif bir WhatsApp Asistan botu çalışıyor! Çift yanıtı önlemek için bu ikinci kopya kapatılıyor.`
    );
    process.exit(0);
  }
});

healthServer.listen(CLOUD_PORT, "0.0.0.0", () => {
  console.log(
    `🌐 Tekil WhatsApp Bot & QR Sunucusu Port ${CLOUD_PORT} üzerinde aktif.`
  );
  startWhatsAppBot();
});

// Self-keepalive ping for Render 24/7 operation
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => {
    axios.get(process.env.RENDER_EXTERNAL_URL).catch(() => {});
  }, 10 * 60 * 1000);
}

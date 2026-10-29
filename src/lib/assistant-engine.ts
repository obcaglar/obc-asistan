import fs from "fs";
import path from "path";

function loadFreshEnv() {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (val) {
          process.env[key] = val;
        }
      }
    }
  } catch {
    // Ignore on read-only filesystems
  }
}

export interface CalendarItem {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  attendee: string;
  attendeeEmail?: string;
  location: string;
  source: string;
  createdTime: string;
  htmlLink?: string;
  syncedWithGoogle?: boolean;
}

export interface ContactItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  notes: string;
  addedDate: string;
  syncedWithGoogle?: boolean;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: string;
  time: string;
}

export interface AssistantCredentials {
  geminiApiKey?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRefreshToken?: string;
  googleAccessToken?: string;
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
}

export type ActionType = "create" | "update" | "delete" | "share";

export interface AssistantProcessResult {
  transcript: string;
  intent: "calendar" | "contact" | "note" | "help";
  action?: ActionType;
  targetQuery?: string;
  replyText: string;
  usedGemini: boolean;
  syncedToGoogle: boolean;
  duplicate?: boolean;
  googleSyncError?: string;
  calendarEvent?: CalendarItem;
  contact?: ContactItem;
  note?: NoteItem;
}

export function isBotReplyEcho(rawText?: string): boolean {
  if (!rawText) return false;
  const t = rawText.replace(/^\u200B+|\u200B+$/g, "").trim();
  if (!t) return false;
  return (
    rawText.includes("\u200B") ||
    t.startsWith("🎙️") ||
    t.includes("🎙️") ||
    t.includes("📅 *Google Takvim") ||
    t.includes("🔄 *Google Takvim") ||
    t.includes("🗑️ *Google Takvim") ||
    t.includes("📨 *Google Takvim") ||
    t.includes("👤 *Google Kişiler") ||
    t.includes("🔄 *Google Kişiler") ||
    t.includes("🗑️ *Google Kişiler") ||
    t.includes("📝 *Not Defterine") ||
    t.includes("📝 Mesajınız işlendi") ||
    t.includes("⚠️ *Silinecek") ||
    t.startsWith("Anlayamadım. Lütfen") ||
    t.includes("Sesli Komut Algılandı") ||
    t.includes("Sesli Mesaj Çözümlendi") ||
    t.includes("📌 *Başlık:*") ||
    t.includes("🗓️ *Tarih:*") ||
    t.includes("Mehmet Bey ile bütçe toplantısı")
  );
}

export const recentWebhookEvents: {
  calendars: CalendarItem[];
  contacts: ContactItem[];
  notes: NoteItem[];
} = {
  calendars: [],
  contacts: [],
  notes: [],
};

function getIstanbulNow(): Date {
  const nowStr = new Date().toLocaleString("en-US", {
    timeZone: "Europe/Istanbul",
  });
  return new Date(nowStr);
}

function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateAndTimeFromTurkishText(text: string): {
  dateStr: string;
  startTime: string;
  endTime: string;
  hasExplicitTime: boolean;
  hasExplicitDate: boolean;
  shiftMinutes: number;
} {
  const lower = text.toLocaleLowerCase("tr-TR");
  const now = getIstanbulNow();
  const targetDate = new Date(now);
  let hasExplicitDate = false;

  if (lower.includes("yarın") || lower.includes("yarin")) {
    targetDate.setDate(now.getDate() + 1);
    hasExplicitDate = true;
  } else if (lower.includes("öbür gün") || lower.includes("ertesi gün")) {
    targetDate.setDate(now.getDate() + 2);
    hasExplicitDate = true;
  } else if (lower.includes("bugün") || lower.includes("bugun")) {
    hasExplicitDate = true;
  } else {
    const daysMap: Record<string, number> = {
      pazar: 0,
      pazartesi: 1,
      salı: 2,
      sali: 2,
      çarşamba: 3,
      carsamba: 3,
      perşembe: 4,
      persembe: 4,
      cuma: 5,
      cumartesi: 6,
    };
    for (const [dayName, dayIdx] of Object.entries(daysMap)) {
      if (lower.includes(dayName)) {
        const currentDay = now.getDay();
        let diff = (dayIdx - currentDay + 7) % 7;
        if (diff === 0) diff = 7;
        targetDate.setDate(now.getDate() + diff);
        hasExplicitDate = true;
        break;
      }
    }
    if (!hasExplicitDate) {
      targetDate.setDate(now.getDate() + 1);
    }
  }

  let dateStr = formatIsoDate(targetDate);
  const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const trDateMatch = text.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/);
  if (isoMatch) {
    dateStr = isoMatch[0];
    hasExplicitDate = true;
  } else if (trDateMatch) {
    dateStr = `${trDateMatch[3]}-${trDateMatch[2].padStart(2, "0")}-${trDateMatch[1].padStart(2, "0")}`;
    hasExplicitDate = true;
  }

  let startHour = 15;
  let startMin = 0;
  let hasExplicitTime = false;
  const timeMatch = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (timeMatch) {
    startHour = parseInt(timeMatch[1], 10);
    startMin = parseInt(timeMatch[2], 10);
    hasExplicitTime = true;
  } else {
    // Support spoken Turkish clock expressions from voice messages
    const spokenHours: Array<{ pattern: RegExp; hour: number }> = [
      { pattern: /\bon\s*sekiz(?:de|e|da)?\b|\bakşam\s*altı(?:da|ya)?\b/i, hour: 18 },
      { pattern: /\bon\s*yedi(?:de|ye)?\b|\bakşam\s*beş(?:te|e)?\b/i, hour: 17 },
      { pattern: /\bon\s*altı(?:da|ya)?\b|\bdörde\b|\bdörtte\b|\bsaat\s*dört\b/i, hour: 16 },
      { pattern: /\bon\s*beş(?:te|e)?\b|\büçe\b|\büçte\b|\bsaat\s*üç\b/i, hour: 15 },
      { pattern: /\bon\s*dört(?:te|e)?\b|\bikiye\b|\bikide\b|\bsaat\s*iki\b/i, hour: 14 },
      { pattern: /\bon\s*üç(?:te|e)?\b|\bbire\b|\bbirde\b|\bsaat\s*bir\b/i, hour: 13 },
      { pattern: /\bon\s*iki(?:de|ye)?\b|\bsaat\s*on\s*iki\b/i, hour: 12 },
      { pattern: /\bon\s*bir(?:de|e)?\b|\bsaat\s*on\s*bir\b/i, hour: 11 },
      { pattern: /\bonda\b|\bona\b|\bsaat\s*on\b/i, hour: 10 },
      { pattern: /\bdokuz(?:da|a)?\b|\bsaat\s*dokuz\b/i, hour: 9 },
      { pattern: /\bsekiz(?:de|e)?\b|\bsaat\s*sekiz\b/i, hour: 8 },
      { pattern: /\byirmi\s*bir(?:de|e)?\b|\bakşam\s*dokuz(?:da|a)?\b/i, hour: 21 },
      { pattern: /\byirmi(?:de|ye)?\b|\bakşam\s*sekiz(?:de|e)?\b/i, hour: 20 },
      { pattern: /\bon\s*dokuz(?:da|a)?\b|\bakşam\s*yedi(?:de|ye)?\b/i, hour: 19 },
    ];
    for (const sh of spokenHours) {
      if (sh.pattern.test(lower)) {
        startHour = sh.hour;
        hasExplicitTime = true;
        break;
      }
    }
    if (hasExplicitTime && /\bbuçuk(?:ta)?\b|\bbucuk(?:ta)?\b|\botuz(?:da)?\b/i.test(lower)) {
      startMin = 30;
    }
  }

  // If user did not say "yarın", and specified a time later today (or said "bu akşam" / "akşam"), keep today's date!
  if (!hasExplicitDate && !isoMatch && !trDateMatch) {
    const isLaterToday =
      hasExplicitTime &&
      (startHour > now.getHours() ||
        (startHour === now.getHours() && startMin >= now.getMinutes()));
    if (isLaterToday || lower.includes("bu akşam") || lower.includes("bu aksam")) {
      dateStr = formatIsoDate(now);
    }
  }

  // Detect relative shift (e.g. "1 saat öne çek", "1 saat ileriye al", "yarım saat öne al", "2 saat ileri al / ertele")
  let shiftMinutes = 0;
  const shiftMatch = lower.match(
    /(\d+|bir|iki|üç|uc|dört|dort|yarım|yarim)\s*(saat|dakika|dk)\s*(öne\s*çek\w*|one\s*cek\w*|öne\s*al\w*|one\s*al\w*|erkene\s*çek\w*|erkene\s*al\w*|geri(?:ye)?\s*çek\w*|geri(?:ye)?\s*al\w*|ileri(?:ye)?\s*al\w*|ileri(?:ye)?\s*çek\w*|sonraya\s*al\w*|ertele\w*)/i
  );
  if (shiftMatch) {
    const rawNum = shiftMatch[1];
    const unit = shiftMatch[2];
    const dir = shiftMatch[3];
    let amount = 1;
    if (rawNum === "yarım" || rawNum === "yarim") amount = 0.5;
    else if (rawNum === "bir") amount = 1;
    else if (rawNum === "iki") amount = 2;
    else if (rawNum === "üç" || rawNum === "uc") amount = 3;
    else if (rawNum === "dört" || rawNum === "dort") amount = 4;
    else if (!isNaN(Number(rawNum))) amount = Number(rawNum);

    const mins =
      unit.startsWith("saat") ? Math.round(amount * 60) : Math.round(amount);
    const isEarlier =
      dir.includes("öne") ||
      dir.includes("one") ||
      dir.includes("erkene") ||
      dir.includes("geri");
    shiftMinutes = isEarlier ? -mins : mins;
  }

  if (hasExplicitTime && shiftMinutes !== 0) {
    const totalMins =
      (startHour * 60 + startMin + shiftMinutes + 24 * 60) % (24 * 60);
    startHour = Math.floor(totalMins / 60);
    startMin = totalMins % 60;
  }

  const startTime = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
  const endHour = (startHour + 1) % 24;
  const endTime = `${String(endHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;

  return {
    dateStr,
    startTime,
    endTime,
    hasExplicitTime,
    hasExplicitDate,
    shiftMinutes,
  };
}

/**
 * Local smart Turkish NLP parser for create, update, and delete on Calendar, Contacts, and Notes.
 */
export function parseCommandLocally(
  rawText: string,
  isVoice: boolean
): {
  intent: "calendar" | "contact" | "note" | "help";
  action: ActionType;
  targetQuery?: string;
  recipientEmail?: string;
  recipientQuery?: string;
  shiftMinutes?: number;
  hasExplicitTime?: boolean;
  hasExplicitDate?: boolean;
  calendar?: Omit<CalendarItem, "id" | "createdTime" | "source">;
  contact?: Omit<ContactItem, "id" | "addedDate">;
  note?: Omit<NoteItem, "id" | "time">;
} {
  if (!rawText || isBotReplyEcho(rawText)) {
    return { intent: "help", action: "create" };
  }
  const text = rawText.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  if (!text) {
    return { intent: "help", action: "create" };
  }
  const lower = text.toLocaleLowerCase("tr-TR");

  const isDelete =
    /\b(sil|kaldır|kaldir|iptal\s*et|iptal)\b/i.test(lower) ||
    lower.startsWith("!rehber sil") ||
    lower.startsWith("!kisi sil") ||
    lower.startsWith("!toplanti sil") ||
    lower.startsWith("!toplantı sil") ||
    lower.startsWith("!gorev sil") ||
    lower.startsWith("!görev sil") ||
    lower.startsWith("!randevu sil");

  const isShare =
    !isDelete &&
    (lower.startsWith("!toplanti gönder") ||
      lower.startsWith("!toplanti gonder") ||
      lower.startsWith("!toplantı gönder") ||
      lower.startsWith("!toplantı gonder") ||
      lower.startsWith("!toplanti davet") ||
      lower.startsWith("!toplantı davet") ||
      lower.startsWith("!toplanti paylaş") ||
      lower.startsWith("!toplantı paylaş") ||
      lower.startsWith("!gorev gönder") ||
      lower.startsWith("!gorev gonder") ||
      lower.startsWith("!görev gönder") ||
      lower.startsWith("!görev gonder") ||
      lower.startsWith("!takvim gönder") ||
      lower.startsWith("!takvim gonder") ||
      lower.startsWith("!takvim paylaş") ||
      lower.startsWith("!etkinlik gönder") ||
      lower.startsWith("!etkinlik gonder") ||
      (!/\b(ekle|oluştur|olustur|ayarla|planla)\b/i.test(lower) &&
        /\b(gönder|gonder|davet\s*et|davetiye\s*gönder|paylaş|paylas|mail\s*at|epostaya\s*gönder|e-postaya\s*gönder)\b/i.test(
          lower
        )));

  const isUpdate =
    !isDelete &&
    !isShare &&
    (lower.includes("güncelle") ||
      lower.includes("guncelle") ||
      lower.includes("değiştir") ||
      lower.includes("degistir") ||
      lower.includes("düzenle") ||
      lower.includes("duzenle") ||
      lower.includes("ertele") ||
      lower.includes("taşı") ||
      lower.includes("tasi") ||
      lower.includes("öne çek") ||
      lower.includes("one cek") ||
      lower.includes("öne al") ||
      lower.includes("one al") ||
      lower.includes("erkene") ||
      lower.includes("ileri al") ||
      lower.includes("ileriye al") ||
      lower.includes("ileri çek") ||
      lower.includes("ileriye çek") ||
      lower.includes("geri al") ||
      lower.includes("geriye al") ||
      lower.includes("sonraya al") ||
      lower.startsWith("!rehber güncelle") ||
      lower.startsWith("!kisi güncelle") ||
      lower.startsWith("!toplanti güncelle") ||
      lower.startsWith("!takvim güncelle") ||
      lower.startsWith("!gorev güncelle") ||
      lower.startsWith("!görev güncelle") ||
      lower.startsWith("!randevu güncelle"));

  const action: ActionType = isDelete
    ? "delete"
    : isShare
      ? "share"
      : isUpdate
        ? "update"
        : "create";

  // 1. CONTACTS / GOOGLE PEOPLE
  if (
    !isShare &&
    (lower.startsWith("!rehber") ||
      lower.startsWith("!kisi") ||
      lower.startsWith("!kişi") ||
      lower.includes("rehbere") ||
      lower.includes("rehberden") ||
      lower.includes("rehberde") ||
      lower.startsWith("rehber ") ||
      lower.includes("kişi ekle") ||
      lower.includes("kişi kaydet") ||
      lower.includes("kişisini ekle") ||
      lower.includes("kişisini kaydet") ||
      lower.includes("kişi sil") ||
      lower.includes("kişiyi sil") ||
      lower.includes("kişisini sil") ||
      lower.includes("kişi güncelle") ||
      lower.includes("numara kaydet") ||
      lower.includes("numarasını kaydet") ||
      lower.includes("numarasını güncelle"))
  ) {
    const clean = text
      .replace(
        /^(!rehbere\s*ekle:?|!rehberden\s*sil:?|!rehber\s*sil:?|!rehber\s*güncelle:?|!rehber\s*guncelle:?|!rehber:?|!kisi\s*sil:?|!kişi\s*sil:?|!kisi\s*güncelle:?|!kişi\s*güncelle:?|!kisi:?|!kişi:?|rehberden\s*sil:?|rehberde\s*güncelle:?|rehbere\s*kaydet:?|rehbere\s*ekle:?|kişi\s*ekle:?|kişi\s*kaydet:?|kişiyi\s*sil:?|kişi\s*sil:?|numara\s*kaydet:?)/i,
        ""
      )
      .trim();

    const emailMatch = clean.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    );
    const email = emailMatch ? emailMatch[0].trim() : "";

    const phoneMatch = clean.match(
      /(\+90[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|0?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\+?\d[\d\s-]{8,14}\d)/
    );
    const phone = phoneMatch ? phoneMatch[0].trim() : "";

    let company = "";
    const companyMatch = clean.match(/(?:şirket|firma|kurum):?\s*([^,]+)$/i);
    if (companyMatch) {
      company = companyMatch[1].replace(/["'“”«»]/g, "").trim();
    }

    let name = clean
      .replace(email, "")
      .replace(phone, "")
      .replace(/(?:şirket|firma|kurum):?\s*([^,]+)$/i, "")
      .replace(/["'“”«»]/g, " ")
      .replace(
        /\b(sil|kaldır|kaldir|güncelle|guncelle|değiştir|degistir|olarak|yeni|numarasını|numarasi|kişisini|kisisini|kişiyi|kisiyi|rehberden|rehberde|rehbere|ekle|kaydet|telefon|tel|numara|numarası|şirket|firma|mail|e-posta|eposta|ad|soyad|isim|lütfen|lutfen):?/gi,
        ""
      )
      .replace(/['’][a-zçğıöşü]+/gi, "")
      .replace(/[,:.!?]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!name || name.length < 2) {
      name = "Yeni Kişi";
    }

    return {
      intent: "contact",
      action,
      targetQuery: name,
      contact: {
        name,
        phone: phone || "+90 530 000 0000",
        email,
        company: company || "WhatsApp Bağlantısı",
        notes: isVoice
          ? "WhatsApp sesli mesaj ile Google Kişiler'de işlendi"
          : "WhatsApp yazılı komut ile Google Kişiler'de işlendi",
      },
    };
  }

  // 2. CALENDAR / MEETING / TASK (CREATE, UPDATE, DELETE, SHARE/SEND)
  const parsedDateInfo = parseDateAndTimeFromTurkishText(text);
  const isExplicitNote =
    lower.startsWith("!not") ||
    lower.includes("not al") ||
    lower.includes("not et") ||
    lower.includes("not defterine");
  if (
    !isExplicitNote &&
    (lower.startsWith("!toplanti") ||
      lower.startsWith("!toplantı") ||
      lower.startsWith("!randevu") ||
      lower.startsWith("!gorev") ||
      lower.startsWith("!görev") ||
      lower.startsWith("!takvim") ||
      lower.startsWith("!etkinlik") ||
      lower.startsWith("!ajanda") ||
      lower.includes("toplantı") ||
      lower.includes("toplanti") ||
      lower.includes("randevu") ||
      lower.includes("etkinlik") ||
      lower.includes("etkinliği") ||
      lower.includes("görev") ||
      lower.includes("gorev") ||
      lower.includes("görüşme") ||
      lower.includes("gorusme") ||
      lower.includes("buluşma") ||
      lower.includes("planla") ||
      lower.includes("takvim") ||
      lower.includes("ajanda") ||
      parsedDateInfo.hasExplicitTime ||
      isShare)
  ) {
    const {
      dateStr,
      startTime,
      endTime,
      hasExplicitTime,
      shiftMinutes,
    } = parsedDateInfo;

    const emailMatches =
      text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const recipientEmail = emailMatches.join(", ");

    let attendee = recipientEmail || "WhatsApp Kullanıcısı";
    const attendeeMatch = text.match(
      /([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+(?:Bey|Hanım|[A-ZÇĞİÖŞÜ][a-zçğıöşü]+))?)\s+ile/
    );
    if (attendeeMatch) {
      attendee = attendeeMatch[1].trim();
    }

    // Check if user specified a recipient person name (e.g. "Ahmet Yılmaz'a gönder" or "rehberdeki Ali Kaya'ya gönder")
    let recipientQuery = "";
    const toPersonMatch = text.match(
      /(?:rehberdeki\s+)?([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)?)['’]?(?:a|e|ya|ye)\s+(?:gönder|gonder|davet|paylaş|paylas|ilet)/i
    );
    if (toPersonMatch) {
      recipientQuery = toPersonMatch[1].trim();
    }

    // If user put the meeting name in quotes (e.g. '16:00 daki "yapmaya cik" toplantısını 1 saat ileriye al'), extract quoted title!
    const quotedTitleMatch = rawText.match(/["“”«»]([^"“”«»]{2,60})["“”«»]/);

    let title = text
      .replace(
        /^(!toplanti\s*gönder:?|!toplanti\s*gonder:?|!toplantı\s*gönder:?|!toplanti\s*davet:?|!toplantı\s*davet:?|!toplanti\s*paylaş:?|!gorev\s*gönder:?|!gorev\s*gonder:?|!görev\s*gönder:?|!takvim\s*gönder:?|!takvim\s*paylaş:?|!etkinlik\s*gönder:?|!toplanti\s*sil:?|!toplantı\s*sil:?|!takvim\s*sil:?|!takvimden\s*sil:?|!randevu\s*sil:?|!gorev\s*sil:?|!görev\s*sil:?|!toplanti\s*iptal:?|!toplantı\s*iptal:?|!toplanti\s*güncelle:?|!toplantı\s*güncelle:?|!takvim\s*güncelle:?|!takvim\s*guncelle:?|!randevu\s*güncelle:?|!gorev\s*güncelle:?|!görev\s*güncelle:?|!takvime\s*ekle:?|!toplanti:?|!toplantı:?|!randevu:?|!gorev:?|!görev:?|!takvim:?|!etkinlik:?|!ajanda:?|toplantı\s*ayarla:?|randevu\s*ekle:?|takvimden\s*sil:?|takvimde\s*güncelle:?)/i,
        ""
      )
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "")
      .replace(
        /\b(yarın|yarin|bugün|bugun|bu\s*akşam|bu\s*aksam|akşam|aksam|sabah|öğleden\s*sonra|ogleden\s*sonra|pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|pazar)\b/gi,
        ""
      )
      .replace(/\bsaat\s*\d{1,2}[:.]\d{2}(\s*['’]?[a-zçğıöşü]+)?/gi, "")
      .replace(/\b\d{1,2}[:.]\d{2}(\s*['’]?[a-zçğıöşü]+)?/gi, "")
      .replace(
        /(\d+|bir|iki|üç|uc|dört|dort|yarım|yarim)\s*(saat|dakika|dk)\s*(öne\s*çek\w*|one\s*cek\w*|öne\s*al\w*|one\s*al\w*|erkene\s*çek\w*|erkene\s*al\w*|geri(?:ye)?\s*çek\w*|geri(?:ye)?\s*al\w*|ileri(?:ye)?\s*al\w*|ileri(?:ye)?\s*çek\w*|sonraya\s*al\w*|ertele\w*)/gi,
        ""
      )
      .replace(
        /\b(ajandama|ajandaya|ajandada|ajandadan|ajanda|takvimime|takvimdeki|takvimden|takvime|takvim|için|icin|gibi|etkinlik|etkinliği|etkinligi|girer\s*misin\w*|girermisin\w*|ekler\s*misin\w*|eklermisin\w*|gir|planla|ayarla|ekle|oluştur|olustur|kaydet|sil|kaldır|kaldir|iptal\s*et|iptal|güncelle|guncelle|değiştir|degistir|ertele|taşı|tasi|öne|one|ileriye|ileri|geriye|geri|sonraya|çekmeni|cekmeni|çek|cek|almanı|al|istiyorum|lütfen|lutfen|gönder|gonder|davet\s*et|davet|paylaş|paylas|adresine|epostasına|e-postasına|epostaya|e-postaya|kullanıcısına|kişisine|rehberdeki|toplantısını|toplantisini|randevusunu|etkinliğini|görevini|gorevini|olan|toplantıyı|toplantiyi|daki|deki|taki|teki)\b/gi,
        ""
      )
      .replace(/["'“”«»]/g, "")
      .replace(/toplantısını/gi, "Toplantısı")
      .replace(/toplantisini/gi, "Toplantısı")
      .replace(/randevusunu/gi, "Randevusu")
      .replace(/etkinliğini/gi, "Etkinliği")
      .replace(/görevini/gi, "Görevi")
      .replace(/[?.,!:]+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (quotedTitleMatch && quotedTitleMatch[1].trim().length >= 2) {
      title = quotedTitleMatch[1].trim();
    }

    if (recipientQuery && title.includes(recipientQuery)) {
      title = title
        .replace(new RegExp(`${recipientQuery}['’]?[aey]+`, "gi"), "")
        .replace(recipientQuery, "")
        .trim();
    }

    if (!title || title.length < 2) {
      title =
        attendee !== "WhatsApp Kullanıcısı" && !attendee.includes("@")
          ? attendee
          : "Planlanan Etkinlik";
    } else {
      title = title.charAt(0).toLocaleUpperCase("tr-TR") + title.slice(1);
    }

    return {
      intent: "calendar",
      action,
      targetQuery: title,
      recipientEmail: recipientEmail || undefined,
      recipientQuery: recipientQuery || undefined,
      shiftMinutes,
      hasExplicitTime,
      hasExplicitDate: parsedDateInfo.hasExplicitDate,
      calendar: {
        title,
        date: dateStr,
        startTime,
        endTime,
        attendee,
        attendeeEmail: recipientEmail || undefined,
        location: lower.includes("ofis")
          ? "Ofis Toplantı Odası"
          : "Google Meet",
      },
    };
  }

  // 3. NOTES
  if (
    lower.startsWith("!not") ||
    lower.includes("not al") ||
    lower.includes("not et") ||
    lower.includes("hatırla")
  ) {
    let noteContent = text
      .replace(/^(!not|not al:?|not et:?|not:?)/i, "")
      .trim();
    if (!noteContent) {
      noteContent = "WhatsApp üzerinden alınan hızlı not.";
    }
    const category =
      lower.includes("sunucu") ||
      lower.includes("ssl") ||
      lower.includes("toplantı")
        ? "İş / Altyapı"
        : lower.includes("market") || lower.includes("kahve")
          ? "Kişisel"
          : "WhatsApp Notu";

    return {
      intent: "note",
      action: "create",
      note: {
        title:
          noteContent.slice(0, 35) + (noteContent.length > 35 ? "..." : ""),
        content: noteContent,
        category,
      },
    };
  }

  return { intent: "help", action: "create" };
}

/**
 * Uses Gemini Flash models (with automatic multi-model fallback) for Turkish audio transcription (STT)
 * and structured NLU intent + action extraction.
 */
async function analyzeWithGemini(params: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  apiKey: string;
  calendarContext?: string;
}): Promise<{
  transcript: string;
  intent: "calendar" | "contact" | "note" | "help";
  action?: ActionType;
  targetQuery?: string;
  recipientEmail?: string;
  recipientQuery?: string;
  calendar?: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    attendee: string;
    attendeeEmail?: string;
    location: string;
  };
  contact?: {
    name: string;
    phone: string;
    email: string;
    company: string;
    notes: string;
  };
  note?: {
    title: string;
    content: string;
    category: string;
  };
} | null> {
  const now = getIstanbulNow();
  const todayIso = formatIsoDate(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const tomorrowIso = formatIsoDate(tomorrowDate);
  const dayNames = [
    "Pazar",
    "Pazartesi",
    "Salı",
    "Çarşamba",
    "Perşembe",
    "Cuma",
    "Cumartesi",
  ];
  const todayDayName = dayNames[now.getDay()];

  const calendarScheduleBlock = params.calendarContext
    ? `\nKULLANICININ GÜNCEL GOOGLE TAKVİM (AJANDA) LİSTESİ (Silme/Güncelleme/Paylaşma işlemlerinde gün, saat ve isim eşleştirmesi için bu gerçek listeyi baz al):\n${params.calendarContext}\n`
    : "";

  const systemInstruction = `Sen Türkçe çalışan çok hassas bir WhatsApp & Google Workspace Asistanısın.
Bugünün tarihi (Europe/Istanbul): ${todayIso} (${todayDayName}). Yarının tarihi: ${tomorrowIso}.${calendarScheduleBlock}
Kullanıcının gönderdiği metni veya Türkçe ses kaydını (Voice Message) çok dikkatli dinle/incele ve tam olarak şu JSON yapısını döndür:
{
  "transcript": "Ses kaydının veya yazılı mesajın tam ve doğru Türkçe metni (Örn: saatleri 16:00 veya 14:30, telefonları 05321112233, e-postaları ali@gmail.com biçiminde yaz)",
  "intent": "calendar" | "contact" | "note" | "help",
  "action": "create" | "update" | "delete" | "share",
  "targetQuery": "Güncellenecek, silinecek veya başka birine gönderilecek toplantının/etkinliğin/kişinin tam adı (Eğer yukarıdaki Güncel Google Takvim Listesinde o gün ve saatte bir etkinlik varsa, o etkinliğin listedeki TAM BAŞLIĞINI yaz!)",
  "recipientEmail": "Etkinlik veya görev bir e-posta adresine gönderilecekse/davet edilecekse alıcı e-posta adresi (Örn: 'ahmet@ornek.com'), yoksa boş string",
  "recipientQuery": "Etkinlik veya görev rehberdeki bir kişiye gönderilecekse o kişinin adı (Örn: 'Ahmet Yılmaz'), yoksa boş string",
  "calendar": {
    "title": "Kısa, temiz ve net Etkinlik/Toplantı/Görev başlığı (Silme veya güncelleme ise Güncel Google Takvim Listesindeki eşleşen etkinliğin tam başlığı; yeni ekleme ise 'ajandama etkinlik girer misin', 'takvime ekle', saati veya alıcı e-postasını başlığa yazma!)",
    "date": "YYYY-MM-DD",
    "startTime": "HH:mm",
    "endTime": "HH:mm",
    "attendee": "Katılımcı adı veya e-posta adresi",
    "attendeeEmail": "Varsa davet gönderilecek e-posta adresi",
    "location": "Google Meet"
  },
  "contact": {
    "name": "Kişinin Adı Soyadı (Örn: Halil, Ali Kaya, Av. Selin Arslan - tırnak işareti koyma)",
    "phone": "Telefon numarası (Örn: 05321112233)",
    "email": "Varsa e-posta adresi, yoksa boş string",
    "company": "Varsa şirket/kurum adı, yoksa boş string",
    "notes": "Kısa açıklama"
  },
  "note": {
    "title": "Not başlığı",
    "content": "Not içeriği",
    "category": "İş / Altyapı | Kişisel | WhatsApp Notu"
  }
}
Kurallar:
1. SİLME ("delete") VE GÜNCELLEME ("update") KESİN KURALI:
   - Mesajda "sil", "siler misin", "iptal", "iptal et", "kaldır", "çıkar", "ajandamdan sil", "takvimden sil" geçiyorsa "action" KESİNLİKLE "delete" olmalıdır! ASLA "create" yapma ve yeni etkinlik ekleme!
   - Kullanıcı silmek veya güncellemek istediği etkinliğin gününü ve saatini söylediğinde (Örn: "Yarın saat 16:00'daki görüşmeyi sil", "Bugün 14:30'daki toplantıyı sil", "Yarın 17:00'deki yapmaya çık etkinliğini sil"), yukarıdaki KULLANICININ GÜNCEL GOOGLE TAKVİM LİSTESİ'ne bak:
     • O tarih ve saatteki etkinliğin tam başlığını "targetQuery" ve "calendar.title" alanına yaz!
     • Kullanıcının söylediği tarihi ("bugün" -> ${todayIso}, "yarın" -> ${tomorrowIso}) "calendar.date" alanına, saati ise "calendar.startTime" alanına (HH:mm formatında) mutlaka yaz!
2. SESLİ KOMUT (VOICE) ÇÖZÜMLEME VE HASSASİYET KURALLARI:
   - Sesli söylenen saatleri 24 saatlik HH:mm formatına çevir (Örn: "iki buçuk / on dört otuz" -> "14:30", "üç buçuk" -> "15:30", "dörtte / on altıda" -> "16:00", "beşte / on yedide" -> "17:00", "akşam sekiz / yirmi" -> "20:00").
   - Kullanıcı sesli konuşurken "Crater", "Lunixi", "Cordella", "Chubb" gibi özel isimleri telaffuz ettiğinde yukarıdaki Güncel Google Takvim Listesindeki gerçek etkinlik isimleriyle eşleştir ("Crater" kelimesini "Jüri" veya "Kriter" olarak yanlış yazma!).
3. TAKVİM / AJANDA ("calendar") vs NOT ("note") AYRIMI:
   - Mesajda "ajanda", "ajandama", "ajandaya", "takvim", "takvime", "etkinlik", "toplantı", "randevu", "görev", "görüşme", "girer misin", "gir" geçiyorsa VEYA belirli bir saat/zaman içeren bir eylem/hatırlatma/arama varsa, intent KESİNLİKLE "calendar" olmalıdır.
4. Mesaj "!rehber", "!kisi", "rehber", "kişi", "numara" içeriyorsa intent KESİNLİKLE "contact" olmalıdır.`;

  const cleanMimeType =
    (params.mimeType || "audio/ogg").split(";")[0].trim() || "audio/ogg";

  const parts: Array<Record<string, unknown>> = [{ text: systemInstruction }];
  if (params.audioBase64) {
    parts.push({
      inlineData: {
        mimeType: cleanMimeType,
        data: params.audioBase64,
      },
    });
  }
  if (params.text) {
    parts.push({ text: `Kullanıcı mesajı: ${params.text}` });
  }

  // Verified 1.2s ultra-fast models with active quota on this API key
  const candidateModels = [
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-flash-lite-latest",
  ];

  for (const modelName of candidateModels) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(params.apiKey)}`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(6500),
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
        }
      );

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) continue;

      const cleanedJson = rawJson
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const obj = JSON.parse(cleanedJson);
      if (
        (obj.intent === "contact" || obj.intent === "rehber") &&
        !obj.contact &&
        (obj.name || obj.phone || obj.targetQuery)
      ) {
        obj.intent = "contact";
        obj.contact = {
          name: obj.name || obj.targetQuery || "Kişi",
          phone: obj.phone || "",
          email: obj.email || "",
          company: obj.company || "",
          notes: obj.notes || "",
        };
      }
      return obj;
    } catch {
      // Try next fallback model
      continue;
    }
  }

  return null;
}

export async function resolveGoogleAccessToken(
  creds: AssistantCredentials
): Promise<string | null> {
  loadFreshEnv();
  if (creds.googleAccessToken) {
    return creds.googleAccessToken;
  }

  const clientId = creds.googleClientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    creds.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken =
    creds.googleRefreshToken || process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

// ============================================================================
// GOOGLE CALENDAR API v3: CREATE, FIND, UPDATE, DELETE
// ============================================================================

function normalizeTr(str: string): string {
  return str
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

const recentCalendarEventsMap = new Map<string, string>();
const recentCreatedSignatures = new Map<string, number>();

function isRecentlyCreatedSignature(sig: string, windowMs = 45000): boolean {
  const now = Date.now();
  for (const [k, ts] of recentCreatedSignatures.entries()) {
    if (now - ts > windowMs) recentCreatedSignatures.delete(k);
  }
  const prev = recentCreatedSignatures.get(sig);
  if (prev && now - prev < windowMs) {
    return true;
  }
  recentCreatedSignatures.set(sig, now);
  return false;
}

const GENERIC_CALENDAR_STOPWORDS = new Set([
  "toplanti",
  "toplantisi",
  "toplantisini",
  "toplantilar",
  "etkinlik",
  "etkinligi",
  "etkinligini",
  "randevu",
  "randevusu",
  "randevusunu",
  "gorusme",
  "gorusmesi",
  "gorusmesini",
  "gorev",
  "gorevi",
  "gorevini",
  "ajanda",
  "ajandadaki",
  "ajandamdan",
  "ajandadan",
  "takvim",
  "takvimdeki",
  "takvimden",
  "takvimimden",
  "bugun",
  "bugunku",
  "yarin",
  "yarinki",
  "saat",
  "saatteki",
  "saatindeki",
  "olan",
  "deki",
  "daki",
  "teki",
  "taki",
  "sil",
  "siler",
  "silin",
  "iptal",
  "kaldir",
  "cikar",
  "misin",
  "musun",
  "lutfen",
]);

function extractDistinctCalendarWords(query: string): string[] {
  const norm = normalizeTr(query)
    .replace(/\b\d{1,2}[:.]\d{2}\b/g, " ")
    .replace(/\b\d+\b/g, " ");
  return norm
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !GENERIC_CALENDAR_STOPWORDS.has(w));
}

async function getUpcomingCalendarSummaryForPrompt(
  accessToken: string
): Promise<string> {
  try {
    const minDate = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const maxDate = new Date(Date.now() + 14 * 86400 * 1000).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(minDate)}&timeMax=${encodeURIComponent(maxDate)}&singleEvents=true&orderBy=startTime&maxResults=40`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return "";
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const lines: string[] = [];
    for (const item of items) {
      if (item.status === "cancelled") continue;
      const rawStart = String(item.start?.dateTime || item.start?.date || "");
      const m = rawStart.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
      const datePart = m ? m[1] : rawStart;
      const timePart = m && m[2] ? m[2] : "Tüm Gün";
      const title = String(item.summary || "İsimsiz Etkinlik").trim();
      lines.push(`- [${datePart} ${timePart}] "${title}"`);
    }
    return lines.join("\n");
  } catch {
    return "";
  }
}

interface CalendarSearchOptions {
  date?: string;
  startTime?: string;
  hasExplicitDate?: boolean;
  hasExplicitTime?: boolean;
}

async function findGoogleCalendarEvent(
  accessToken: string,
  query: string,
  options?: CalendarSearchOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  try {
    const cleanQuery = query.trim();
    const distinctWords = extractDistinctCalendarWords(cleanQuery);
    const distinctPhrase = distinctWords.join(" ");

    const scoreEventItem = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      item: any,
      requireDateMatch = false
    ): number => {
      if (!item || item.status === "cancelled") return -1;
      const sumRaw = String(item.summary || "").trim();
      const sumNorm = normalizeTr(sumRaw);
      const sumDistinct = extractDistinctCalendarWords(sumRaw);
      const startDt = String(item.start?.dateTime || item.start?.date || "");
      const dtMatch = startDt.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/);
      const itemDate = dtMatch ? dtMatch[1] : "";
      const itemTime =
        dtMatch && dtMatch[2] && dtMatch[3] ? `${dtMatch[2]}:${dtMatch[3]}` : "";

      if (requireDateMatch && options?.date && itemDate !== options.date) {
        return -1;
      }

      let score = 0;

      // 1. Date match bonus
      if (options?.date && itemDate === options.date) {
        score += options.hasExplicitDate ? 100 : 40;
      } else if (options?.hasExplicitDate && options?.date && itemDate !== options.date) {
        score -= 80;
      }

      // 2. Time match bonus (exact or within ±30 mins)
      if (options?.hasExplicitTime && options?.startTime && itemTime) {
        const [qH, qM] = options.startTime.split(":").map(Number);
        const [iH, iM] = itemTime.split(":").map(Number);
        const diffMins = Math.abs(qH * 60 + qM - (iH * 60 + iM));
        if (diffMins === 0) {
          score += 180;
        } else if (diffMins <= 30) {
          score += 110;
        } else if (options.hasExplicitDate && itemDate === options.date) {
          score -= 40;
        }
      }

      // 3. Distinctive title words match
      if (distinctWords.length > 0) {
        if (distinctPhrase && sumNorm.includes(distinctPhrase)) {
          score += 140;
        } else {
          let matchedCount = 0;
          for (const w of distinctWords) {
            if (
              sumNorm.includes(w) ||
              sumDistinct.some((sw) => sw.includes(w) || w.includes(sw))
            ) {
              matchedCount++;
            }
          }
          score += matchedCount * 65;
          if (matchedCount === 0 && !(options?.hasExplicitTime && itemTime === options?.startTime && itemDate === options?.date)) {
            score -= 60;
          }
        }
      }

      return score;
    };

    // STEP 1: If a target date is available, search that specific day first!
    if (options?.date) {
      const dayMin = `${options.date}T00:00:00+03:00`;
      const dayMax = `${options.date}T23:59:59+03:00`;
      const dayUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(dayMin)}&timeMax=${encodeURIComponent(dayMax)}&singleEvents=true&orderBy=startTime&maxResults=50`;
      const dayRes = await fetch(dayUrl, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (dayRes.ok) {
        const dayData = await dayRes.json();
        const dayItems = Array.isArray(dayData.items)
          ? dayData.items.filter(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (it: any) => it.status !== "cancelled"
            )
          : [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let bestDayItem: any = null;
        let bestDayScore = 0;

        for (const item of dayItems) {
          const sc = scoreEventItem(item, true);
          if (sc > bestDayScore) {
            bestDayScore = sc;
            bestDayItem = item;
          }
        }

        // Accept if it matched time or distinctive words on that date, or if user gave only date + generic "toplantıyı sil" and there's only 1 event on that day
        if (bestDayItem && bestDayScore >= 90) {
          return bestDayItem;
        }
        if (
          options.hasExplicitDate &&
          !options.hasExplicitTime &&
          distinctWords.length === 0 &&
          dayItems.length === 1
        ) {
          return dayItems[0];
        }
      }
    }

    // STEP 2: Search active window (from 2 days ago up to 60 days ahead — NEVER search 2010!)
    const minDate = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    const maxDate = new Date(Date.now() + 60 * 86400 * 1000).toISOString();
    const listUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(minDate)}&timeMax=${encodeURIComponent(maxDate)}&singleEvents=true&orderBy=startTime&maxResults=250`;
    const listRes = await fetch(listUrl, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      const items = Array.isArray(listData.items) ? listData.items : [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bestItem: any = null;
      let bestScore = 0;

      for (const item of items) {
        const sc = scoreEventItem(item, false);
        if (sc > bestScore) {
          bestScore = sc;
          bestItem = item;
        }
      }

      // Require at least 60 points (either a distinctive title word match OR date+time match)
      if (bestItem && bestScore >= 60) {
        return bestItem;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveRecipientEmails(
  accessToken: string | null,
  rawEmailStr?: string,
  recipientQuery?: string
): Promise<{ emails: string[]; resolvedContactName?: string }> {
  const emailList: string[] = [];
  if (rawEmailStr) {
    const matches =
      rawEmailStr.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ||
      [];
    for (const m of matches) {
      const lower = m.toLowerCase();
      if (!emailList.includes(lower)) emailList.push(lower);
    }
  }

  let resolvedContactName: string | undefined;
  if (emailList.length === 0 && recipientQuery && accessToken) {
    const contactPerson = await findGooglePersonContact(
      accessToken,
      recipientQuery
    );
    const contactEmail = contactPerson?.emailAddresses?.[0]?.value;
    if (contactEmail) {
      emailList.push(String(contactEmail).toLowerCase());
      resolvedContactName =
        contactPerson?.names?.[0]?.displayName || recipientQuery;
    }
  }

  return { emails: emailList, resolvedContactName };
}

async function createGoogleCalendarEvent(
  accessToken: string,
  evt: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    attendee: string;
    attendeeEmail?: string;
    location: string;
  },
  recipientQuery?: string
): Promise<{
  htmlLink?: string;
  ok: boolean;
  duplicate?: boolean;
  invitedEmails?: string[];
  error?: string;
}> {
  try {
    // 0. Never insert a bot reply echo into Google Calendar
    if (isBotReplyEcho(evt.title)) {
      return { ok: false, duplicate: true, error: "Bot mesajı atlandı" };
    }

    const startDateTime = `${evt.date}T${evt.startTime}:00+03:00`;
    const endDateTime = `${evt.date}T${evt.endTime}:00+03:00`;
    const normTitle = normalizeTr(evt.title);

    // 1. Distributed Deduplication Check via Google Calendar API (prevents Local + Cloud double insert)
    try {
      const dayMin = `${evt.date}T00:00:00+03:00`;
      const dayMax = `${evt.date}T23:59:59+03:00`;
      const checkUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(dayMin)}&timeMax=${encodeURIComponent(dayMax)}&singleEvents=true`;
      const checkRes = await fetch(checkUrl, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        const items = Array.isArray(checkData.items) ? checkData.items : [];
        const nowMs = Date.now();
        for (const item of items) {
          if (item.status === "cancelled") continue;
          const itemStart = String(item.start?.dateTime || "");
          const itemNorm = normalizeTr(String(item.summary || ""));
          const createdMs = item.created ? new Date(item.created).getTime() : 0;
          const isFromBot = String(item.description || "").includes("WhatsApp");

          const sameTimeSlot = itemStart.startsWith(`${evt.date}T${evt.startTime}`);
          const similarTitle =
            itemNorm === normTitle ||
            (itemNorm.length >= 3 &&
              normTitle.length >= 3 &&
              (itemNorm.includes(normTitle) || normTitle.includes(itemNorm)));

          // If an event in the same time slot with similar title already exists, or was created by the bot in the last 60s
          if (
            (sameTimeSlot && similarTitle) ||
            (isFromBot &&
              createdMs > 0 &&
              nowMs - createdMs < 60000 &&
              (sameTimeSlot || similarTitle))
          ) {
            return {
              ok: true,
              duplicate: true,
              htmlLink: item.htmlLink,
            };
          }
        }
      }
    } catch {
      // Ignore check error and proceed
    }

    const { emails } = await resolveRecipientEmails(
      accessToken,
      evt.attendeeEmail || evt.attendee,
      recipientQuery ||
        (evt.attendee !== "WhatsApp Kullanıcısı" && !evt.attendee.includes("@")
          ? evt.attendee
          : undefined)
    );

    const sendUpdatesParam = emails.length > 0 ? "?sendUpdates=all" : "";

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events${sendUpdatesParam}`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: evt.title,
          location: evt.location,
          description: `Katılımcı: ${evt.attendee}\nWhatsApp ⇄ Google Workspace Asistanı üzerinden oluşturuldu.`,
          start: {
            dateTime: startDateTime,
            timeZone: "Europe/Istanbul",
          },
          end: {
            dateTime: endDateTime,
            timeZone: "Europe/Istanbul",
          },
          ...(emails.length > 0
            ? {
                attendees: emails.map((email) => ({ email })),
                guestsCanSeeOtherGuests: true,
              }
            : {}),
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message || "Google Calendar API hatası",
      };
    }

    if (data?.id) {
      recentCalendarEventsMap.set(normalizeTr(evt.title), data.id);
    }

    return {
      ok: true,
      htmlLink: data.htmlLink,
      invitedEmails: emails.length > 0 ? emails : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

async function shareGoogleCalendarEvent(
  accessToken: string,
  targetQuery: string,
  rawEmailStr?: string,
  recipientQuery?: string,
  searchOptions?: CalendarSearchOptions
): Promise<{
  ok: boolean;
  htmlLink?: string;
  matchedTitle?: string;
  invitedEmails?: string[];
  resolvedContactName?: string;
  error?: string;
}> {
  try {
    const { emails, resolvedContactName } = await resolveRecipientEmails(
      accessToken,
      rawEmailStr,
      recipientQuery
    );

    if (emails.length === 0) {
      return {
        ok: false,
        error: recipientQuery
          ? `"${recipientQuery}" adlı kişinin Google Rehber'de kayıtlı e-posta adresi bulunamadı. Lütfen doğrudan e-posta adresi yazın (Örn: ali@gmail.com).`
          : "Gönderilecek alıcı e-posta adresi belirtilmedi.",
      };
    }

    const existing = await findGoogleCalendarEvent(
      accessToken,
      targetQuery,
      searchOptions
    );
    if (!existing || !existing.id) {
      return {
        ok: false,
        error: `"${targetQuery}" ile eşleşen bir Google Takvim etkinliği/görevi bulunamadı.`,
      };
    }

    const existingAttendees = Array.isArray(existing.attendees)
      ? existing.attendees
      : [];
    const existingEmailSet = new Set(
      existingAttendees
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((a: any) => String(a.email || "").toLowerCase())
        .filter(Boolean)
    );

    const mergedAttendees = [...existingAttendees];
    for (const email of emails) {
      if (!existingEmailSet.has(email.toLowerCase())) {
        mergedAttendees.push({ email });
      }
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existing.id)}?sendUpdates=all`,
      {
        method: "PATCH",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attendees: mergedAttendees,
          guestsCanSeeOtherGuests: true,
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message || "Etkinlik/görev daveti gönderilemedi",
      };
    }

    return {
      ok: true,
      htmlLink: data.htmlLink,
      matchedTitle: existing.summary || targetQuery,
      invitedEmails: emails,
      resolvedContactName,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

async function updateGoogleCalendarEvent(
  accessToken: string,
  targetQuery: string,
  evt: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    attendee: string;
    location: string;
  },
  shiftMinutes = 0,
  hasExplicitTime = true,
  hasExplicitDate = false
): Promise<{
  ok: boolean;
  htmlLink?: string;
  matchedTitle?: string;
  finalDate?: string;
  finalStartTime?: string;
  finalEndTime?: string;
  error?: string;
}> {
  try {
    const existing = await findGoogleCalendarEvent(
      accessToken,
      targetQuery || evt.title,
      {
        date: evt.date,
        startTime: evt.startTime,
        hasExplicitDate,
        hasExplicitTime: shiftMinutes !== 0 ? false : hasExplicitTime,
      }
    );
    if (!existing || !existing.id) {
      return {
        ok: false,
        error: `"${targetQuery || evt.title}" ile eşleşen bir Google Takvim etkinliği bulunamadı.`,
      };
    }

    let finalDate = evt.date;
    let finalStartTime = evt.startTime;
    let finalEndTime = evt.endTime;

    // If user asked for a relative shift without stating the base clock time, shift existing.start.dateTime
    if (shiftMinutes !== 0 && !hasExplicitTime && existing.start?.dateTime) {
      const dtMatch = String(existing.start.dateTime).match(
        /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/
      );
      if (dtMatch) {
        finalDate = dtMatch[1];
        const baseH = parseInt(dtMatch[2], 10);
        const baseM = parseInt(dtMatch[3], 10);
        const totalMins =
          (baseH * 60 + baseM + shiftMinutes + 24 * 60) % (24 * 60);
        const newH = Math.floor(totalMins / 60);
        const newM = totalMins % 60;
        finalStartTime = `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
        finalEndTime = `${String((newH + 1) % 24).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
      }
    }

    const startDateTime = `${finalDate}T${finalStartTime}:00+03:00`;
    const endDateTime = `${finalDate}T${finalEndTime}:00+03:00`;
    const newSummary = String(existing.summary || evt.title)
      .replace(/Toplantısını$/i, "Toplantısı")
      .replace(/Randevusunu$/i, "Randevusu");

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existing.id)}`,
      {
        method: "PATCH",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: newSummary,
          location: evt.location || existing.location || "Google Meet",
          start: {
            dateTime: startDateTime,
            timeZone: "Europe/Istanbul",
          },
          end: {
            dateTime: endDateTime,
            timeZone: "Europe/Istanbul",
          },
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message || "Takvim güncellenemedi",
      };
    }

    return {
      ok: true,
      htmlLink: data.htmlLink,
      matchedTitle: existing.summary || newSummary,
      finalDate,
      finalStartTime,
      finalEndTime,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

async function deleteGoogleCalendarEvent(
  accessToken: string,
  targetQuery: string,
  searchOptions?: CalendarSearchOptions
): Promise<{
  ok: boolean;
  deletedTitle?: string;
  deletedDate?: string;
  deletedTime?: string;
  error?: string;
}> {
  try {
    const existing = await findGoogleCalendarEvent(
      accessToken,
      targetQuery,
      searchOptions
    );
    if (!existing || !existing.id) {
      const dateHint =
        searchOptions?.hasExplicitDate && searchOptions?.date
          ? ` (${searchOptions.date}${searchOptions.hasExplicitTime && searchOptions.startTime ? ` ${searchOptions.startTime}` : ""})`
          : "";
      return {
        ok: false,
        error: `"${targetQuery}"${dateHint} ile eşleşen aktif bir Google Takvim etkinliği bulunamadı.`,
      };
    }

    const startRaw = String(existing.start?.dateTime || existing.start?.date || "");
    const dtM = startRaw.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
    const deletedDate = dtM ? dtM[1] : undefined;
    const deletedTime = dtM && dtM[2] ? dtM[2] : undefined;

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existing.id)}`,
      {
        method: "DELETE",
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok && res.status !== 204) {
      return { ok: false, error: `Silme hatası (HTTP ${res.status})` };
    }

    return {
      ok: true,
      deletedTitle: existing.summary || targetQuery,
      deletedDate,
      deletedTime,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

// ============================================================================
// GOOGLE PEOPLE (CONTACTS) API v1: CREATE, FIND, UPDATE, DELETE
// ============================================================================

// Cache recently created/updated resourceNames for instant 0-latency lookup
const recentContactsResourceMap = new Map<string, string>();

async function findGooglePersonContact(
  accessToken: string,
  query: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  try {
    const qLower = query.trim().toLocaleLowerCase("tr-TR");
    const qDigits = query.replace(/\D/g, "");

    // 1. Check in-memory recent resourceName map first (handles 0ms immediate updates/deletes)
    for (const [cachedName, resourceName] of recentContactsResourceMap.entries()) {
      if (
        cachedName.includes(qLower) ||
        qLower.includes(cachedName)
      ) {
        const directRes = await fetch(
          `https://people.googleapis.com/v1/${resourceName}?personFields=names,phoneNumbers,emailAddresses,organizations,biographies,metadata`,
          {
            cache: "no-store",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (directRes.ok) {
          const directPerson = await directRes.json();
          if (directPerson && directPerson.resourceName) {
            return directPerson;
          }
        }
      }
    }

    // 2. List connections sorted by LAST_MODIFIED_DESCENDING (up to 1000 contacts)
    const res = await fetch(
      "https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,emailAddresses,organizations,biographies,metadata&sortOrder=LAST_MODIFIED_DESCENDING&pageSize=1000",
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (res.ok) {
      const data = await res.json();
      const connections = Array.isArray(data.connections) ? data.connections : [];

      for (const person of connections) {
        const displayName = String(
          person.names?.[0]?.displayName || ""
        ).toLocaleLowerCase("tr-TR");
        const givenName = String(
          person.names?.[0]?.givenName || ""
        ).toLocaleLowerCase("tr-TR");
        const phoneVal = String(person.phoneNumbers?.[0]?.value || "").replace(
          /\D/g,
          ""
        );

        if (
          (qLower &&
            (displayName.includes(qLower) ||
              qLower.includes(displayName) ||
              givenName.includes(qLower))) ||
          (qDigits.length >= 7 && phoneVal.includes(qDigits))
        ) {
          return person;
        }
      }
    }

    // 3. Fallback: People API searchContacts endpoint
    const searchRes = await fetch(
      `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(query.trim())}&readMask=names,phoneNumbers,emailAddresses,organizations,biographies,metadata`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const firstMatch = searchData?.results?.[0]?.person;
      if (firstMatch && firstMatch.resourceName) {
        return firstMatch;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function createGooglePersonContact(
  accessToken: string,
  cnt: {
    name: string;
    phone: string;
    email: string;
    company: string;
    notes: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const nameParts = cnt.name.trim().split(/\s+/);
    const givenName =
      nameParts.length > 1
        ? nameParts.slice(0, -1).join(" ")
        : nameParts[0] || "Yeni Kişi";
    const familyName =
      nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

    const res = await fetch(
      "https://people.googleapis.com/v1/people:createContact?personFields=names,phoneNumbers,emailAddresses,organizations,biographies",
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          names: [{ givenName, familyName }],
          phoneNumbers: cnt.phone ? [{ value: cnt.phone, type: "mobile" }] : [],
          emailAddresses: cnt.email
            ? [{ value: cnt.email, type: "work" }]
            : [],
          organizations: cnt.company ? [{ name: cnt.company }] : [],
          biographies: cnt.notes ? [{ value: cnt.notes }] : [],
        }),
      }
    );

    if (!res.ok) {
      const rawText = await res.text();
      return {
        ok: false,
        error: `HTTP ${res.status}: ${rawText.slice(0, 200)}`,
      };
    }

    const createdPerson = await res.json();
    if (createdPerson?.resourceName) {
      recentContactsResourceMap.set(
        cnt.name.trim().toLocaleLowerCase("tr-TR"),
        createdPerson.resourceName
      );
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

async function updateGooglePersonContact(
  accessToken: string,
  targetQuery: string,
  cnt: {
    name: string;
    phone: string;
    email: string;
    company: string;
    notes: string;
  }
): Promise<{ ok: boolean; matchedName?: string; error?: string }> {
  try {
    const existing = await findGooglePersonContact(
      accessToken,
      targetQuery || cnt.name
    );
    if (!existing || !existing.resourceName) {
      return {
        ok: false,
        error: `"${targetQuery || cnt.name}" adlı kişi Google Rehber'de bulunamadı.`,
      };
    }

    const finalName =
      cnt.name && cnt.name !== "Yeni Kişi"
        ? cnt.name
        : existing.names?.[0]?.displayName || targetQuery;
    const nameParts = finalName.trim().split(/\s+/);
    const givenName =
      nameParts.length > 1
        ? nameParts.slice(0, -1).join(" ")
        : nameParts[0] || finalName;
    const familyName =
      nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

    const finalPhone =
      cnt.phone && cnt.phone !== "+90 530 000 0000"
        ? cnt.phone
        : existing.phoneNumbers?.[0]?.value || "";
    const finalEmail = cnt.email || existing.emailAddresses?.[0]?.value || "";
    const finalCompany =
      cnt.company && cnt.company !== "WhatsApp Bağlantısı"
        ? cnt.company
        : existing.organizations?.[0]?.name || "";

    const res = await fetch(
      `https://people.googleapis.com/v1/${existing.resourceName}:updateContact?updatePersonFields=names,phoneNumbers,emailAddresses,organizations,biographies&personFields=names,phoneNumbers,emailAddresses,organizations,biographies`,
      {
        method: "PATCH",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          etag: existing.etag,
          names: [{ givenName, familyName }],
          phoneNumbers: finalPhone
            ? [{ value: finalPhone, type: "mobile" }]
            : [],
          emailAddresses: finalEmail
            ? [{ value: finalEmail, type: "work" }]
            : [],
          organizations: finalCompany ? [{ name: finalCompany }] : [],
          biographies: cnt.notes ? [{ value: cnt.notes }] : [],
        }),
      }
    );

    if (!res.ok) {
      const rawText = await res.text();
      return {
        ok: false,
        error: `HTTP ${res.status}: ${rawText.slice(0, 200)}`,
      };
    }

    return {
      ok: true,
      matchedName: existing.names?.[0]?.displayName || finalName,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

async function deleteGooglePersonContact(
  accessToken: string,
  targetQuery: string
): Promise<{ ok: boolean; deletedName?: string; error?: string }> {
  try {
    const existing = await findGooglePersonContact(accessToken, targetQuery);
    if (!existing || !existing.resourceName) {
      return {
        ok: false,
        error: `"${targetQuery}" adlı kişi Google Rehber'de bulunamadı.`,
      };
    }

    const res = await fetch(
      `https://people.googleapis.com/v1/${existing.resourceName}:deleteContact`,
      {
        method: "DELETE",
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      const rawText = await res.text();
      return {
        ok: false,
        error: `HTTP ${res.status}: ${rawText.slice(0, 200)}`,
      };
    }

    return {
      ok: true,
      deletedName: existing.names?.[0]?.displayName || targetQuery,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

// ============================================================================
// MAIN ASSISTANT ENGINE ENTRYPOINT
// ============================================================================

export async function processAssistantInput(params: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  isVoice?: boolean;
  credentials?: AssistantCredentials;
}): Promise<AssistantProcessResult> {
  loadFreshEnv();

  // 0. Never process bot reply echoes as user commands
  if (params.text && isBotReplyEcho(params.text)) {
    return {
      transcript: "",
      intent: "help",
      action: "create",
      replyText: "",
      usedGemini: false,
      syncedToGoogle: false,
      duplicate: true,
    };
  }

  const creds = params.credentials || {};
  const geminiKey = creds.geminiApiKey || process.env.GEMINI_API_KEY;
  const isVoice = Boolean(params.isVoice || params.audioBase64);
  const accessToken = await resolveGoogleAccessToken(creds);
  const calendarContext = accessToken
    ? await getUpcomingCalendarSummaryForPrompt(accessToken)
    : "";

  let usedGemini = false;
  let transcript = params.text?.trim() || "";
  let parsed: {
    intent: "calendar" | "contact" | "note" | "help";
    action: ActionType;
    targetQuery?: string;
    recipientEmail?: string;
    recipientQuery?: string;
    calendar?: Omit<CalendarItem, "id" | "createdTime" | "source">;
    contact?: Omit<ContactItem, "id" | "addedDate">;
    note?: Omit<NoteItem, "id" | "time">;
  } | null = null;

  if (
    geminiKey &&
    !geminiKey.includes("BURAYA_") &&
    (params.text || params.audioBase64)
  ) {
    try {
      const geminiResult = await analyzeWithGemini({
        text: params.text,
        audioBase64: params.audioBase64,
        mimeType: params.mimeType,
        apiKey: geminiKey,
        calendarContext,
      });

      if (geminiResult) {
        usedGemini = true;
        transcript = geminiResult.transcript || transcript;
        parsed = {
          intent: geminiResult.intent || "help",
          action: geminiResult.action || "create",
          targetQuery: geminiResult.targetQuery,
          recipientEmail: geminiResult.recipientEmail,
          recipientQuery: geminiResult.recipientQuery,
          calendar: geminiResult.calendar,
          contact: geminiResult.contact,
          note: geminiResult.note,
        };
      }
    } catch {
      // Fallback to local parser
    }
  }

  if (isBotReplyEcho(transcript)) {
    return {
      transcript: "",
      intent: "help",
      action: "create",
      replyText: "",
      usedGemini: false,
      syncedToGoogle: false,
      duplicate: true,
    };
  }

  if (!transcript) {
    if (!geminiKey) {
      return {
        transcript: "",
        intent: "help",
        action: "create",
        usedGemini: false,
        syncedToGoogle: false,
        duplicate: true,
        replyText: "",
      };
    }
    return {
      transcript: "",
      intent: "help",
      action: "create",
      usedGemini: false,
      syncedToGoogle: false,
      replyText: params.audioBase64
        ? `🎙️ *[Sesli Mesaj Çözümlendi]* Sesli mesajınız tam olarak duyulamadı, lütfen tekrar deneyin.`
        : "",
    };
  }

  const localParsed = parseCommandLocally(transcript, isVoice);

  if (
    !parsed ||
    parsed.intent === "help" ||
    (parsed.intent === "calendar" &&
      parsed.action === "create" &&
      !parsed.calendar?.title) ||
    (parsed.intent === "contact" &&
      parsed.action === "create" &&
      !parsed.contact?.name) ||
    (parsed.intent === "note" && !parsed.note?.content)
  ) {
    parsed = localParsed;
  }

  // Hard guard: if user's transcript explicitly asks to delete/cancel, never allow "create"
  const normTranscriptForAction = normalizeTr(transcript);
  const hasExplicitDeleteWord =
    /\b(sil|siler|silin|iptal|kaldir|cikar)\b/.test(normTranscriptForAction);

  const action: ActionType = hasExplicitDeleteWord
    ? "delete"
    : localParsed.action !== "create"
      ? localParsed.action
      : parsed.action || "create";
  const rawTargetQuery =
    parsed.targetQuery ||
    localParsed.targetQuery ||
    parsed.calendar?.title ||
    parsed.contact?.name ||
    "";
  const targetQuery = rawTargetQuery.replace(/["'“”«»]/g, "").trim();
  const recipientEmail =
    parsed.recipientEmail ||
    localParsed.recipientEmail ||
    parsed.calendar?.attendeeEmail;
  const recipientQuery = parsed.recipientQuery || localParsed.recipientQuery;

  let syncedToGoogle = false;
  let googleSyncError: string | undefined;

  // ==================== 1. CALENDAR (CREATE / UPDATE / DELETE / SHARE) ====================
  if (parsed.intent === "calendar") {
    const calData = parsed.calendar ||
      localParsed.calendar || {
        title: targetQuery || "Toplantı",
        date: formatIsoDate(getIstanbulNow()),
        startTime: "15:00",
        endTime: "16:00",
        attendee: recipientEmail || "WhatsApp Kullanıcısı",
        attendeeEmail: recipientEmail,
        location: "Google Meet",
      };

    // Prefer explicit date/time extracted from transcript if Gemini didn't set it accurately
    if (localParsed.hasExplicitDate && localParsed.calendar?.date) {
      calData.date = localParsed.calendar.date;
    }
    if (localParsed.hasExplicitTime && localParsed.calendar?.startTime) {
      calData.startTime = localParsed.calendar.startTime;
      calData.endTime = localParsed.calendar.endTime;
    }

    const searchOptions: CalendarSearchOptions = {
      date: calData.date,
      startTime: calData.startTime,
      hasExplicitDate: Boolean(localParsed.hasExplicitDate || parsed.calendar?.date),
      hasExplicitTime: Boolean(localParsed.hasExplicitTime),
    };

    if (recipientEmail && !calData.attendeeEmail) {
      calData.attendeeEmail = recipientEmail;
    }

    if (action === "share") {
      let matchedTitle = targetQuery || calData.title;
      let invitedEmails: string[] | undefined;
      let resolvedContactName: string | undefined;
      let htmlLink: string | undefined;

      if (accessToken) {
        const shareRes = await shareGoogleCalendarEvent(
          accessToken,
          matchedTitle,
          recipientEmail || transcript,
          recipientQuery,
          searchOptions
        );
        syncedToGoogle = shareRes.ok;
        htmlLink = shareRes.htmlLink;
        if (shareRes.matchedTitle) matchedTitle = shareRes.matchedTitle;
        invitedEmails = shareRes.invitedEmails;
        resolvedContactName = shareRes.resolvedContactName;
        googleSyncError = shareRes.error;
      }

      const recipientDisplay = invitedEmails?.length
        ? resolvedContactName
          ? `${resolvedContactName} (${invitedEmails.join(", ")})`
          : invitedEmails.join(", ")
        : recipientEmail || recipientQuery || "Alıcı";

      const replyText =
        `📨 *Google Takvim Etkinliği / Görevi Gönderildi!*\n\n` +
        `📌 *Etkinlik / Görev:* ${matchedTitle}\n` +
        `✉️ *Gönderilen Alıcı:* ${recipientDisplay}` +
        (syncedToGoogle
          ? `\n✅ *Google Takvim üzerinden karşı tarafa resmi e-posta ve takvim daveti gönderildi!*`
          : googleSyncError
            ? `\n⚠️ _${googleSyncError}_`
            : "");

      return {
        transcript,
        intent: "calendar",
        action: "share",
        targetQuery: matchedTitle,
        replyText,
        usedGemini,
        syncedToGoogle,
        googleSyncError,
        calendarEvent: {
          id: "evt-" + Date.now(),
          title: matchedTitle,
          date: calData.date,
          startTime: calData.startTime,
          endTime: calData.endTime,
          attendee: recipientDisplay,
          attendeeEmail: invitedEmails?.join(", ") || recipientEmail,
          location: calData.location || "Google Meet",
          source: isVoice
            ? "🎙️ WhatsApp Sesli Davet"
            : "💬 WhatsApp E-posta Daveti",
          createdTime: "Gönderildi",
          htmlLink,
          syncedWithGoogle: syncedToGoogle,
        },
      };
    }

    if (action === "delete") {
      let deletedTitle = targetQuery || calData.title;
      let deletedDate: string | undefined;
      let deletedTime: string | undefined;
      if (accessToken) {
        const delRes = await deleteGoogleCalendarEvent(
          accessToken,
          deletedTitle,
          searchOptions
        );
        syncedToGoogle = delRes.ok;
        if (delRes.deletedTitle) deletedTitle = delRes.deletedTitle;
        deletedDate = delRes.deletedDate;
        deletedTime = delRes.deletedTime;
        googleSyncError = delRes.error;
      }

      const replyText = syncedToGoogle
        ? (isVoice
            ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
            : "") +
          `🗑️ *Google Takvim Etkinliği Silindi!*\n\n` +
          `📌 *İptal Edilen:* ${deletedTitle}` +
          (deletedDate
            ? `\n📅 *Tarih / Saat:* ${deletedDate}${deletedTime ? ` | ${deletedTime}` : ""}`
            : "") +
          `\n✅ *Gerçek Google Takvim'inizden kaldırıldı!*`
        : (isVoice
            ? `🎙️ *Sesli Komut Algılandı:* _"${transcript}"_\n\n`
            : "") +
          `⚠️ *Google Takvim Etkinliği Bulunamadı!*\n\n` +
          `_${googleSyncError || `"${deletedTitle}" ile eşleşen bir etkinlik bulunamadı.`}_`;

      return {
        transcript,
        intent: "calendar",
        action: "delete",
        targetQuery: deletedTitle,
        replyText,
        usedGemini,
        syncedToGoogle,
        googleSyncError,
      };
    }

    if (action === "update") {
      if (
        localParsed.shiftMinutes &&
        localParsed.hasExplicitTime &&
        localParsed.calendar
      ) {
        calData.startTime = localParsed.calendar.startTime;
        calData.endTime = localParsed.calendar.endTime;
      }

      let htmlLink: string | undefined;
      let matchedTitle = targetQuery || calData.title;
      if (accessToken) {
        const updRes = await updateGoogleCalendarEvent(
          accessToken,
          matchedTitle,
          calData,
          localParsed.shiftMinutes || 0,
          Boolean(localParsed.hasExplicitTime),
          Boolean(localParsed.hasExplicitDate)
        );
        syncedToGoogle = updRes.ok;
        htmlLink = updRes.htmlLink;
        if (updRes.matchedTitle) matchedTitle = updRes.matchedTitle;
        if (updRes.finalDate) calData.date = updRes.finalDate;
        if (updRes.finalStartTime) calData.startTime = updRes.finalStartTime;
        if (updRes.finalEndTime) calData.endTime = updRes.finalEndTime;
        googleSyncError = updRes.error;
      }

      const calendarEvent: CalendarItem = {
        id: "evt-" + Date.now(),
        title: matchedTitle,
        date: calData.date,
        startTime: calData.startTime,
        endTime: calData.endTime,
        attendee: calData.attendee || "WhatsApp Kullanıcısı",
        location: calData.location || "Google Meet",
        source: isVoice
          ? "🎙️ WhatsApp Sesli Güncelleme"
          : "💬 WhatsApp Metin Güncelleme",
        createdTime: "Güncellendi",
        htmlLink,
        syncedWithGoogle: syncedToGoogle,
      };

      const replyText =
        `🔄 *Google Takvim Etkinliği Güncellendi!*\n\n` +
        `📌 *Başlık:* ${calendarEvent.title}\n` +
        `🗓️ *Yeni Tarih/Saat:* ${calendarEvent.date}, ${calendarEvent.startTime} - ${calendarEvent.endTime}\n` +
        `📍 *Konum:* ${calendarEvent.location}` +
        (syncedToGoogle
          ? `\n✅ *Gerçek Google Takvim'inizde güncellendi!*`
          : googleSyncError
            ? `\n⚠️ _${googleSyncError}_`
            : "");

      return {
        transcript,
        intent: "calendar",
        action: "update",
        targetQuery: matchedTitle,
        replyText,
        usedGemini,
        syncedToGoogle,
        googleSyncError,
        calendarEvent,
      };
    }

    // CREATE CALENDAR EVENT (with optional immediate email invitation)
    const calSig = `cal:${calData.date}:${calData.startTime}:${normalizeTr(calData.title)}`;
    if (isRecentlyCreatedSignature(calSig, 45000)) {
      return {
        transcript,
        intent: "calendar",
        action: "create",
        replyText: "",
        usedGemini,
        syncedToGoogle: true,
        duplicate: true,
      };
    }

    let htmlLink: string | undefined;
    let invitedEmails: string[] | undefined;
    if (accessToken) {
      const calRes = await createGoogleCalendarEvent(
        accessToken,
        calData,
        recipientQuery
      );
      if (calRes.duplicate) {
        return {
          transcript,
          intent: "calendar",
          action: "create",
          replyText: "",
          usedGemini,
          syncedToGoogle: true,
          duplicate: true,
        };
      }
      syncedToGoogle = calRes.ok;
      htmlLink = calRes.htmlLink;
      invitedEmails = calRes.invitedEmails;
      googleSyncError = calRes.error;
    }

    const calendarEvent: CalendarItem = {
      id: "evt-" + Date.now(),
      title: calData.title,
      date: calData.date,
      startTime: calData.startTime,
      endTime: calData.endTime,
      attendee:
        invitedEmails?.join(", ") || calData.attendee || "WhatsApp Kullanıcısı",
      attendeeEmail: invitedEmails?.join(", ") || calData.attendeeEmail,
      location: calData.location || "Google Meet",
      source: isVoice ? "🎙️ WhatsApp Sesli Komut" : "💬 WhatsApp Metin Komutu",
      createdTime: "Şimdi",
      htmlLink,
      syncedWithGoogle: syncedToGoogle,
    };

    const syncTag = syncedToGoogle
      ? invitedEmails?.length
        ? `\n📨 *Davet Gönderilen E-posta:* ${invitedEmails.join(", ")}\n✅ *Gerçek Google Takvim'inize eklendi ve karşı tarafa e-posta daveti gönderildi!*`
        : "\n✅ *Gerçek Google Takvim'inize senkronize edildi!*"
      : "";

    const replyText =
      `📅 *Google Takvim'e Etkinlik / Görev Eklendi!*\n\n` +
      `📌 *Başlık:* ${calendarEvent.title}\n` +
      `🗓️ *Tarih:* ${calendarEvent.date}, ${calendarEvent.startTime} - ${calendarEvent.endTime}\n` +
      `👥 *Katılımcı:* ${calendarEvent.attendee}\n` +
      `📍 *Konum:* ${calendarEvent.location}\n` +
      `🔔 *Hatırlatıcı:* 15 dk önce bildirim${syncTag}`;

    return {
      transcript,
      intent: "calendar",
      action: "create",
      replyText,
      usedGemini,
      syncedToGoogle,
      googleSyncError,
      calendarEvent,
    };
  }

  // ==================== 2. CONTACTS (CREATE / UPDATE / DELETE) ====================
  if (parsed.intent === "contact") {
    const cntData = parsed.contact ||
      localParsed.contact || {
        name: targetQuery || "Yeni Kişi",
        phone: "",
        email: "",
        company: "WhatsApp Bağlantısı",
        notes: "",
      };

    if (action === "delete") {
      let deletedName = targetQuery || cntData.name;
      if (accessToken) {
        const delRes = await deleteGooglePersonContact(
          accessToken,
          deletedName
        );
        syncedToGoogle = delRes.ok;
        if (delRes.deletedName) deletedName = delRes.deletedName;
        googleSyncError = delRes.error;
      }

      const replyText =
        `🗑️ *Google Kişiler'den Silindi!*\n\n` +
        `👤 *Silinen Kişi:* ${deletedName}` +
        (syncedToGoogle
          ? `\n✅ *Gerçek Google Rehberinizden kaldırıldı!*`
          : googleSyncError
            ? `\n⚠️ _${googleSyncError}_`
            : "");

      return {
        transcript,
        intent: "contact",
        action: "delete",
        targetQuery: deletedName,
        replyText,
        usedGemini,
        syncedToGoogle,
        googleSyncError,
      };
    }

    if (action === "update") {
      let matchedName = targetQuery || cntData.name;
      if (accessToken) {
        const updRes = await updateGooglePersonContact(
          accessToken,
          matchedName,
          cntData
        );
        syncedToGoogle = updRes.ok;
        if (updRes.matchedName) matchedName = updRes.matchedName;
        googleSyncError = updRes.error;
      }

      const contact: ContactItem = {
        id: "cnt-" + Date.now(),
        name: matchedName,
        phone: cntData.phone || "Güncellendi",
        email: cntData.email || "",
        company: cntData.company || "WhatsApp Bağlantısı",
        notes: "WhatsApp üzerinden güncellendi",
        addedDate: "Güncellendi",
        syncedWithGoogle: syncedToGoogle,
      };

      const replyText =
        `🔄 *Google Kişiler Kaydı Güncellendi!*\n\n` +
        `📇 *İsim:* ${contact.name}\n` +
        (cntData.phone ? `📞 *Yeni Telefon:* ${cntData.phone}\n` : "") +
        (cntData.email ? `✉️ *Yeni E-posta:* ${cntData.email}\n` : "") +
        (cntData.company && cntData.company !== "WhatsApp Bağlantısı"
          ? `🏢 *Yeni Şirket:* ${cntData.company}\n`
          : "") +
        (syncedToGoogle
          ? `✅ *Gerçek Google Kişiler (Contacts) hesabınızda güncellendi!*`
          : googleSyncError
            ? `⚠️ _${googleSyncError}_`
            : "");

      return {
        transcript,
        intent: "contact",
        action: "update",
        targetQuery: matchedName,
        replyText,
        usedGemini,
        syncedToGoogle,
        googleSyncError,
        contact,
      };
    }

    // CREATE CONTACT
    const cntSig = `cnt:${normalizeTr(cntData.name)}:${cntData.phone.replace(/\D/g, "")}`;
    if (isRecentlyCreatedSignature(cntSig, 45000)) {
      return {
        transcript,
        intent: "contact",
        action: "create",
        replyText: "",
        usedGemini,
        syncedToGoogle: true,
        duplicate: true,
      };
    }

    if (accessToken) {
      const cntRes = await createGooglePersonContact(accessToken, cntData);
      syncedToGoogle = cntRes.ok;
      googleSyncError = cntRes.error;
    }

    const contact: ContactItem = {
      id: "cnt-" + Date.now(),
      name: cntData.name,
      phone: cntData.phone,
      email: cntData.email || "",
      company: cntData.company || "WhatsApp Bağlantısı",
      notes:
        cntData.notes ||
        (isVoice
          ? "Sesli mesaj ile Google Kişiler'e kaydedildi"
          : "Yazılı WhatsApp komutuyla eklendi"),
      addedDate: "Şimdi",
      syncedWithGoogle: syncedToGoogle,
    };

    const syncTag = syncedToGoogle
      ? "\n✅ *Gerçek Google Kişiler (Contacts) hesabınıza kaydedildi!*"
      : "";

    const replyText =
      `👤 *Google Kişiler'e Başarıyla Kaydedildi!*\n\n` +
      `📇 *İsim:* ${contact.name}\n` +
      `📞 *Telefon:* ${contact.phone}\n` +
      (contact.email ? `✉️ *E-posta:* ${contact.email}\n` : "") +
      `🏢 *Şirket:* ${contact.company}${syncTag}`;

    return {
      transcript,
      intent: "contact",
      action: "create",
      replyText,
      usedGemini,
      syncedToGoogle,
      googleSyncError,
      contact,
    };
  }

  // ==================== 3. NOTES ====================
  if (parsed.intent === "note" && parsed.note) {
    const noteSig = `note:${normalizeTr(parsed.note.content)}`;
    if (isRecentlyCreatedSignature(noteSig, 45000)) {
      return {
        transcript,
        intent: "note",
        action: "create",
        replyText: "",
        usedGemini,
        syncedToGoogle: false,
        duplicate: true,
      };
    }

    const note: NoteItem = {
      id: "not-" + Date.now(),
      title: parsed.note.title,
      content: parsed.note.content,
      category: parsed.note.category || "WhatsApp Notu",
      time: "Şimdi",
    };

    const replyText =
      `📝 *Not Defterine Kaydedildi!*\n\n` +
      `"${note.content}"\n\n` +
      `_Kategori: ${note.category} • Notlar sekmesinde saklandı._`;

    return {
      transcript,
      intent: "note",
      action: "create",
      replyText,
      usedGemini,
      syncedToGoogle: false,
      note,
    };
  }

  return {
    transcript,
    intent: "help",
    action: "create",
    usedGemini,
    syncedToGoogle: false,
    replyText:
      `Anlayamadım. Lütfen şu formatları deneyin:\n\n` +
      `• 📅 *Toplantı Ekle/Güncelle/Sil:* "!toplanti Yarın 14:00 Bütçe" | "!toplanti güncelle Bütçe Cuma 16:00" | "!toplanti sil Bütçe"\n` +
      `• 👤 *Kişi Ekle/Güncelle/Sil:* "!rehber Ali Kaya 05441234567" | "!rehber güncelle Ali Kaya 05329998877" | "!rehber sil Ali Kaya"\n` +
      `• 📝 *Not:* "!not Marketten süt alınacak"\n\n` +
      `Ya da mikrofona basarak sesli konuşabilirsiniz!`,
  };
}

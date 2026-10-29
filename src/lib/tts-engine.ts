/**
 * Natural Turkish Female Voice TTS Engine
 * Generates crystal-clear Turkish female speech audio (MP3 buffer) for both
 * Web/Mobile Live Voice Call UI and WhatsApp Voice Note (PTT) replies.
 */

function splitTextIntoTtsChunks(text: string, maxLen = 180): string[] {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(
      /[*_`~#•1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣📅🔄🗑️📨👤📝📋📸📁✅⚠️🎙️💡📂🔗🗓️🏢📞✉️🔔👥📍⚡━]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return ["Merhaba, sizi dinliyorum."];
  }

  const sentences = cleaned.split(/(?<=[.!?:\n])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length <= maxLen) {
      current = (current + " " + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxLen) {
        current = sentence.trim();
      } else {
        // Split long sentence by words
        const words = sentence.split(/\s+/);
        let sub = "";
        for (const w of words) {
          if ((sub + " " + w).trim().length <= maxLen) {
            sub = (sub + " " + w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 4); // Keep voice response concise & natural (max ~15-20s)
}

export async function generateTurkishFemaleVoiceBuffer(
  rawText: string
): Promise<Buffer | null> {
  const chunks = splitTextIntoTtsChunks(rawText, 180);
  const buffers: Buffer[] = [];

  for (const chunk of chunks) {
    try {
      const url = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=tr&dt=t&q=${encodeURIComponent(
        chunk
      )}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const arrBuf = await res.arrayBuffer();
      if (arrBuf.byteLength > 200) {
        buffers.push(Buffer.from(arrBuf));
      }
    } catch {
      continue;
    }
  }

  if (buffers.length === 0) return null;
  return Buffer.concat(buffers);
}

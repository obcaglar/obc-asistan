/**
 * Natural Turkish Female Voice TTS Engine
 * Primary: Gemini 2.5 Flash Preview Neural TTS ("Aoede" / "Kore" warm female voice -> 24kHz WAV)
 * Fast Fallback: Google Turkish Female TTS (MP3)
 */

function cleanTextForSpeech(text: string): string {
  return String(text || "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(
      /[*_`~#•1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣📅🔄🗑️📨👤📝📋📸📁✅⚠️🎙️💡📂🔗🗓️🏢📞✉️🔔👥📍⚡━👩‍💼]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}

/**
 * Wraps raw 16-bit mono PCM (24000 Hz) bytes from Gemini TTS into a standard RIFF WAV buffer.
 */
function pcm16ToWavBuffer(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function splitTextIntoTtsChunks(text: string, maxLen = 180): string[] {
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) {
    return ["Buyurun Onur Bey, sizi dinliyorum. Ne yapmamı istersiniz?"];
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
  return chunks.slice(0, 3);
}

const ttsMemoryCache = new Map<
  string,
  { buffer: Buffer; mimeType: string }
>();

async function fetchGeminiNeuralFemaleWav(
  cleaned: string,
  timeoutMs = 2600
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("BURAYA_")) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Sıcak, kibar, doğal ve akıcı bir kadın asistan sesiyle Türkçe oku: ${cleaned}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Aoede",
                },
              },
            },
          },
        }),
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const inlineData =
        data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (inlineData?.data) {
        const pcmBuf = Buffer.from(inlineData.data, "base64");
        if (pcmBuf.length > 400) {
          const result = {
            buffer: pcm16ToWavBuffer(pcmBuf, 24000, 1, 16),
            mimeType: "audio/wav",
          };
          ttsMemoryCache.set(cleaned, result);
          return result;
        }
      }
    }
  } catch {
    // Ignore timeout or network error
  }
  return null;
}

export async function generateTurkishFemaleVoiceAudio(rawText: string): Promise<{
  buffer: Buffer;
  mimeType: string;
} | null> {
  const cleaned =
    cleanTextForSpeech(rawText) ||
    "Buyurun Onur Bey, sizi dinliyorum. Ne yapmamı istersiniz?";

  const cached = ttsMemoryCache.get(cleaned);
  if (cached) {
    return cached;
  }

  // Trigger Gemini 2.5 Flash Neural TTS (Aoede) in parallel (warms cache with studio WAV)
  const geminiPromise = fetchGeminiNeuralFemaleWav(cleaned, 5000);

  // Also fetch ultra-low-latency MP3 in parallel so interactive calls respond in <300ms
  const chunks = splitTextIntoTtsChunks(cleaned, 180);
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

  if (buffers.length > 0) {
    const mp3Result = {
      buffer: Buffer.concat(buffers),
      mimeType: "audio/mpeg",
    };
    if (!ttsMemoryCache.has(cleaned)) {
      ttsMemoryCache.set(cleaned, mp3Result);
    }
    return ttsMemoryCache.get(cleaned) || mp3Result;
  }

  return await geminiPromise;
}

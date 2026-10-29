import { NextRequest, NextResponse } from "next/server";
import { generateTurkishFemaleVoiceAudio } from "@/lib/tts-engine";

export async function GET(request: NextRequest) {
  const text =
    request.nextUrl.searchParams.get("text") ||
    "Efendim Özgür Bey, sizi dinliyorum. Buyurun, ne yapmamı istersiniz?";

  const audio = await generateTurkishFemaleVoiceAudio(text);
  if (!audio) {
    return NextResponse.json(
      { error: "Ses oluşturulamadı" },
      { status: 500 }
    );
  }

  return new NextResponse(new Uint8Array(audio.buffer), {
    status: 200,
    headers: {
      "Content-Type": audio.mimeType,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text =
      body.text ||
      "Efendim Özgür Bey, sizi dinliyorum. Buyurun, ne yapmamı istersiniz?";

    const audio = await generateTurkishFemaleVoiceAudio(text);
    if (!audio) {
      return NextResponse.json(
        { error: "Ses oluşturulamadı" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      audioBase64: audio.buffer.toString("base64"),
      mimeType: audio.mimeType,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS hatası" },
      { status: 500 }
    );
  }
}

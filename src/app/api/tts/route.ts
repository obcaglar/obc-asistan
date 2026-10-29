import { NextRequest, NextResponse } from "next/server";
import { generateTurkishFemaleVoiceBuffer } from "@/lib/tts-engine";

export async function GET(request: NextRequest) {
  const text =
    request.nextUrl.searchParams.get("text") ||
    "Merhaba Özgür Bey, ben özel sesli asistanınız. Sizi dinliyorum, komutlarınızı peş peşe söyleyebilirsiniz.";

  const buf = await generateTurkishFemaleVoiceBuffer(text);
  if (!buf) {
    return NextResponse.json(
      { error: "Ses oluşturulamadı" },
      { status: 500 }
    );
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text =
      body.text ||
      "Merhaba Özgür Bey, ben özel sesli asistanınız. Sizi dinliyorum.";

    const buf = await generateTurkishFemaleVoiceBuffer(text);
    if (!buf) {
      return NextResponse.json(
        { error: "Ses oluşturulamadı" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      audioBase64: buf.toString("base64"),
      mimeType: "audio/mpeg",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS hatası" },
      { status: 500 }
    );
  }
}

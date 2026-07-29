// src/utils/voice.js
export async function jozSpeak(text) {
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OpenAI TTS error:", response.status, errorText);
      throw new Error(errorText);
    }

    const blob = await response.blob();
    if (blob.size === 0) throw new Error("Empty audio blob returned");

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play().catch(e => console.warn("Audio play failed:", e));

    return audio;
  } catch (err) {
    console.warn("⚠️ Realtime voice failed, falling back to browser TTS:", err);

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.1;
    utter.voice =
      speechSynthesis.getVoices().find(v => /female|alloy|en/i.test(v.name)) ||
      null;
    speechSynthesis.speak(utter);
  }
}

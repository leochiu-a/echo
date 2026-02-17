import { Buffer } from "node:buffer";
import OpenAI, { APIError, toFile } from "openai";

export interface VoiceTranscriptionRequest {
  audioBase64: string;
  mimeType: string;
}

export interface VoiceTranscriptionResult {
  text: string;
}

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export class OpenAIWhisperService {
  async transcribe(
    request: VoiceTranscriptionRequest,
    preferredApiKey?: string,
  ): Promise<VoiceTranscriptionResult> {
    const apiKey = resolveApiKey(preferredApiKey);
    if (!apiKey) {
      throw new Error("Missing OpenAI API key. Set it in Settings or OPENAI_API_KEY.");
    }

    const audioBuffer = decodeBase64(request.audioBase64);
    if (audioBuffer.length === 0) {
      throw new Error("Recorded audio is empty.");
    }
    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      throw new Error("Recorded audio is too large. Keep it under 25MB.");
    }

    const mimeType = normalizeMimeType(request.mimeType);
    const fileExtension = resolveFileExtension(mimeType);

    const client = new OpenAI({ apiKey });
    const file = await toFile(audioBuffer, `echo-voice.${fileExtension}`, { type: mimeType });

    try {
      const payload = await client.audio.transcriptions.create({
        file,
        model: "whisper-1",
      });

      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      if (!text) {
        throw new Error("Whisper returned empty text.");
      }

      return { text };
    } catch (error) {
      throw new Error(resolveOpenAIErrorMessage(error));
    }
  }
}

function resolveApiKey(preferredApiKey?: string): string | null {
  const fromSettings = preferredApiKey?.trim();
  if (fromSettings) {
    return fromSettings;
  }

  const fromEnv = process.env.OPENAI_API_KEY?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  return null;
}

function decodeBase64(value: string): Buffer {
  try {
    return Buffer.from(value, "base64");
  } catch {
    throw new Error("Invalid audio payload.");
  }
}

function normalizeMimeType(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "audio/webm";
  }
  return normalized;
}

function resolveFileExtension(mimeType: string): string {
  if (mimeType.includes("wav")) {
    return "wav";
  }
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) {
    return "mp3";
  }
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
    return "m4a";
  }
  if (mimeType.includes("ogg")) {
    return "ogg";
  }
  return "webm";
}

function resolveOpenAIErrorMessage(error: unknown): string {
  if (error instanceof APIError && error.message.trim()) {
    return error.message.trim();
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Whisper request failed.";
}

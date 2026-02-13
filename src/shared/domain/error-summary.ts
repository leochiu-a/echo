const MAX_LENGTH = 160;

export function summarizeCLIErrorMessage(rawMessage: string): string {
  const apiDetail = extractAPIDetail(rawMessage);
  if (apiDetail) {
    return clippedErrorMessage(apiDetail);
  }

  const lines = rawMessage
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const line =
    lines.find((item) => isLikelyErrorLine(item)) ??
    lines.find((item) => !isLikelyNoiseLine(item)) ??
    "Execution failed.";

  return clippedErrorMessage(line.replace("ERROR:", "").trim());
}

function extractAPIDetail(rawMessage: string): string | null {
  const match = rawMessage.match(/"detail":"([^"]+)"/);
  if (!match?.[1]) {
    return null;
  }

  const detail = match[1].trim();
  return detail || null;
}

function isLikelyErrorLine(line: string): boolean {
  const lowered = line.toLowerCase();
  return (
    lowered.includes("error") ||
    lowered.includes("failed") ||
    lowered.includes("not supported") ||
    lowered.includes("timed out") ||
    lowered.includes("unauthorized") ||
    lowered.includes("forbidden")
  );
}

function isLikelyNoiseLine(line: string): boolean {
  const lowered = line.toLowerCase();
  if (lowered.startsWith("openai codex v")) return true;
  if (lowered === "--------") return true;
  if (lowered.startsWith("workdir:")) return true;
  if (lowered.startsWith("model:")) return true;
  if (lowered.startsWith("provider:")) return true;
  if (lowered.startsWith("approval:")) return true;
  if (lowered.startsWith("sandbox:")) return true;
  if (lowered.startsWith("reasoning effort:")) return true;
  if (lowered.startsWith("reasoning summaries:")) return true;
  if (lowered.startsWith("session id:")) return true;
  if (lowered.startsWith("mcp:")) return true;
  if (lowered.startsWith("mcp startup:")) return true;
  if (lowered.startsWith("tokens used")) return true;
  if (lowered === "user" || lowered === "codex" || lowered === "thinking") return true;
  return lowered.startsWith("20") && lowered.includes(" warn ");
}

function clippedErrorMessage(message: string): string {
  const normalized = message.trim() || "Execution failed.";
  if (normalized.length <= MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_LENGTH - 3)}...`;
}

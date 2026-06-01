import {
  buildBillingHeaderValue,
  getCliVersion,
  getEntrypoint,
} from "./signing.ts";

const BILLING_PREFIX = "x-anthropic-billing-header";
const CC_IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude.";

type SystemEntry = { type?: string; text?: string } & Record<string, unknown>;

interface AnthropicPayload {
  model?: unknown;
  system?: unknown;
  messages?: unknown;
}

function isClaudeModel(model: unknown): model is string {
  return typeof model === "string" && model.toLowerCase().includes("claude");
}

function entryText(entry: unknown): string {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    const text = (entry as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return "";
}

/**
 * Inject the Claude Code billing header into an Anthropic request payload as
 * the first system entry.
 *
 * pi's built-in Anthropic provider already sends the Claude Code identity,
 * beta flags, and user-agent for OAuth tokens, but it does not send the
 * `x-anthropic-billing-header` system block. That block is what routes billing
 * to the Claude Pro/Max subscription instead of pay-as-you-go API credits.
 *
 * Returns the mutated payload when a billing header was injected, or undefined
 * to leave the payload unchanged (non-Claude requests, or already injected).
 */
export function injectBillingHeader(
  payload: unknown,
): AnthropicPayload | undefined {
  if (!payload || typeof payload !== "object") return undefined;

  const p = payload as AnthropicPayload;
  if (!isClaudeModel(p.model)) return undefined;
  if (!Array.isArray(p.messages)) return undefined;

  const system: SystemEntry[] = Array.isArray(p.system)
    ? (p.system as SystemEntry[])
    : [];

  // Only inject when pi is in OAuth stealth mode, signalled by its Claude
  // Code identity block. This avoids touching plain API-key requests (which
  // bill correctly on their own and would be confused by the header).
  if (!system.some((e) => entryText(e).startsWith(CC_IDENTITY))) {
    return undefined;
  }

  // Already injected — leave it untouched (handler idempotency).
  if (system.some((e) => entryText(e).startsWith(BILLING_PREFIX))) {
    return undefined;
  }

  const messages = p.messages as Array<{
    role?: string;
    content?: string | Array<{ type?: string; text?: string }>;
  }>;

  const billingHeader = buildBillingHeaderValue(
    messages,
    getCliVersion(),
    getEntrypoint(),
  );

  // Billing header goes first, ahead of pi's identity block. No
  // cache_control so it does not consume a cache breakpoint.
  p.system = [{ type: "text", text: billingHeader }, ...system];
  return p;
}

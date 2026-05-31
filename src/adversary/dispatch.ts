/**
 * M4 — Falsification Adversary
 * 
 * Dispatches adversarial review across multiple models using Pi's SDK.
 * Each adversary receives a claim and produces the strongest disconfirming
 * experiment. If the cheapest disconfirming experiment is <$1 and unrun,
 * the claim is blocked until the experiment is run.
 */

import type { AdversaryVerdict } from "../state/repo.js";

export interface FalsifierOptions {
  claim: string;
  context: string;
  cwd: string;
  signal?: AbortSignal;
  onProgress?: (msg: string) => void;
}

/**
 * Run the falsification adversary against a claim.
 * 
 * Dispatches to 2+ models. Returns structured verdicts.
 * Uses direct API calls (not Pi SDK sub-sessions) to avoid
 * recursive agent nesting and keep cost transparent.
 */
export async function runFalsificationAdversary(
  options: FalsifierOptions
): Promise<AdversaryVerdict[]> {
  const { claim, cwd, onProgress } = options;

  onProgress?.(`Ξ Falsification adversary running for: "${claim.slice(0, 60)}..."`);

  // Define adversary models
  const adversaries = [
    { provider: "openai", model: "gpt-4o", name: "GPT-4o" },
    { provider: "google", model: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  ];

  const verdicts: AdversaryVerdict[] = [];

  for (const adv of adversaries) {
    try {
      onProgress?.(`  → Dispatching to ${adv.name}...`);
      const verdict = await runSingleAdversary(adv, claim, cwd);
      verdicts.push(verdict);
      onProgress?.(`  ← ${adv.name}: ${verdict.verdict}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      verdicts.push({
        claim,
        modelId: adv.name,
        providerId: adv.provider,
        disconfirmingExperiment: `Error contacting ${adv.name}: ${errorMsg}`,
        costEstimate: 0,
        hasBeenRun: false,
        verdict: "cannot-audit",
        reasoning: `Failed to get response from ${adv.name}: ${errorMsg}`,
      });
    }
  }

  return verdicts;
}

/**
 * Run a single adversary via direct API call.
 * Uses environment variable API keys.
 */
async function runSingleAdversary(
  adv: { provider: string; model: string; name: string },
  claim: string,
  _cwd: string
): Promise<AdversaryVerdict> {
  const apiKey = getApiKey(adv.provider);
  if (!apiKey) {
    return {
      claim,
      modelId: adv.name,
      providerId: adv.provider,
      disconfirmingExperiment: `No API key configured for ${adv.provider}`,
      costEstimate: 0,
      hasBeenRun: false,
      verdict: "cannot-audit",
      reasoning: `Missing API key for ${adv.provider}. Set ${getEnvVarName(adv.provider)} environment variable.`,
    };
  }

  const messages = buildAdversaryMessages(claim);
  const result = await callLLM(adv, apiKey, messages);

  return {
    claim,
    modelId: adv.name,
    providerId: adv.provider,
    disconfirmingExperiment: result.experiment,
    costEstimate: result.costEstimate,
    hasBeenRun: false,
    verdict: result.verdict as AdversaryVerdict["verdict"],
    reasoning: result.reasoning,
  };
}

/**
 * Build the adversary system prompt.
 */
function buildAdversaryMessages(claim: string): Array<{ role: string; content: string }> {
  return [
    {
      role: "system",
      content: "You are a research falsification adversary. Your job is to produce the single strongest disconfirming experiment for a given claim. Be adversarial, not supportive. Do NOT validate the claim. Respond with a JSON object containing: { experiment: string, costEstimate: number (USD), verdict: string (one of: 'defensible', 'caveat-required', 'falsified-or-unreproducible', 'cannot-audit'), reasoning: string }.",
    },
    {
      role: "user",
      content: `Produce the strongest disconfirming experiment for this claim: "${claim}". What would the researcher need to test that would most likely falsify this? Be specific about methodology, sample size, and controls.`,
    },
  ];
}

/**
 * Call an LLM and parse the structured response.
 */
async function callLLM(
  adv: { provider: string; model: string; name: string },
  apiKey: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ experiment: string; costEstimate: number; verdict: string; reasoning: string }> {
  // Determine API endpoint based on provider
  const endpoints: Record<string, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    google: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    anthropic: "https://api.anthropic.com/v1/messages",
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
  };

  const endpoint = endpoints[adv.provider];
  if (!endpoint) {
    return { experiment: "Provider not supported", costEstimate: 0, verdict: "cannot-audit" as const, reasoning: `Provider ${adv.provider} not configured` };
  }

  if (adv.provider === "google") {
    // Google Gemini API
    const resp = await fetch(`${endpoints.google}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
      }),
    });
    const data = await resp.json() as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(data);
    return parseAdversaryResponse(text);
  }

  if (adv.provider === "anthropic") {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: adv.model,
        max_tokens: 1024,
        messages: (messages as any[]).filter((m: any) => m.role !== "system"),
        system: (messages as any[]).find((m: any) => m.role === "system")?.content ?? "",
      }),
    });
    const data = await resp.json() as any;
    const text = data?.content?.[0]?.text ?? JSON.stringify(data);
    return parseAdversaryResponse(text);
  }

  // OpenAI / OpenRouter compatible
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...(adv.provider === "openrouter" ? { "HTTP-Referer": "https://epistemic.dev" } : {}),
    },
    body: JSON.stringify({
      model: adv.model,
      messages,
      max_tokens: 1024,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  const data = await resp.json() as any;
  const text = data?.choices?.[0]?.message?.content ?? JSON.stringify(data);
  return parseAdversaryResponse(text);
}

/**
 * Parse the structured JSON response from the adversary.
 */
function parseAdversaryResponse(text: string): { experiment: string; costEstimate: number; verdict: string; reasoning: string } {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*\n?({[\s\S]*?})\n?\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;
    // Find first { to last }
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}") + 1;
    const parsed = JSON.parse(jsonStr.slice(start, end));
    return {
      experiment: parsed.experiment ?? parsed.disconfirming_experiment ?? "Could not parse",
      costEstimate: parsed.costEstimate ?? parsed.cost_estimate ?? 1,
      verdict: parsed.verdict ?? "caveat-required",
      reasoning: parsed.reasoning ?? "No reasoning provided",
    };
  } catch {
    return {
      experiment: "Could not parse adversary response",
      costEstimate: 1,
      verdict: "caveat-required",
      reasoning: text.slice(0, 500),
    };
  }
}

/**
 * Get API key for a provider from environment variable or auth storage.
 */
function getApiKey(provider: string): string | null {
  const envVarName = getEnvVarName(provider);
  return process.env[envVarName] ?? null;
}

function getEnvVarName(provider: string): string {
  const map: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
  };
  return map[provider] ?? `${provider.toUpperCase()}_API_KEY`;
}

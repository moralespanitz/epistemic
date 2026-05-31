import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

type RepoType = "model" | "dataset" | "space";

const HF_API_BASE = "https://huggingface.co/api";
const HF_BASE = "https://huggingface.co";
const DEFAULT_FILE_LIMIT = 200;
const DEFAULT_READ_CHARS = 20_000;
const MAX_READ_CHARS = 60_000;
const BLOCKED_FILE_EXTENSIONS = new Set([
  ".7z", ".bin", ".ckpt", ".gguf", ".h5", ".joblib", ".onnx", ".ot",
  ".parquet", ".pt", ".pth", ".safetensors", ".tar", ".tgz", ".zip",
]);

function encodeRepoId(repo: string): string {
  return repo.split("/").map(p => encodeURIComponent(p)).join("/");
}

function repoTypeApiSegment(t: RepoType): string {
  return t === "model" ? "models" : t === "dataset" ? "datasets" : "spaces";
}

function repoTypeResolvePrefix(t: RepoType): string {
  return t === "model" ? "" : t === "dataset" ? "datasets/" : "spaces/";
}

function authHeaders(): Record<string, string> {
  const token = process.env.HF_TOKEN ?? process.env.HUGGINGFACE_HUB_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson(url: string): Promise<unknown> {
  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`HF request failed: ${resp.status} ${resp.statusText}`);
  return resp.json();
}

function clampNumber(v: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(v) || v === undefined) return fallback;
  return Math.max(1, Math.min(Math.floor(v), max));
}

function formatText(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v, null, 2);
}

function fileExt(path: string): string {
  const name = path.split("/").pop() ?? "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function assertReadable(path: string): void {
  if (BLOCKED_FILE_EXTENSIONS.has(fileExt(path))) {
    throw new Error(`Refusing to read likely binary file: ${path}`);
  }
}

function trimText(v: string, max: number): string {
  if (v.length <= max) return v;
  return `${v.slice(0, max)}\n\n[truncated ${v.length - max} chars]`;
}

function extractDatasetInfo(card: unknown): unknown {
  if (!card || typeof card !== "object") return undefined;
  const r = card as Record<string, unknown>;
  return r.dataset_info ?? r.dataset_infos;
}

// ─── API calls ──────────────────────────────────────────────────────

async function datasetInfo(dataset: string): Promise<unknown> {
  const enc = encodeRepoId(dataset.trim());
  const data = await fetchJson(`${HF_API_BASE}/datasets/${enc}`);
  const r = data as Record<string, unknown>;
  return {
    id: r.id, author: r.author, sha: r.sha, lastModified: r.lastModified,
    private: r.private, gated: r.gated, disabled: r.disabled,
    downloads: r.downloads, likes: r.likes, tags: r.tags,
    cardData: r.cardData, datasetInfo: extractDatasetInfo(r.cardData),
    siblings: r.siblings,
    url: `${HF_BASE}/datasets/${enc}`,
  };
}

async function repoFiles(params: {
  repo: string; repoType: RepoType; revision?: string;
  path?: string; recursive?: boolean; limit?: number;
}): Promise<unknown> {
  const enc = encodeRepoId(params.repo.trim());
  const rev = encodeURIComponent(params.revision?.trim() || "main");
  const cleanPath = params.path?.trim().replace(/^\/+/, "");
  const suffix = cleanPath ? `/${cleanPath.split("/").map(encodeURIComponent).join("/")}` : "";
  const qs = new URLSearchParams({ recursive: params.recursive ? "true" : "false" });
  const url = `${HF_API_BASE}/${repoTypeApiSegment(params.repoType)}/${enc}/tree/${rev}${suffix}?${qs}`;
  const data = await fetchJson(url);
  const files = Array.isArray(data) ? data : [];
  const limit = clampNumber(params.limit, DEFAULT_FILE_LIMIT, 1000);
  return {
    repo: params.repo, repoType: params.repoType, revision: params.revision || "main",
    path: cleanPath || "", count: files.length, truncated: files.length > limit,
    files: files.slice(0, limit),
    url: `${HF_BASE}/${repoTypeResolvePrefix(params.repoType)}${enc}/tree/${rev}${suffix}`,
  };
}

async function readRepoFile(params: {
  repo: string; repoType: RepoType; path: string;
  revision?: string; maxChars?: number;
}): Promise<unknown> {
  const enc = encodeRepoId(params.repo.trim());
  const rev = encodeURIComponent(params.revision?.trim() || "main");
  const clean = params.path.trim().replace(/^\/+/, "");
  assertReadable(clean);
  const filePath = clean.split("/").map(encodeURIComponent).join("/");
  const url = `${HF_BASE}/${repoTypeResolvePrefix(params.repoType)}${enc}/resolve/${rev}/${filePath}`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`HF file read failed: ${resp.status}`);
  const text = await resp.text();
  const max = clampNumber(params.maxChars, DEFAULT_READ_CHARS, MAX_READ_CHARS);
  return {
    repo: params.repo, repoType: params.repoType, revision: params.revision || "main",
    path: clean, contentType: resp.headers.get("content-type") ?? "",
    sizeChars: text.length, truncated: text.length > max,
    content: trimText(text, max), url,
  };
}

// ─── Extension entry ────────────────────────────────────────────────

export function registerHuggingFaceTools(pi: ExtensionAPI): void {
  const repoTypeSchema = Type.Optional(
    Type.Union([Type.Literal("model"), Type.Literal("dataset"), Type.Literal("space")], {
      description: "Hub repository type. Defaults to dataset.",
    }),
  );

  pi.registerTool({
    name: "hf_dataset_info",
    label: "HF Dataset Info",
    description:
      "Inspect Hugging Face dataset metadata, tags, card data, features, splits, and sibling files. Uses HF_TOKEN or HUGGINGFACE_HUB_TOKEN when set.",
    promptSnippet: "Inspect Hugging Face dataset metadata, features, splits, tags, and access status.",
    promptGuidelines: [
      "Use hf_dataset_info before declaring a dataset usable in an experiment.",
      "Treat missing features or splits as unverified — do not assume schema.",
    ],
    parameters: Type.Object({
      dataset: Type.String({ description: "Dataset repo id, e.g. HuggingFaceH4/ultrachat_200k." }),
    }),
    async execute(_id: string, params: any) {
      const result = await datasetInfo(params.dataset);
      return { content: [{ type: "text", text: formatText(result) }], details: result };
    },
  });

  pi.registerTool({
    name: "hf_repo_files",
    label: "HF Repo Files",
    description:
      "List files in a Hugging Face model, dataset, or Space repo. Use before reading files to avoid large binaries.",
    promptSnippet: "List files in a Hub repo before reading specific small files.",
    promptGuidelines: [
      "Use hf_repo_files before hf_repo_read_file to avoid weight files, archives, and shards.",
    ],
    parameters: Type.Object({
      repo: Type.String({ description: "Hub repo id, e.g. openai-community/gpt2." }),
      repoType: repoTypeSchema,
      revision: Type.Optional(Type.String({ description: "Branch, tag, or commit. Defaults to main." })),
      path: Type.Optional(Type.String({ description: "Optional subdirectory." })),
      recursive: Type.Optional(Type.Boolean({ description: "List recursively. Defaults to false." })),
      limit: Type.Optional(Type.Number({ description: "Max files to return. Default 200, max 1000." })),
    }),
    async execute(_id: string, params: any) {
      const result = await repoFiles({
        repo: params.repo,
        repoType: (params.repoType ?? "dataset") as RepoType,
        revision: params.revision,
        path: params.path,
        recursive: params.recursive,
        limit: params.limit,
      });
      return { content: [{ type: "text", text: formatText(result) }], details: result };
    },
  });

  pi.registerTool({
    name: "hf_repo_read_file",
    label: "HF Read File",
    description:
      "Read a small text file from a Hugging Face repo. Use for README, configs, dataset cards, examples, scripts. Avoid weights or shards.",
    promptSnippet: "Read small text files from Hub repos — README.md, configs, examples, scripts.",
    promptGuidelines: [
      "Use only for small text files. Never read weights, archives, or dataset shards.",
    ],
    parameters: Type.Object({
      repo: Type.String({ description: "Hub repo id." }),
      repoType: repoTypeSchema,
      path: Type.String({ description: "File path inside the repo, e.g. README.md." }),
      revision: Type.Optional(Type.String({ description: "Branch, tag, or commit. Defaults to main." })),
      maxChars: Type.Optional(Type.Number({ description: "Max chars to return. Default 20000, max 60000." })),
    }),
    async execute(_id: string, params: any) {
      const result = await readRepoFile({
        repo: params.repo,
        repoType: (params.repoType ?? "dataset") as RepoType,
        path: params.path,
        revision: params.revision,
        maxChars: params.maxChars,
      });
      return { content: [{ type: "text", text: formatText(result) }], details: result };
    },
  });
}
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeFeishuHireWebBaseUrl } from "./feishu-hire-links.mjs";

export const configTemplate = {
  schemaVersion: 1, profile: "", cliBin: "lark-cli", webBaseUrl: "",
  inbox: "inbox", archive: "archive", database: "uploads.sqlite",
  resumeSourceId: "", jobs: {}, requiredCandidateFields: [],
};

export function initConfig(file, values = {}) {
  const allowed = new Set(Object.keys(configTemplate));
  if (Object.keys(values).some(key => !allowed.has(key))) throw new Error("unknown config field; keep credentials in lark-cli");
  const target = path.resolve(file);
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  writeFileSync(target, JSON.stringify({ ...configTemplate, ...values }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  return target;
}

export function loadUploadConfig(file, { requireConnection = true } = {}) {
  try { return readUploadConfig(file, { requireConnection }); }
  catch (error) { error.setupStage ??= "repair_config"; throw error; }
}

function readUploadConfig(file, { requireConnection }) {
  const target = path.resolve(file);
  let raw;
  try { raw = JSON.parse(readFileSync(target, "utf8")); }
  catch (error) {
    throw Object.assign(new Error(error.code === "ENOENT" ? "upload config missing; run init first" : "upload config unreadable or invalid; repair the existing file"),
      { setupStage: error.code === "ENOENT" ? "local_config" : "repair_config" });
  }
  if (raw.schemaVersion !== 1 || Object.keys(raw).some(key => !(key in configTemplate))) throw new Error("unsupported upload config");
  const config = { ...configTemplate, ...raw };
  for (const key of ["profile", "cliBin", "inbox", "archive", "database", "resumeSourceId"]) {
    if (typeof config[key] !== "string") throw new Error(`config ${key} must be a string`);
  }
  if (!config.cliBin || !config.inbox || !config.archive || !config.database) throw new Error("runtime paths and cliBin are required");
  if (requireConnection && !config.profile.trim()) throw Object.assign(new Error("configure profile first"), { setupStage: "application" });
  if (requireConnection && !config.resumeSourceId.trim()) throw Object.assign(new Error("configure resumeSourceId first"), { setupStage: "mapping" });
  if (!config.jobs || Array.isArray(config.jobs) || typeof config.jobs !== "object" || Object.values(config.jobs).some(id => typeof id !== "string" || !id.trim())) throw new Error("jobs must map role keys to job IDs");
  if (!Array.isArray(config.requiredCandidateFields) || config.requiredCandidateFields.some(key => !["candidateMobile", "candidateEmail"].includes(key))) throw new Error("requiredCandidateFields supports candidateMobile and candidateEmail");
  config.webBaseUrl = normalizeFeishuHireWebBaseUrl(config.webBaseUrl);
  for (const key of ["inbox", "archive", "database"]) config[key] = path.resolve(path.dirname(target), config[key]);
  if (config.inbox === config.archive) throw new Error("inbox and archive must be separate directories");
  return config;
}

export async function discover(client) {
  const [jobs, sources] = await Promise.all([client.listJobs(), client.listResumeSources()]);
  return {
    jobs: jobs.map(job => ({ id: String(job.id), title: job.title ?? "" })),
    sources: sources.map(source => ({ id: String(source.id), name: source.zh_name ?? source.en_name ?? "", isEnabled: source.active_status === 1, type: String(source.resume_source_type ?? "") })),
  };
}

export async function verifyMapping(config, client) {
  const result = await discover(client);
  const source = result.sources.find(item => item.id === config.resumeSourceId);
  if (!source || !source.isEnabled) throw Object.assign(new Error("configured resume source is missing, disabled or unverifiable"), { setupStage: "mapping" });
  if (["10008", "10009"].includes(source.type)) throw Object.assign(new Error("employee transfer sources require additional user fields not supported by this upload module"), { setupStage: "mapping" });
  const ids = new Set(result.jobs.map(job => job.id));
  if (Object.values(config.jobs).some(id => !ids.has(id))) throw Object.assign(new Error("configured job is not visible in this connection"), { setupStage: "mapping" });
  return { sourceVerified: true, jobsVerified: Object.keys(config.jobs).length };
}

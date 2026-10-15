#!/usr/bin/env node
import { readFileSync, writeFileSync, realpathSync, mkdirSync, openSync, closeSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initConfig, loadUploadConfig, discover, verifyMapping } from "./lib/config.mjs";
import { FeishuHireClient } from "./lib/feishu-hire.mjs";
import { ResumeIntakeStore, inspectResumeFile } from "./lib/resume-intake.mjs";
import { verifyResumeUploadDedupe } from "./lib/resume-dedupe.mjs";
import { prepareResumeUpload, executePreparedResumeUpload, reconcileResumeUpload } from "./lib/resume-upload.mjs";
import { onboardingGuide, onboardingForError } from "./lib/onboarding.mjs";

function checkEnvironment(cliBin) {
  if (Number(process.versions.node.split(".")[0]) < 24) throw Object.assign(new Error("Node.js 24 or newer is required"), { setupStage: "environment" });
  const help = spawnSync(cliBin, ["api", "--help"], { encoding: "utf8", timeout: 10000 });
  if (help.status !== 0 || !help.stdout?.includes("--file") || !help.stdout?.includes("--data")) throw Object.assign(new Error("lark-cli with api --file and --data support is required"), { setupStage: "environment" });
}

export async function main(argv = process.argv.slice(2)) {
  const action = argv[0];
  const flag = (key, fallback = "") => {
    const i = argv.indexOf(key); return i < 0 ? fallback : argv[i + 1];
  };
  const configFile = flag("--config", ".runtime/feishu-hire/config.json");
  const payload = () => {
    if (flag("--payload") !== "-") throw new Error("use --payload -; input is read from stdin");
    try { return JSON.parse(readFileSync(0, "utf8")); } catch { throw new Error("payload must be valid JSON"); }
  };
  if (action === "init") {
    const values = flag("--payload") ? payload() : {};
    return { ok: true, config: initConfig(configFile, values), onboarding: onboardingGuide({ configFile,
      cliBin: values.cliBin, profile: values.profile, stage: !values.profile ? "application" : !values.resumeSourceId ? "mapping" : "verify" }) };
  }
  if (!["onboard", "doctor", "discover", "intake", "prepare", "execute", "reconcile", "status"].includes(action)) throw new Error("usage: hire-upload.mjs <onboard|init|doctor|discover|intake|prepare|execute|reconcile|status> --config <file>");
  const config = loadUploadConfig(configFile, { requireConnection: !["onboard", "intake", "status", "discover"].includes(action) });
  if (action === "onboard") {
    checkEnvironment(config.cliBin);
    const stage = !config.profile.trim() ? "application" : !config.resumeSourceId.trim() ? "mapping" : "verify";
    return { ok: true, onboarding: onboardingGuide({ configFile, cliBin: config.cliBin, profile: config.profile, stage }),
      readOnlyConnection: "not_checked", writePermissions: "unverified" };
  }
  const client = new FeishuHireClient({ bin: config.cliBin, profile: config.profile, identity: "bot" });
  if (action === "discover" && !config.profile.trim()) throw Object.assign(new Error("configure profile before discovery"), { setupStage: "application" });
  if (action === "discover") return { ok: true, ...(await discover(client)) };
  if (action === "doctor") {
    checkEnvironment(config.cliBin);
    return { ok: true, node: process.versions.node, cliAvailable: true,
      ...(argv.includes("--live") ? await verifyMapping(config, client) : {}),
      readOnlyConnection: argv.includes("--live") ? "verified" : "not_checked", writePermissions: "unverified" };
  }
  mkdirSync(path.dirname(config.database), { recursive: true, mode: 0o700 });
  // Serializes independent invocations. A stale lock is inspected, never silently expired.
  const lock = config.database + ".lock";
  let fd;
  try { fd = openSync(lock, "wx", 0o600); }
  catch { throw new Error("upload state is locked; inspect the owner and unresolved writes before recovery"); }
  let store;
  try {
    writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + "\n");
    store = new ResumeIntakeStore(config.database);
    if (config.profile && action !== "status") store.bindConnection(config.profile);
    if (action === "status") {
      const record = store.get(flag("--resume-sha256"));
      return { ok: Boolean(record), record };
    }
    const input = payload();
    if (action === "intake") {
      if (input.talentOnly === true && input.roleKey) throw new Error("choose a role or talentOnly, not both");
      const job = input.roleKey ? config.jobs[input.roleKey] : null;
      if (!job && input.talentOnly !== true) throw new Error("select a configured role or explicitly request talentOnly");
      if (!input.candidateKey || !input.sourceChannel) throw new Error("candidateKey and sourceChannel are required");
      const observation = inspectResumeFile(path.resolve(input.file), { inboxRoot: config.inbox });
      if (observation.status !== "stable") return { ok: false, status: observation.status, reason: observation.reason };
      return { ok: true, result: store.archive(observation, { archiveRoot: config.archive,
        candidateKey: input.candidateKey, sourceChannel: input.sourceChannel,
        roleKey: input.roleKey ?? null, feishuJobId: job ?? null, allowUnmappedJobTalentOnly: input.talentOnly === true }) };
    }
    if (input.resumeSourceId && input.resumeSourceId !== config.resumeSourceId) throw new Error("input source differs from configured source");
    const common = { store, archiveRoot: config.archive, resumeSha256: String(input.resumeSha256 ?? ""),
      resumeSourceId: config.resumeSourceId, client, webBaseUrl: config.webBaseUrl };
    if (action === "reconcile") return { ok: true, result: await reconcileResumeUpload({ ...common, confirmedRef: flag("--confirmed-ref") }) };
    for (const key of ["candidateName", ...config.requiredCandidateFields]) {
      if (!String(input[key] ?? "").trim()) throw new Error(`required candidate field missing: ${key}`);
    }
    const planInput = { ...common, candidateName: input.candidateName,
      candidateMobile: input.candidateMobile ?? "", candidateEmail: input.candidateEmail ?? "",
      candidateMobileCode: input.candidateMobileCode ?? "", existingTalentId: input.existingTalentId ?? null,
      allowUnmappedJobTalentOnly: input.talentOnly === true };
    if (action === "prepare") {
      await verifyMapping(config, client);
      const record = store.get(common.resumeSha256);
      if (!record) throw new Error("resume intake record not found");
      if (input.talentOnly === true && record.feishu_job_id) throw new Error("this intake is already bound to a job; review its target before changing scope");
      if (record.feishu_job_id && !Object.values(config.jobs).includes(record.feishu_job_id)) throw new Error("intake job is not configured in this connection");
      const dedupeEvidence = await verifyResumeUploadDedupe({ ledger: store, client,
        candidateKey: record.candidate_key, roleKey: record.role_key, jobId: record.feishu_job_id,
        candidateName: input.candidateName, candidateMobile: input.candidateMobile, candidateEmail: input.candidateEmail,
        candidateMobileCode: input.candidateMobileCode, existingTalentId: input.existingTalentId });
      if (dedupeEvidence.status !== "passed") return { ok: false, mode: "needs_review", reason: dedupeEvidence.reason };
      const prepared = prepareResumeUpload({ ...planInput, dedupeEvidence });
      return { ok: true, mode: "confirmation_required", plan: prepared.publicPlan, expiresAt: prepared.expiresAt };
    }
    const confirmedRef = flag("--confirmed-ref");
    if (!confirmedRef) throw new Error("execute requires the authorized plan reference");
    return { ok: true, result: await executePreparedResumeUpload({ ...planInput, confirmedRef }) };
  } finally {
    store?.close(); closeSync(fd); unlinkSync(lock);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  main().then(result => {
    console.log(JSON.stringify(result, null, 2)); if (!result.ok) process.exitCode = 2;
  }).catch(error => {
    // Candidate input is never included in the error envelope.
    const argv = process.argv.slice(2), index = argv.indexOf("--config");
    const configFile = index < 0 ? ".runtime/feishu-hire/config.json" : argv[index + 1];
    let config = {};
    try { config = loadUploadConfig(configFile, { requireConnection: false }); } catch {}
    const onboarding = onboardingForError(error, { configFile, profile: config.profile, cliBin: config.cliBin, action: argv[0] });
    console.error(JSON.stringify({ ok: false, error: typeof error.code === "string" ? `local operation failed (${error.code})` : error.message, code: error.code ?? null,
      missingScopes: error.missingScopes ?? [], ...(onboarding ? { onboarding } : {}) })); process.exitCode = 1;
  });
}

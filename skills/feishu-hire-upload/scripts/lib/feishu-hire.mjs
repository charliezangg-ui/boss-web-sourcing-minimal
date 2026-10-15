import { spawn } from "node:child_process";
import path from "node:path";

export class FeishuHireError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "FeishuHireError";
    this.code = details.code ?? null;
    this.subtype = details.subtype ?? "";
    this.missingScopes = details.missingScopes ?? [];
    this.consoleUrl = details.consoleUrl ?? "";
  }
}

function envelope(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;
  try { return JSON.parse(text.slice(start)); } catch { return null; }
}

export class HireApiClient {
  constructor({ bin = "lark-cli", identity = "bot", profile = "", cwd = process.cwd(), transport = null, requestTimeoutMs = 30_000 } = {}) {
    Object.assign(this, { bin, identity, profile, cwd, transport, requestTimeoutMs });
  }

  request(method, apiPath, params = {}) {
    return this.rawRequest({ method, path: apiPath, params });
  }

  async rawRequest({ method, path: apiPath, params = {}, data, file = null, cwd = this.cwd, dryRun = false }) {
    if (this.transport) return this.transport({ method, path: apiPath, params, data, file, cwd, dryRun });
    const args = [...(this.profile ? ["--profile", this.profile] : []), "api", method, apiPath, "--as", this.identity, "--format", "json"];
    if (Object.keys(params).length) args.push("--params", JSON.stringify(params));
    if (data !== undefined) args.push("--data", "-");
    if (file) {
      if (!file.field || !file.path || path.isAbsolute(file.path) || file.path.split(/[\\/]/).includes("..")) {
        throw new FeishuHireError("multipart requires a safe relative file", { subtype: "unsafe_file_path" });
      }
      args.push("--file", `${file.field}=${file.path}`);
    }
    if (dryRun) args.push("--dry-run");
    return new Promise((resolve, reject) => {
      const child = spawn(this.bin, args, {
        cwd,
        env: { ...process.env, LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1", LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1" },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "", stderr = "", timedOut = false, killTimer;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        killTimer = setTimeout(() => child.kill("SIGKILL"), 1000);
        killTimer.unref();
      }, this.requestTimeoutMs);
      timer.unref();
      child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
      child.stdout.on("data", value => { stdout += value; });
      child.stderr.on("data", value => { stderr += value; });
      child.stdin.on("error", () => {});
      child.on("error", () => {
        clearTimeout(timer);
        reject(new FeishuHireError("lark-cli could not be started", { subtype: "cli_unavailable" }));
      });
      child.on("close", code => {
        clearTimeout(timer); clearTimeout(killTimer);
        if (timedOut) return reject(new FeishuHireError("Feishu Hire request timed out; verify write state before retry", { subtype: "timeout" }));
        const result = envelope(stdout);
        if (code === 0 && result?.ok === true) return resolve(result.data ?? {});
        const error = (envelope(stderr) ?? result)?.error ?? {};
        // Do not echo remote error bodies: they can contain candidate fields.
        const scopes = error.missing_scopes ?? (error.permission_violations ?? []).map(x => x.scope).filter(Boolean);
        reject(new FeishuHireError(`Feishu Hire request failed (${error.code ?? error.subtype ?? code ?? "invalid_response"})`, {
          code: error.code, subtype: error.subtype ?? error.type,
          missingScopes: scopes, consoleUrl: error.console_url,
        }));
      });
      child.stdin.end(data === undefined ? undefined : JSON.stringify(data));
    });
  }

  async paginate(apiPath, params = {}, pageSize = 100) {
    const output = [], seen = new Set(); let token = "";
    for (;;) {
      const page = await this.request("GET", apiPath, { ...params, page_size: pageSize, ...(token ? { page_token: token } : {}) });
      if (!Array.isArray(page.items)) throw new FeishuHireError("invalid list response");
      output.push(...page.items);
      if (!page.has_more) return output;
      token = String(page.page_token ?? "");
      if (!token || seen.has(token)) throw new FeishuHireError("pagination stalled");
      seen.add(token);
    }
  }

  listJobs() { return this.paginate("/open-apis/hire/v1/jobs", { user_id_type: "open_id" }, 20); }
  listResumeSources() { return this.paginate("/open-apis/hire/v1/resume_sources", {}, 100); }
  listApplicationIds({ activeStatus = "3", talentId, jobId } = {}) {
    return this.paginate("/open-apis/hire/v1/applications", { active_status: activeStatus, ...(talentId ? { talent_id: talentId } : {}), ...(jobId ? { job_id: jobId } : {}) }, 200);
  }
  getTalent(id) { return this.request("GET", `/open-apis/hire/v2/talents/${encodeURIComponent(id)}`, { user_id_type: "open_id" }); }
  getApplication(id) { return this.request("GET", `/open-apis/hire/v1/applications/${encodeURIComponent(id)}`, { user_id_type: "open_id" }); }
  async findTalentIds({ mobile = "", email = "", mobileCode = "" }) {
    if (!mobile && !email) throw new Error("verified phone or email is required for identity lookup");
    const data = await this.rawRequest({ method: "POST", path: "/open-apis/hire/v1/talents/batch_get_id", data: {
      ...(mobile ? { mobile_number_list: [mobile], ...(mobileCode ? { mobile_code: mobileCode } : {}) } : {}),
      ...(email ? { email_list: [email] } : {}),
    } });
    if (!Array.isArray(data.talent_list)) throw new FeishuHireError("identity lookup returned no verifiable list");
    return [...new Set(data.talent_list.map(item => String(item.talent_id ?? "")).filter(Boolean))];
  }
}

export { HireApiClient as FeishuHireClient };

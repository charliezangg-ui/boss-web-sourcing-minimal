import { createHash } from "node:crypto";
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".rtf", ".txt"]);
const MAX_RESUME_BYTES = 300 * 1024 * 1024;

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function assertInside(root, filePath) {
  const normalizedRoot = path.resolve(root);
  const normalizedFile = path.resolve(filePath);
  const relative = path.relative(normalizedRoot, normalizedFile);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("resume file must be inside the configured inbox");
  }
  return { normalizedRoot, normalizedFile, relative };
}

export function inspectResumeFile(filePath, {
  inboxRoot,
  now = Date.now(),
  minimumAgeMs = 30_000,
  maxBytes = MAX_RESUME_BYTES,
} = {}) {
  const { normalizedFile, relative } = assertInside(inboxRoot, filePath);
  const actualRelative = path.relative(realpathSync(inboxRoot), realpathSync(normalizedFile));
  if (!actualRelative || actualRelative.startsWith("..") || path.isAbsolute(actualRelative)) throw new Error("resume file escapes configured inbox");
  const linkStat = lstatSync(normalizedFile);
  if (linkStat.isSymbolicLink() || !linkStat.isFile()) {
    throw new Error("resume intake accepts regular files only");
  }
  const stat = statSync(normalizedFile);
  const extension = path.extname(normalizedFile).toLowerCase();
  let status = "stable";
  let reason = "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    status = "unsupported_file";
    reason = "extension_not_allowed";
  } else if (stat.size <= 0 || stat.size > maxBytes) {
    status = "file_too_large";
    reason = stat.size <= 0 ? "empty_file" : "exceeds_300mb";
  } else if (now - stat.mtimeMs < minimumAgeMs) {
    status = "unstable";
    reason = "minimum_stability_window_not_met";
  }
  return {
    status,
    reason,
    inboxRelativePath: relative,
    extension,
    bytes: stat.size,
    modifiedAt: new Date(stat.mtimeMs).toISOString(),
    sha256: status === "stable" ? sha256File(normalizedFile) : "",
    absolutePath: normalizedFile,
  };
}

export function isSameObservation(previous, current) {
  return Boolean(
    previous &&
      current &&
      previous.bytes === current.bytes &&
      previous.modifiedAt === current.modifiedAt &&
      previous.inboxRelativePath === current.inboxRelativePath,
  );
}

export function scanResumeInboxOnce({
  inboxRoot,
  archiveRoot,
  store,
  mappingsBySha256 = {},
  minimumAgeMs = 30_000,
  now = Date.now(),
}) {
  if (!(store instanceof ResumeIntakeStore)) {
    throw new Error("resume intake store is required");
  }
  const counts = {};
  const results = [];
  const entries = readdirSync(path.resolve(inboxRoot), {
    withFileTypes: true,
  }).sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (!entry.isFile() && !entry.isSymbolicLink()) {
      continue;
    }
    let status = "inspection_error";
    let result = { status };
    try {
      const observation = inspectResumeFile(
        path.join(path.resolve(inboxRoot), entry.name),
        { inboxRoot, minimumAgeMs, now },
      );
      if (observation.status !== "stable") {
        status = observation.status;
        result = {
          status,
          reason: observation.reason,
          bytes: observation.bytes,
        };
      } else {
        const mapping = mappingsBySha256[observation.sha256] ?? {};
        const archived = store.archive(observation, {
          archiveRoot,
          candidateKey: mapping.candidateKey ?? null,
          sourceChannel: mapping.sourceChannel ?? null,
          roleKey: mapping.roleKey ?? null,
          feishuJobId: mapping.feishuJobId ?? null,
          allowUnmappedJobTalentOnly:
            mapping.allowUnmappedJobTalentOnly === true,
        });
        status = archived.status;
        result = {
          status,
          resumeSha256: archived.resumeSha256,
          archiveRelativePath: archived.archiveRelativePath,
          duplicateDetected: archived.duplicateDetected,
          mappingComplete: archived.mappingComplete,
        };
      }
    } catch (error) {
      status = error.message.includes("regular files only")
        ? "rejected_file_type"
        : "inspection_error";
      result = { status };
    }
    counts[status] = (counts[status] ?? 0) + 1;
    results.push(result);
  }
  return {
    scanned: results.length,
    counts,
    results,
  };
}

export class ResumeIntakeStore {
  constructor(databasePath) {
    mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS resume_intake (
        resume_sha256 TEXT PRIMARY KEY,
        archive_relative_path TEXT NOT NULL,
        extension TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        candidate_key TEXT,
        source_channel TEXT,
        role_key TEXT,
        feishu_job_id TEXT,
        feishu_attachment_id TEXT,
        feishu_talent_id TEXT,
        feishu_application_id TEXT,
        status TEXT NOT NULL,
        error_code TEXT,
        observed_at TEXT NOT NULL,
        archived_at TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_resume_intake_candidate
        ON resume_intake(candidate_key, role_key, status);

      CREATE TABLE IF NOT EXISTS resume_upload_authorizations (
        confirmation_ref TEXT PRIMARY KEY,
        resume_sha256 TEXT NOT NULL,
        plan_fingerprint TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        authorized_at TEXT,
        completed_at TEXT,
        FOREIGN KEY(resume_sha256) REFERENCES resume_intake(resume_sha256)
      );

      CREATE INDEX IF NOT EXISTS idx_resume_upload_authorizations_resume
        ON resume_upload_authorizations(resume_sha256, status, expires_at);
    `);
    const columns = this.db.prepare("PRAGMA table_info(resume_upload_authorizations)").all();
    if (!columns.some(column => column.name === "plan_binding_json")) {
      this.db.exec("ALTER TABLE resume_upload_authorizations ADD COLUMN plan_binding_json TEXT");
    }
  }

  hasFile(resumeSha256) {
    return Boolean(
      this.db
        .prepare("SELECT 1 AS found FROM resume_intake WHERE resume_sha256 = ?")
        .get(resumeSha256),
    );
  }

  archive(observation, {
    archiveRoot,
    candidateKey = null,
    sourceChannel = null,
    roleKey = null,
    feishuJobId = null,
    allowUnmappedJobTalentOnly = false,
    copy = true,
    now = new Date(),
  } = {}) {
    if (observation.status !== "stable" || !observation.sha256) {
      throw new Error("only a stable resume observation can be archived");
    }
    if (candidateKey && !/^sha256:[a-f0-9]{64}$/.test(candidateKey)) {
      throw new Error("candidateKey must be a sha256 hash");
    }
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const relativePath = path.join(year, month, `${observation.sha256}${observation.extension}`);
    const destination = path.join(path.resolve(archiveRoot), relativePath);
    const timestamp = now.toISOString();
    const existing = this.get(observation.sha256);
    if (!existing && copy) {
      mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
      copyFileSync(observation.absolutePath, destination);
    }
    const mappingComplete = Boolean(
      candidateKey &&
      sourceChannel &&
      ((roleKey && feishuJobId) || allowUnmappedJobTalentOnly === true),
    );
    const status = existing
      ? existing.status === "needs_review" && mappingComplete
        ? "queued_for_upload"
        : existing.status
      : mappingComplete
        ? "queued_for_upload"
        : "needs_review";
    this.db
      .prepare(`
        INSERT INTO resume_intake (
          resume_sha256, archive_relative_path, extension, bytes,
          candidate_key, source_channel, role_key, feishu_job_id,
          status, observed_at, archived_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(resume_sha256) DO UPDATE SET
          candidate_key = COALESCE(resume_intake.candidate_key, excluded.candidate_key),
          source_channel = COALESCE(resume_intake.source_channel, excluded.source_channel),
          role_key = COALESCE(resume_intake.role_key, excluded.role_key),
          feishu_job_id = COALESCE(resume_intake.feishu_job_id, excluded.feishu_job_id),
          status = excluded.status,
          updated_at = excluded.updated_at
      `)
      .run(
        observation.sha256,
        relativePath,
        observation.extension,
        observation.bytes,
        candidateKey,
        sourceChannel,
        roleKey,
        feishuJobId,
        status,
        timestamp,
        existing ? null : timestamp,
        timestamp,
      );
    return {
      resumeSha256: observation.sha256,
      archiveRelativePath: relativePath,
      status,
      copied: !existing && copy,
      duplicateDetected: Boolean(existing),
      mappingComplete,
      jobAssociationMode: feishuJobId ? "linked" : "unmapped_talent_only",
    };
  }

  updateUploadState(resumeSha256, status, identifiers = {}, errorCode = null) {
    const allowed = new Set([
      "needs_review",
      "queued_for_upload",
      "attachment_created",
      "talent_resolved",
      "application_created",
      "uploaded_verified",
      "duplicate_application",
      "blocked_permission",
      "write_state_unknown",
    ]);
    if (!allowed.has(status)) {
      throw new Error(`unsupported resume upload status: ${status}`);
    }
    const result = this.db
      .prepare(`
        UPDATE resume_intake
        SET status = ?,
            feishu_attachment_id = COALESCE(?, feishu_attachment_id),
            feishu_talent_id = COALESCE(?, feishu_talent_id),
            feishu_application_id = COALESCE(?, feishu_application_id),
            error_code = ?,
            updated_at = ?
        WHERE resume_sha256 = ?
      `)
      .run(
        status,
        identifiers.attachmentId ?? null,
        identifiers.talentId ?? null,
        identifiers.applicationId ?? null,
        errorCode,
        new Date().toISOString(),
        resumeSha256,
      );
    if (result.changes !== 1) {
      throw new Error("resume intake record not found");
    }
  }

  prepareUploadAuthorization({
    resumeSha256,
    confirmationRef,
    planFingerprint,
    planBinding = null,
    expiresAt,
    now = new Date(),
  }) {
    if (!/^[a-f0-9]{64}$/.test(String(resumeSha256 ?? ""))) {
      throw new Error("resumeSha256 must be a sha256 hash");
    }
    if (!/^[a-f0-9]{16}$/.test(String(confirmationRef ?? ""))) {
      throw new Error("confirmationRef must be 16 lowercase hexadecimal characters");
    }
    if (!/^[a-f0-9]{64}$/.test(String(planFingerprint ?? ""))) {
      throw new Error("planFingerprint must be a sha256 hash");
    }
    const parsedExpiry = Date.parse(expiresAt);
    if (!Number.isFinite(parsedExpiry) || parsedExpiry <= now.getTime()) {
      throw new Error("upload authorization expiry must be in the future");
    }
    const resume = this.get(resumeSha256);
    if (!resume) {
      throw new Error("resume intake record not found");
    }
    if (
      ![
        "queued_for_upload",
        "attachment_created",
        "talent_resolved",
        "application_created",
        "blocked_permission",
      ].includes(resume.status)
    ) {
      throw new Error(`resume is not ready for upload authorization: ${resume.status}`);
    }
    this.db
      .prepare(`
        INSERT INTO resume_upload_authorizations (
          confirmation_ref, resume_sha256, plan_fingerprint, status,
          created_at, expires_at, plan_binding_json
        ) VALUES (?, ?, ?, 'pending', ?, ?, ?)
      `)
      .run(
        confirmationRef,
        resumeSha256,
        planFingerprint,
        now.toISOString(),
        new Date(parsedExpiry).toISOString(),
        planBinding ? JSON.stringify(planBinding) : null,
      );
  }

  claimUploadAuthorization({
    confirmationRef,
    resumeSha256,
    planFingerprint,
    now = new Date(),
  }) {
    const row = this.getUploadAuthorization(confirmationRef);
    if (!row) {
      throw new Error("upload authorization not found");
    }
    if (
      row.resume_sha256 !== resumeSha256 ||
      row.plan_fingerprint !== planFingerprint
    ) {
      throw new Error("upload authorization does not match the pinned plan");
    }
    if (Date.parse(row.expires_at) <= now.getTime()) {
      this.db
        .prepare(`
          UPDATE resume_upload_authorizations
          SET status = 'expired'
          WHERE confirmation_ref = ? AND status IN ('pending', 'executing')
        `)
        .run(confirmationRef);
      throw new Error("upload authorization has expired");
    }
    if (row.status === "completed") {
      throw new Error("upload authorization was already completed");
    }
    if (row.status === "pending") {
      const result = this.db
        .prepare(`
          UPDATE resume_upload_authorizations
          SET status = 'executing', authorized_at = ?
          WHERE confirmation_ref = ? AND status = 'pending'
        `)
        .run(now.toISOString(), confirmationRef);
      if (result.changes !== 1) {
        throw new Error("upload authorization could not be claimed");
      }
      return { resumed: false };
    }
    if (row.status === "executing") {
      return { resumed: true };
    }
    throw new Error(`upload authorization is not executable: ${row.status}`);
  }

  completeUploadAuthorization(confirmationRef, now = new Date()) {
    const result = this.db
      .prepare(`
        UPDATE resume_upload_authorizations
        SET status = 'completed', completed_at = ?
        WHERE confirmation_ref = ? AND status = 'executing'
      `)
      .run(now.toISOString(), confirmationRef);
    if (result.changes !== 1) {
      throw new Error("upload authorization is not executing");
    }
  }

  getUploadAuthorization(confirmationRef) {
    return (
      this.db
        .prepare(`
          SELECT confirmation_ref, resume_sha256, plan_fingerprint, status,
                 created_at, expires_at, authorized_at, completed_at, plan_binding_json
          FROM resume_upload_authorizations
          WHERE confirmation_ref = ?
        `)
        .get(confirmationRef) ?? null
    );
  }

  get(resumeSha256) {
    return (
      this.db
        .prepare(`
          SELECT resume_sha256, archive_relative_path, extension, bytes,
                 candidate_key, source_channel, role_key, feishu_job_id,
                 feishu_attachment_id, feishu_talent_id, feishu_application_id,
                 status, error_code, observed_at, archived_at, updated_at
          FROM resume_intake
          WHERE resume_sha256 = ?
        `)
        .get(resumeSha256) ?? null
    );
  }

  bindConnection(profile) {
    this.db.exec("CREATE TABLE IF NOT EXISTS resume_upload_connection (singleton INTEGER PRIMARY KEY CHECK(singleton=1), profile TEXT NOT NULL)");
    const row = this.db.prepare("SELECT profile FROM resume_upload_connection WHERE singleton=1").get();
    if (row && row.profile !== profile) throw new Error("upload database belongs to a different connection; use a separate database");
    this.db.prepare("INSERT OR IGNORE INTO resume_upload_connection VALUES (1, ?)").run(profile);
  }

  listCandidateEvents(candidateKey) {
    return this.db.prepare(`SELECT resume_sha256, feishu_talent_id, feishu_application_id, feishu_job_id, status
      FROM resume_intake WHERE candidate_key = ? AND feishu_talent_id IS NOT NULL`).all(candidateKey).map(row => ({
        event_type: row.status === "uploaded_verified" ? "uploaded_to_feishu" : "upload_checkpoint",
        metadata: { resumeSha256: row.resume_sha256, feishuTalentId: row.feishu_talent_id,
          feishuApplicationId: row.feishu_application_id, feishuJobId: row.feishu_job_id },
      }));
  }

  close() {
    this.db.close();
  }
}

export { ALLOWED_EXTENSIONS, MAX_RESUME_BYTES };

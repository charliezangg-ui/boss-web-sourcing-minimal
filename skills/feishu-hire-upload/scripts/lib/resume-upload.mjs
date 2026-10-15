import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildResumeUploadPlan,
  executeConfirmedPlan,
  publicOperationPlan,
} from "./feishu-hire-operations.mjs";
import {
  createFeishuHirePlanTransport,
  safeArchiveFile,
} from "./feishu-hire-executor.mjs";
import { FeishuHireError } from "./feishu-hire.mjs";
import { buildFeishuHireTalentUrl } from "./feishu-hire-links.mjs";
import { ResumeIntakeStore } from "./resume-intake.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function resumeUploadPlanFingerprint(plan) {
  const contract = {
    schemaVersion: plan.schemaVersion,
    kind: plan.kind,
    summary: plan.summary,
    operations: plan.operations,
    readbacks: plan.readbacks,
  };
  return sha256(JSON.stringify(canonicalize(contract)));
}

function assertStore(store) {
  if (!(store instanceof ResumeIntakeStore)) {
    throw new Error("resume intake store is required");
  }
}

function assertArchivedResume(record, archiveRoot) {
  const file = safeArchiveFile(archiveRoot, record.archive_relative_path);
  const actualSha256 = sha256(readFileSync(file.absolutePath));
  if (actualSha256 !== record.resume_sha256) {
    throw new Error("archived resume hash does not match the intake record");
  }
  return file;
}

export function buildResumeUploadPlanFromStore({
  store,
  resumeSha256,
  archiveRoot,
  candidateName,
  candidateMobile = "",
  candidateEmail = "",
  candidateMobileCode = "",
  existingApplicationId = null,
  resumeSourceId,
  existingTalentId = null,
  dedupeVerified = false,
  allowUnmappedJobTalentOnly = false,
  skipApplicationCreation = false,
  confirmationRef = "",
}) {
  assertStore(store);
  const record = store.get(resumeSha256);
  if (!record) {
    throw new Error("resume intake record not found");
  }
  if (!record.candidate_key || !record.source_channel) {
    throw new Error("resume candidate and source are required");
  }
  if (!record.feishu_job_id && allowUnmappedJobTalentOnly !== true) {
    throw new Error("Feishu job mapping is required unless talent-only upload is explicitly allowed");
  }
  if (record.status === "write_state_unknown") {
    throw new Error("resume write state is unknown and must be reconciled before retry");
  }
  if (record.status === "uploaded_verified") {
    throw new Error("resume was already uploaded and verified");
  }
  if (
    record.feishu_talent_id &&
    existingTalentId &&
    record.feishu_talent_id !== existingTalentId
  ) {
    throw new Error("existing talent does not match the upload checkpoint");
  }
  assertArchivedResume(record, archiveRoot);
  return buildResumeUploadPlan({
    candidateKey: record.candidate_key,
    resumeSha256: record.resume_sha256,
    archiveRelativePath: record.archive_relative_path,
    jobId: record.feishu_job_id,
    resumeSourceId,
    candidateName,
    candidateMobile,
    candidateEmail,
    candidateMobileCode,
    existingApplicationId,
    existingTalentId,
    dedupeVerified,
    allowUnmappedJobTalentOnly,
    skipApplicationCreation,
    confirmationRef,
  });
}

export function prepareResumeUpload({
  store,
  dedupeEvidence,
  expiresInMs = 15 * 60 * 1000,
  now = new Date(),
  ...planInput
}) {
  if (dedupeEvidence?.status !== "passed") {
    throw new Error("verified cross-channel and Feishu dedupe evidence is required");
  }
  const record = store.get(planInput.resumeSha256);
  const binding = {
    existingTalentId: dedupeEvidence.existingTalentId ?? planInput.existingTalentId ?? null,
    skipApplicationCreation: dedupeEvidence.existingJobAssociation === true || planInput.skipApplicationCreation === true,
    existingApplicationId: dedupeEvidence.existingApplicationId ?? record?.feishu_application_id ?? null,
    allowUnmappedJobTalentOnly: planInput.allowUnmappedJobTalentOnly === true,
    resumeSourceId: planInput.resumeSourceId,
    jobId: record?.feishu_job_id ?? null,
  };
  if (binding.skipApplicationCreation && (!binding.existingTalentId || !binding.existingApplicationId)) {
    throw new Error("existing job association requires verified talent and application IDs");
  }
  const plan = buildResumeUploadPlanFromStore({ store, ...planInput, ...binding, dedupeVerified: true });
  const fingerprint = resumeUploadPlanFingerprint(plan);
  const expiresAt = new Date(now.getTime() + expiresInMs).toISOString();
  store.prepareUploadAuthorization({
    resumeSha256: plan.summary.resumeSha256,
    confirmationRef: plan.confirmationRef,
    planFingerprint: fingerprint,
    planBinding: binding,
    expiresAt,
    now,
  });
  return {
    plan,
    fingerprint,
    expiresAt,
    publicPlan: publicOperationPlan(plan),
  };
}

function checkpointState(record) {
  const results = {};
  const skipOperationKeys = [];
  if (record.feishu_attachment_id) {
    results.attachment = { id: record.feishu_attachment_id };
    skipOperationKeys.push("attachment");
  }
  if (record.feishu_talent_id) {
    results.talent = { talent_id: record.feishu_talent_id };
    skipOperationKeys.push("talent");
  }
  if (record.feishu_application_id) {
    results.application = { id: record.feishu_application_id };
    skipOperationKeys.push("application");
  }
  return { results, skipOperationKeys };
}

function talentReadback(execution) {
  return execution.readbacks.find(
    (response) => response?.talent_id && Array.isArray(response?.resume_attachment_list),
  );
}

function resolveFormalResumeAttachment(talent, archiveRelativePath) {
  const expectedName = path.basename(archiveRelativePath);
  const matches = (talent?.resume_attachment_list ?? []).filter(
    (attachment) =>
      String(attachment?.name ?? "") === expectedName &&
      String(attachment?.id ?? ""),
  );
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one formal resume attachment named ${expectedName}, found ${matches.length}`,
    );
  }
  return { id: String(matches[0].id), name: expectedName };
}

async function verifyFormalResumeAttachment({
  operationTransport,
  talent,
  archiveRelativePath,
}) {
  const formal = resolveFormalResumeAttachment(talent, archiveRelativePath);
  const response = await operationTransport({
    method: "GET",
    path: `/open-apis/hire/v1/attachments/${encodeURIComponent(formal.id)}`,
  });
  if (
    String(response?.attachment?.id ?? "") !== formal.id ||
    String(response?.attachment?.name ?? "") !== formal.name
  ) {
    throw new Error("formal resume attachment readback mismatch");
  }
  return { formal, response };
}

function recordVerifiedUpload({ ledger, record, attachmentId }) {
  if (typeof ledger?.recordCandidateEvent !== "function") {
    return;
  }
  const alreadyRecorded = ledger
    .listCandidateEvents(record.candidate_key)
    .some(
      (event) =>
        event.event_type === "uploaded_to_feishu" &&
        String(event.metadata?.resumeSha256 ?? "") ===
          String(record.resume_sha256 ?? ""),
    );
  if (alreadyRecorded) {
    return;
  }
  ledger.recordCandidateEvent({
    candidateKey: record.candidate_key,
    channel: "feishu_hire",
    eventType: "uploaded_to_feishu",
    role: record.role_key || "unmapped",
    metadata: {
      resumeSha256: record.resume_sha256,
      sourceChannel: record.source_channel,
      feishuAttachmentId: attachmentId,
      feishuTalentId: record.feishu_talent_id,
      feishuApplicationId: record.feishu_application_id,
      feishuJobId: record.feishu_job_id,
    },
  });
}

export async function executePreparedResumeUpload({
  store,
  archiveRoot,
  confirmedRef,
  client,
  transport = null,
  ledger = null,
  webBaseUrl = "",
  ...planInput
}) {
  const authorization = store.getUploadAuthorization(confirmedRef);
  const binding = authorization?.plan_binding_json ? JSON.parse(authorization.plan_binding_json) : null;
  if (binding) {
    for (const key of ["existingTalentId", "resumeSourceId"]) {
      if (planInput[key] && planInput[key] !== binding[key]) throw new Error("input does not match the pinned plan");
    }
    const record = store.get(planInput.resumeSha256);
    if (String(record?.feishu_job_id ?? "") !== String(binding.jobId ?? "")) throw new Error("job does not match the pinned plan");
  }
  const plan = buildResumeUploadPlanFromStore({ store, archiveRoot, ...planInput,
    ...(binding ?? {}), confirmationRef: confirmedRef, dedupeVerified: true });
  const fingerprint = resumeUploadPlanFingerprint(plan);
  store.claimUploadAuthorization({
    confirmationRef: confirmedRef,
    resumeSha256: plan.summary.resumeSha256,
    planFingerprint: fingerprint,
  });
  const record = store.get(plan.summary.resumeSha256);
  const checkpoint = checkpointState(record);
  if (binding?.existingApplicationId) checkpoint.results.application = { id: binding.existingApplicationId };
  const operationTransport =
    transport ??
    createFeishuHirePlanTransport({
      client,
      archiveRoot,
    });
  try {
    const execution = await executeConfirmedPlan(plan, {
      confirmedRef,
      transport: async operation => {
        if (operation.method !== "GET") store.updateUploadState(plan.summary.resumeSha256, "write_state_unknown");
        return operationTransport(operation);
      },
      initialResults: checkpoint.results,
      skipOperationKeys: checkpoint.skipOperationKeys,
      onOperationComplete(operation, result) {
        if (operation.key === "attachment") {
          if (!result?.id) {
            throw new Error("attachment write returned no id");
          }
          store.updateUploadState(
            plan.summary.resumeSha256,
            "attachment_created",
            { attachmentId: result.id },
          );
        } else if (operation.key === "talent") {
          if (!result?.talent_id) {
            throw new Error("talent write returned no talent_id");
          }
          store.updateUploadState(
            plan.summary.resumeSha256,
            "talent_resolved",
            { talentId: result.talent_id },
          );
        } else if (operation.key === "application") {
          if (!result?.id) {
            throw new Error("application write returned no id");
          }
          store.updateUploadState(
            plan.summary.resumeSha256,
            "application_created",
            { applicationId: result.id },
          );
        }
      },
    });
    const applicationId = execution.results.application?.id ?? record.feishu_application_id ?? null;
    if (record.feishu_job_id && !applicationId) throw new Error("mapped job application remains unverified");
    const talent = talentReadback(execution);
    if (!talent) {
      throw new Error("talent readback did not include resume attachments");
    }
    const verifiedAttachment = await verifyFormalResumeAttachment({
      operationTransport,
      talent,
      archiveRelativePath: record.archive_relative_path,
    });
    execution.readbacks.push(verifiedAttachment.response);
    store.updateUploadState(
      plan.summary.resumeSha256,
      "uploaded_verified",
      {
        attachmentId: verifiedAttachment.formal.id,
        talentId: execution.results.talent.talent_id,
        applicationId,
      },
    );
    store.completeUploadAuthorization(confirmedRef);
    const finalRecord = store.get(plan.summary.resumeSha256);
    recordVerifiedUpload({
      ledger,
      record: finalRecord,
      attachmentId: verifiedAttachment.formal.id,
    });
    return {
      status: "uploaded_verified",
      resumeSha256: plan.summary.resumeSha256,
      attachmentId: verifiedAttachment.formal.id,
      talentId: execution.results.talent.talent_id,
      applicationId,
      jobAssociated: plan.summary.jobAssociation !== "unmapped_talent_only",
      candidateUrl: buildFeishuHireTalentUrl({
        webBaseUrl,
        talentId: execution.results.talent.talent_id,
        applicationId,
      }),
      readbackCount: execution.readbacks.length,
    };
  } catch (error) {
    const status =
      error instanceof FeishuHireError && error.missingScopes.length > 0
        ? "blocked_permission"
        : "write_state_unknown";
    store.updateUploadState(
      plan.summary.resumeSha256,
      status,
      {},
      error instanceof FeishuHireError
        ? String(error.subtype || error.code || "feishu_hire_error")
        : "execution_error",
    );
    throw error;
  }
}

export async function reconcileResumeUpload({
  store,
  archiveRoot,
  resumeSha256,
  resumeSourceId,
  confirmedRef = "",
  client,
  transport = null,
  ledger = null,
  webBaseUrl = "",
}) {
  assertStore(store);
  const record = store.get(resumeSha256);
  if (!record) {
    throw new Error("resume intake record not found");
  }
  if (record.status !== "write_state_unknown") {
    throw new Error(`resume does not require reconciliation: ${record.status}`);
  }
  if (!record.feishu_talent_id) {
    throw new Error("reconciliation requires a talent checkpoint");
  }
  assertArchivedResume(record, archiveRoot);
  const operationTransport =
    transport ?? createFeishuHirePlanTransport({ client, archiveRoot });
  const authorization = confirmedRef ? store.getUploadAuthorization(confirmedRef) : null;
  if (authorization && authorization.resume_sha256 !== resumeSha256) throw new Error("reconciliation authorization mismatch");
  const binding = authorization?.plan_binding_json ? JSON.parse(authorization.plan_binding_json) : null;
  if (binding && (String(binding.jobId ?? "") !== String(record.feishu_job_id ?? "") || binding.resumeSourceId !== resumeSourceId)) {
    throw new Error("reconciliation does not match the pinned plan");
  }
  let applicationId = record.feishu_application_id ?? binding?.existingApplicationId ?? null;
  if (record.feishu_job_id && !applicationId) {
    const ids = []; const seen = new Set(); let token = "";
    for (;;) {
      const page = await operationTransport({ method: "GET", path: "/open-apis/hire/v1/applications",
        params: { active_status: "3", talent_id: record.feishu_talent_id, job_id: record.feishu_job_id,
          page_size: 200, ...(token ? { page_token: token } : {}) } });
      if (!Array.isArray(page.items)) throw new Error("application state remains unknown: invalid lookup response");
      ids.push(...page.items.map(item => String(typeof item === "object" ? item.id : item)));
      if (!page.has_more) break;
      token = String(page.page_token ?? "");
      if (!token || seen.has(token)) throw new Error("application lookup pagination stalled");
      seen.add(token);
    }
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length !== 1) throw new Error("application state remains unknown: expected one matching application");
    applicationId = unique[0];
  }
  if (!record.feishu_job_id && binding && !binding.allowUnmappedJobTalentOnly) {
    throw new Error("talent-only upload was not authorized");
  }
  const applicationData = applicationId ? await operationTransport({ method: "GET",
    path: `/open-apis/hire/v1/applications/${encodeURIComponent(applicationId)}`, params: { user_id_type: "open_id" } }) : null;
  const talent = await operationTransport({ method: "GET",
    path: `/open-apis/hire/v2/talents/${encodeURIComponent(record.feishu_talent_id)}`, params: { user_id_type: "open_id" } });
  if (applicationId) {
    const application = applicationData?.application;
    if (String(application?.id ?? "") !== String(applicationId) ||
        String(application?.talent_id ?? "") !== String(record.feishu_talent_id) ||
        String(application?.job_id ?? "") !== String(record.feishu_job_id) ||
        (!binding?.skipApplicationCreation && String(application?.resume_source_id ?? "") !== String(resumeSourceId)) ||
        !application?.stage) throw new Error("application reconciliation readback mismatch");
  }
  if (String(talent?.talent_id ?? "") !== String(record.feishu_talent_id)) {
    throw new Error("talent reconciliation readback mismatch");
  }
  const verifiedAttachment = await verifyFormalResumeAttachment({
    operationTransport,
    talent,
    archiveRelativePath: record.archive_relative_path,
  });
  store.updateUploadState(resumeSha256, "uploaded_verified", {
    attachmentId: verifiedAttachment.formal.id,
    talentId: record.feishu_talent_id,
    applicationId,
  });
  if (confirmedRef) {
    const authorization = store.getUploadAuthorization(confirmedRef);
    if (authorization?.status === "executing") {
      store.completeUploadAuthorization(confirmedRef);
    }
  }
  const finalRecord = store.get(resumeSha256);
  recordVerifiedUpload({
    ledger,
    record: finalRecord,
    attachmentId: verifiedAttachment.formal.id,
  });
  return {
    status: "uploaded_verified",
    resumeSha256,
    attachmentId: verifiedAttachment.formal.id,
    talentId: record.feishu_talent_id,
    applicationId,
    jobAssociated: Boolean(applicationId),
    candidateUrl: buildFeishuHireTalentUrl({
      webBaseUrl,
      talentId: record.feishu_talent_id,
      applicationId,
    }),
    readbackCount: applicationId ? 3 : 2,
  };
}

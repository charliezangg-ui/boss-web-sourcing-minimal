import { createHash, randomBytes } from "node:crypto";

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function confirmationRef() {
  return randomBytes(8).toString("hex");
}

function assertCandidateKey(value) {
  if (!/^sha256:[a-f0-9]{64}$/.test(String(value ?? ""))) {
    throw new Error("candidateKey must be a sha256 hash");
  }
}

function basePlan(
  kind,
  summary,
  operations,
  readbacks,
  requestedConfirmationRef = "",
) {
  if (
    requestedConfirmationRef &&
    !/^[a-f0-9]{16}$/.test(requestedConfirmationRef)
  ) {
    throw new Error("confirmationRef must be 16 lowercase hexadecimal characters");
  }
  return {
    schemaVersion: 1,
    kind,
    confirmationRef: requestedConfirmationRef || confirmationRef(),
    summary,
    operations,
    readbacks,
    status: "confirmation_required",
  };
}

export function buildResumeUploadPlan({
  candidateKey,
  resumeSha256,
  archiveRelativePath,
  jobId,
  resumeSourceId,
  candidateName,
  candidateMobile = "",
  candidateEmail = "",
  candidateMobileCode = "",
  existingApplicationId = null,
  existingTalentId = null,
  dedupeVerified = false,
  allowUnmappedJobTalentOnly = false,
  skipApplicationCreation = false,
  confirmationRef: requestedConfirmationRef = "",
}) {
  assertCandidateKey(candidateKey);
  if (!/^[a-f0-9]{64}$/.test(String(resumeSha256 ?? ""))) {
    throw new Error("resumeSha256 is required");
  }
  if (!archiveRelativePath || !resumeSourceId || !candidateName) {
    throw new Error("archive path, source, and candidate name are required");
  }
  const hasJobMapping = Boolean(String(jobId ?? "").trim());
  if (!hasJobMapping && allowUnmappedJobTalentOnly !== true) {
    throw new Error("job mapping is required unless talent-only upload is explicitly allowed");
  }
  if (!dedupeVerified) {
    throw new Error("cross-channel and Feishu dedupe must be verified first");
  }
  const basicInfo = { name: candidateName,
    ...(candidateMobile ? { mobile: candidateMobile, ...(candidateMobileCode ? { mobile_code: candidateMobileCode } : {}) } : {}),
    ...(candidateEmail ? { email: candidateEmail } : {}),
  };
  const operations = [
    {
      key: "attachment",
      method: "POST",
      path: "/open-apis/hire/v1/attachments",
      multipart: { content: archiveRelativePath },
      scope: "hire:attachment",
    },
  ];
  if (!existingTalentId) {
    operations.push({
      key: "talent",
      method: "POST",
      path: "/open-apis/hire/v1/talents/combined_create",
      params: { user_id_type: "open_id" },
      data: {
        resume_source_id: resumeSourceId,
        resume_attachment_id: "$attachment.id",
        basic_info: basicInfo,
      },
      scope: "hire:talent",
    });
  } else {
    operations.push({
      key: "talent",
      method: "POST",
      path: "/open-apis/hire/v1/talents/combined_update",
      params: { user_id_type: "open_id" },
      data: {
        talent_id: existingTalentId,
        resume_attachment_id: "$attachment.id",
        basic_info: basicInfo,
      },
      scope: "hire:talent",
    });
  }
  if (hasJobMapping && !skipApplicationCreation) {
    operations.push({
      key: "application",
      method: "POST",
      path: "/open-apis/hire/v1/applications",
      params: { user_id_type: "open_id" },
      data: {
        talent_id: "$talent.talent_id",
        job_id: jobId,
        resume_source_id: resumeSourceId,
        delivery_type: 1,
      },
      scope: "hire:application",
    });
  }
  const readbacks = [];
  if (hasJobMapping && (!skipApplicationCreation || existingApplicationId)) {
    readbacks.push({
      method: "GET",
      path: "/open-apis/hire/v1/applications/$application.id",
      params: { user_id_type: "open_id" },
      verify: [
        { field: "application.talent_id", equals: "$talent.talent_id" },
        { field: "application.job_id", equals: jobId },
        ...(!skipApplicationCreation ? [{ field: "application.resume_source_id", equals: resumeSourceId }] : []),
        "application.stage",
      ],
    });
  }
  readbacks.push({
    method: "GET",
    path: "/open-apis/hire/v2/talents/$talent.talent_id",
    params: { user_id_type: "open_id" },
    verify: [
      { field: "talent_id", equals: "$talent.talent_id" },
      "resume_attachment_id_list",
      "resume_attachment_list",
    ],
  });
  return basePlan(
    "resume_upload",
    {
      candidateKey,
      resumeSha256,
      archivePathHash: sha256(archiveRelativePath),
      jobId: hasJobMapping ? jobId : null,
      jobAssociation: !hasJobMapping
        ? "unmapped_talent_only"
        : skipApplicationCreation
          ? "already_linked"
          : "linked",
      resumeSourceId,
      existingTalent: Boolean(existingTalentId),
      existingTalentIdHash: existingTalentId ? sha256(existingTalentId) : "",
      candidateNamePresent: true,
      candidateNameSha256: sha256(candidateName),
      candidateFieldsSha256: sha256(JSON.stringify(basicInfo)),
    },
    operations,
    readbacks,
    requestedConfirmationRef,
  );
}

export function publicOperationPlan(plan) {
  return {
    schemaVersion: plan.schemaVersion,
    kind: plan.kind,
    confirmationRef: plan.confirmationRef,
    summary: plan.summary,
    status: plan.status,
    operations: plan.operations.map((operation) => ({
      key: operation.key,
      method: operation.method,
      path: operation.path,
      surface: operation.surface,
      action: operation.action,
      scope: operation.scope,
    })),
    readbacks: plan.readbacks,
  };
}

export async function executeConfirmedPlan(plan, {
  confirmedRef,
  transport,
  initialResults = {},
  skipOperationKeys = [],
  onOperationComplete = null,
  onReadbackComplete = null,
  readbackAttempts = 3,
  readbackDelayMs = 500,
}) {
  if (plan.status !== "confirmation_required" || confirmedRef !== plan.confirmationRef) {
    throw new Error("operation plan requires its exact one-time confirmation reference");
  }
  if (typeof transport !== "function") {
    throw new Error("transport is required");
  }
  if (
    !Number.isInteger(readbackAttempts) ||
    readbackAttempts < 1 ||
    readbackAttempts > 5
  ) {
    throw new Error("readbackAttempts must be an integer between 1 and 5");
  }
  const results = { ...initialResults };
  const skipped = new Set(skipOperationKeys);
  for (const operation of plan.operations) {
    if (skipped.has(operation.key)) {
      if (!results[operation.key]) {
        throw new Error(`skipped operation is missing checkpoint result: ${operation.key}`);
      }
      continue;
    }
    const resolvedOperation = resolvePlanReferences(operation, results);
    results[operation.key] = await transport(resolvedOperation, results);
    if (onOperationComplete) {
      await onOperationComplete(operation, results[operation.key], results);
    }
  }
  const readbacks = [];
  for (let index = 0; index < plan.readbacks.length; index += 1) {
    const readback = resolvePlanReferences(plan.readbacks[index], results);
    let response;
    let lastError;
    for (let attempt = 0; attempt < readbackAttempts; attempt += 1) {
      try {
        response = await transport(readback, results);
        verifyReadback(readback, response, results);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (attempt + 1 < readbackAttempts) {
          await new Promise((resolve) => setTimeout(resolve, readbackDelayMs));
        }
      }
    }
    if (lastError) {
      throw lastError;
    }
    readbacks.push(response);
    if (onReadbackComplete) {
      await onReadbackComplete(index, readback, response, results);
    }
  }
  return { status: "completed_verified", results, readbacks };
}

function valueAtPath(value, dottedPath) {
  return String(dottedPath)
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => current?.[key], value);
}

function resolveReference(reference, results) {
  const match = String(reference).match(/^\$([a-zA-Z0-9_-]+)(?:\.(.+))?$/);
  if (!match) {
    return reference;
  }
  const root = results[match[1]];
  const resolved = match[2] ? valueAtPath(root, match[2]) : root;
  if (resolved === undefined || resolved === null) {
    throw new Error(`unresolved operation reference: ${reference}`);
  }
  return resolved;
}

export function resolvePlanReferences(value, results) {
  if (Array.isArray(value)) {
    return value.map((item) => resolvePlanReferences(item, results));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolvePlanReferences(item, results),
      ]),
    );
  }
  if (typeof value !== "string" || !value.includes("$")) {
    return value;
  }
  if (/^\$[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_.-]+)?$/.test(value)) {
    return resolveReference(value, results);
  }
  return value.replace(
    /\$([a-zA-Z0-9_-]+)(?:\.([a-zA-Z0-9_.-]+))?/g,
    (match) => String(resolveReference(match, results)),
  );
}

function verifyReadback(readback, response, results) {
  for (const rule of readback.verify ?? []) {
    if (typeof rule === "string") {
      const actual = valueAtPath(response, rule);
      if (
        actual === undefined ||
        actual === null ||
        (Array.isArray(actual) && actual.length === 0)
      ) {
        throw new Error(`readback field missing: ${rule}`);
      }
      continue;
    }
    const actual = valueAtPath(response, rule.field);
    if (Object.hasOwn(rule, "equals")) {
      const expected = resolvePlanReferences(rule.equals, results);
      if (String(actual) !== String(expected)) {
        throw new Error(`readback mismatch: ${rule.field}`);
      }
    } else if (Object.hasOwn(rule, "includes")) {
      const expected = resolvePlanReferences(rule.includes, results);
      if (!Array.isArray(actual) || !actual.map(String).includes(String(expected))) {
        throw new Error(`readback membership mismatch: ${rule.field}`);
      }
    }
  }
}

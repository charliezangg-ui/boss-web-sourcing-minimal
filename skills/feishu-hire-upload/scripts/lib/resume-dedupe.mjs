import { FeishuHireClient } from "./feishu-hire.mjs";

function normalizedName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizedMobile(value) {
  return String(value ?? "").replace(/\D+/g, "");
}

function normalizedEmail(value) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase();
}

function talentId(talent) {
  return String(talent?.talent_id ?? talent?.id ?? "");
}

function contactComparison(talent, { mobile, email }) {
  const basic = talent?.basic_info ?? {};
  const comparisons = [];
  const talentMobile = normalizedMobile(basic.mobile);
  const talentEmail = normalizedEmail(basic.email);
  if (mobile && talentMobile) {
    comparisons.push(mobile === talentMobile);
  }
  if (email && talentEmail) {
    comparisons.push(email === talentEmail);
  }
  return {
    comparable: comparisons.length > 0,
    exact: comparisons.length > 0 && comparisons.every(Boolean),
  };
}

function talentName(talent) {
  const name = talent?.basic_info?.name;
  if (typeof name === "string") {
    return name;
  }
  return String(
    name?.zh_cn ??
      name?.en_us ??
      "",
  );
}

export async function verifyResumeUploadDedupe({
  ledger,
  client = new FeishuHireClient({ identity: "bot" }),
  candidateKey,
  roleKey,
  jobId,
  candidateName,
  candidateMobile = "",
  candidateEmail = "",
  candidateMobileCode = "",
  existingTalentId = null,
  talentsSnapshot = null,
}) {
  if (typeof ledger?.listCandidateEvents !== "function") {
    throw new Error("candidate event ledger is required");
  }
  const events = ledger.listCandidateEvents(candidateKey);
  const ledgerTalentIds = events
    .map((event) => String(event.metadata?.feishuTalentId ?? ""))
    .filter(Boolean);
  const uniqueLedgerTalentIds = [...new Set(ledgerTalentIds)];
  if (
    existingTalentId &&
    uniqueLedgerTalentIds.length > 0 &&
    !uniqueLedgerTalentIds.includes(existingTalentId)
  ) {
    return {
      status: "needs_review",
      reason: "existing_talent_conflicts_with_candidate_ledger",
      ledgerEventsChecked: events.length,
      activeApplicationsFound: null,
      matchingTalentsFound: uniqueLedgerTalentIds.length,
      existingTalentId: null,
      checkedAt: new Date().toISOString(),
    };
  }
  const resolvedTalentId =
    existingTalentId ??
    (uniqueLedgerTalentIds.length === 1 ? uniqueLedgerTalentIds[0] : null);
  if (uniqueLedgerTalentIds.length > 1) {
    return {
      status: "needs_review",
      reason: "multiple_feishu_talents_in_candidate_ledger",
      ledgerEventsChecked: events.length,
      activeApplicationsFound: null,
      matchingTalentsFound: uniqueLedgerTalentIds.length,
      existingTalentId: null,
      checkedAt: new Date().toISOString(),
    };
  }

  if (resolvedTalentId) {
    const [talentData, sameJobApplicationIds] = await Promise.all([
      client.getTalent(resolvedTalentId),
      jobId
        ? client.listApplicationIds({
            // `3` means all applications. Existing applications are reused;
            // a newly received resume updates the talent attachment without
            // creating a duplicate application.
            activeStatus: "3",
            talentId: resolvedTalentId,
            jobId,
          })
        : Promise.resolve([]),
    ]);
    if (sameJobApplicationIds.length > 1) return { status: "needs_review", reason: "multiple_same_job_applications", existingTalentId: null };
    // Hire v2 returns the talent fields directly under `data`; tolerate the
    // legacy wrapped fixture shape as well.
    const resolvedName = talentName(talentData?.talent ?? talentData);
    if (
      resolvedName &&
      normalizedName(resolvedName) !== normalizedName(candidateName)
    ) {
      return {
        status: "needs_review",
        reason: "existing_talent_name_mismatch",
        ledgerEventsChecked: events.length,
        activeApplicationsFound: null,
        sameJobApplicationsFound: sameJobApplicationIds.length,
        matchingTalentsFound: 1,
        existingTalentId: null,
        checkedAt: new Date().toISOString(),
      };
    }
    return {
      status: "passed",
      reason:
        !jobId
          ? "existing_talent_reused_without_job_mapping"
          : sameJobApplicationIds.length > 0
            ? "existing_job_application_reused_for_new_resume"
            : "existing_talent_has_no_application_history_for_job",
      ledgerEventsChecked: events.length,
      activeApplicationsFound: null,
      sameJobApplicationsFound: sameJobApplicationIds.length,
      matchingTalentsFound: 1,
      existingTalentId: resolvedTalentId,
      existingJobAssociation: sameJobApplicationIds.length > 0,
      existingApplicationId: sameJobApplicationIds[0] ?? null,
      checkedAt: new Date().toISOString(),
    };
  }

  if (!Array.isArray(talentsSnapshot)) {
    if ((!candidateMobile && !candidateEmail) || typeof client.findTalentIds !== "function") {
      return { status: "needs_review", reason: "verified_talent_id_or_contact_required",
        existingTalentId: null, ledgerEventsChecked: events.length };
    }
    const ids = await client.findTalentIds({ mobile: normalizedMobile(candidateMobile),
      email: normalizedEmail(candidateEmail), mobileCode: candidateMobileCode });
    if (ids.length > 1) return { status: "needs_review", reason: "multiple_contact_matched_talents", existingTalentId: null };
    if (ids.length === 1) return verifyResumeUploadDedupe({ ledger, client, candidateKey, roleKey, jobId,
      candidateName, candidateMobile, candidateEmail, candidateMobileCode, existingTalentId: ids[0] });
    return { status: "passed", reason: "exact_contact_lookup_found_no_talent", existingTalentId: null,
      existingJobAssociation: false, existingApplicationId: null, matchingTalentsFound: 0, ledgerEventsChecked: events.length };
  }
  const talents = talentsSnapshot;
  const matchingTalents = talents.filter(
    (talent) =>
      normalizedName(talentName(talent)) === normalizedName(candidateName),
  );
  const identity = {
    mobile: normalizedMobile(candidateMobile),
    email: normalizedEmail(candidateEmail),
  };
  if (matchingTalents.length > 0 && (identity.mobile || identity.email)) {
    const comparisons = matchingTalents.map((talent) => ({
      talent,
      ...contactComparison(talent, identity),
    }));
    const exactMatches = comparisons.filter((item) => item.exact);
    if (exactMatches.length === 1) {
      const matchedTalentId = talentId(exactMatches[0].talent);
      if (!matchedTalentId) {
        return {
          status: "needs_review",
          reason: "matching_talent_has_no_id",
          ledgerEventsChecked: events.length,
          activeApplicationsFound: null,
          matchingTalentsFound: matchingTalents.length,
          existingTalentId: null,
          checkedAt: new Date().toISOString(),
        };
      }
      const sameJobApplicationIds = jobId
        ? await client.listApplicationIds({
            activeStatus: "3",
            talentId: matchedTalentId,
            jobId,
          })
        : [];
      return {
        status: "passed",
        reason:
          !jobId
            ? "contact_matched_talent_reused_without_job_mapping"
            : sameJobApplicationIds.length > 0
              ? "contact_matched_existing_job_application_reused"
              : "same_name_talent_contact_matched_without_job_application",
        ledgerEventsChecked: events.length,
        activeApplicationsFound: null,
        sameJobApplicationsFound: sameJobApplicationIds.length,
        matchingTalentsFound: matchingTalents.length,
        existingTalentId: matchedTalentId,
        existingJobAssociation: sameJobApplicationIds.length > 0,
        existingApplicationId: sameJobApplicationIds[0] ?? null,
        checkedAt: new Date().toISOString(),
      };
    }
    if (exactMatches.length > 1) {
      return {
        status: "needs_review",
        reason: "multiple_contact_matched_talents",
        ledgerEventsChecked: events.length,
        activeApplicationsFound: null,
        matchingTalentsFound: matchingTalents.length,
        existingTalentId: null,
        checkedAt: new Date().toISOString(),
      };
    }
    if (comparisons.every((item) => item.comparable)) {
      return {
        status: "passed",
        reason: "same_name_talents_have_different_verified_contacts",
        ledgerEventsChecked: events.length,
        activeApplicationsFound: 0,
        matchingTalentsFound: matchingTalents.length,
        existingTalentId: null,
        checkedAt: new Date().toISOString(),
      };
    }
  }
  if (matchingTalents.length > 0) {
    return {
      status: "needs_review",
      reason: "same_name_talent_requires_identity_review",
      ledgerEventsChecked: events.length,
      activeApplicationsFound: null,
      matchingTalentsFound: matchingTalents.length,
      existingTalentId: null,
      checkedAt: new Date().toISOString(),
    };
  }
  return {
    status: "passed",
    reason: "no_ledger_upload_and_no_same_name_talent",
    ledgerEventsChecked: events.length,
    activeApplicationsFound: 0,
    matchingTalentsFound: 0,
    existingTalentId: null,
    existingJobAssociation: false,
    existingApplicationId: null,
    checkedAt: new Date().toISOString(),
  };
}

const FEISHU_TENANT_HOST = /^(?!hire\.)(?!open\.)(?!www\.)[a-z0-9-]+\.feishu\.cn$/i;
const LARK_TENANT_HOST = /^(?!hire\.)(?!open\.)(?!www\.)[a-z0-9-]+\.larksuite\.com$/i;

export function normalizeFeishuHireWebBaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("feishuHire.webBaseUrl must be a valid HTTPS tenant URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash ||
    (!FEISHU_TENANT_HOST.test(url.hostname) &&
      !LARK_TENANT_HOST.test(url.hostname))
  ) {
    throw new Error(
      "feishuHire.webBaseUrl must be an HTTPS Feishu/Lark tenant origin, not hire.feishu.cn",
    );
  }
  return `https://${url.hostname.toLowerCase()}`;
}

export function buildFeishuHireTalentUrl({
  webBaseUrl,
  talentId,
  applicationId = "",
} = {}) {
  const baseUrl = normalizeFeishuHireWebBaseUrl(webBaseUrl);
  const normalizedTalentId = String(talentId ?? "").trim();
  if (!baseUrl || !normalizedTalentId) {
    return "";
  }
  const talentUrl = `${baseUrl}/hire/talent/${encodeURIComponent(normalizedTalentId)}`;
  const normalizedApplicationId = String(applicationId ?? "").trim();
  return normalizedApplicationId
    ? `${talentUrl}?application_id=${encodeURIComponent(normalizedApplicationId)}`
    : talentUrl;
}

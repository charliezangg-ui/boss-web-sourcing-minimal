import path from "node:path";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../hire-upload.mjs", import.meta.url));
const setup = fileURLToPath(new URL("../../references/setup.md", import.meta.url));
export const requiredScopes = ["hire:attachment", "hire:talent", "hire:application", "hire:job:readonly"];

// Instructions only: creating an app and granting scopes remain in the user's CLI/console.
export function onboardingGuide({ stage, configFile, cliBin = "lark-cli", profile = "", missingScopes = [], consoleUrl = "", action = "" }) {
  const command = (label, ...args) => ({ label, argv: [process.execPath, entry, ...args, "--config", path.resolve(configFile)] });
  const cli = (label, ...args) => ({ label, argv: [cliBin, ...args] });
  const consoleLink = consoleUrl || "https://open.feishu.cn/app";
  const guides = {
    environment: {
      message: "先补齐 Node.js 24+ 和支持原生 API 的 lark-cli。",
      steps: ["按官方安装说明安装或更新 CLI：https://github.com/larksuite/cli", "依赖就绪后重新运行 onboard。"],
      commands: [command("重新检查首次配置", "onboard")],
    },
    local_config: {
      message: "尚未配置飞书招聘上传，先创建本地配置，再引导连接自己的应用。",
      steps: ["运行 init 创建配置；凭据由 lark-cli 管理，不填写到配置或聊天。", "随后按返回的 application 引导选择应用并配置招聘权限。"],
      commands: [command("创建本地配置", "init")],
    },
    repair_config: {
      message: "已有配置无法读取或格式不正确，需要修复原文件。",
      steps: ["对照接入配置检查字段、JSON 和文件访问权限；保留原配置、数据库及任务断点。"],
      commands: [command("修复后检查", "onboard")],
    },
    application: {
      message: "选择目标组织已有的自建应用；没有合适应用时再创建。",
      steps: ["运行 profile list 选择已有连接，将名称填入 config.profile；多个组织时核对目标组织。",
        "没有合适应用时按接入配置启动 config init；向用户展示 CLI 返回的原始链接与二维码，密钥只交给 CLI。",
        "在开发者后台为该应用开通 requiredScopes、配置招聘数据范围并发布生效；需要审批时由组织管理员完成。",
        "随后查询岗位和来源并完成映射。"],
      commands: [cli("查看已有连接", "profile", "list"), cli("查看当前版本接入选项", "config", "init", "--help"), command("填写 profile 后查询岗位和来源", "discover")],
      requiredScopes, consoleUrl: consoleLink,
    },
    mapping: {
      message: "连接已选择，需要核对简历来源、岗位映射和租户必填字段。",
      steps: ["从 discover 返回值选择可用来源并填入 resumeSourceId；按任务绑定 jobs，明确仅人才入库时可留空。",
        "在招聘标准简历设置中核对手机号/邮箱要求，填写 requiredCandidateFields。"],
      commands: [command("查询可用来源和岗位", "discover"), command("只读核对映射", "doctor", "--live")],
    },
    permissions: {
      message: "当前应用缺少招聘权限，需要在开发者后台处理。",
      steps: ["打开 consoleUrl，在当前应用的权限管理中按报错开通权限；若接口列出备选权限，选择覆盖本任务的一项。",
        "核对招聘数据范围并使应用版本生效；有审批要求时请组织管理员处理。应用身份无需个人 auth login。",
        "完成后先只读检查；若原任务已有写入，保留原计划并先核验状态。doctor 通过不代表所有写权限已验证。"],
      commands: [command("只读检查连接", "doctor", "--live")],
      requiredScopes, missingScopes, consoleUrl: consoleLink,
    },
    verify: {
      message: "本地配置已齐全，下一步只读验证连接和映射。",
      steps: ["运行 doctor --live 核对当前应用可见的来源和岗位。",
        "写权限保持 unverified，首次真实上传按已有任务授权执行并回读；无需创建测试人才。"],
      commands: [command("只读检查连接", "doctor", "--live")],
    },
  };
  return { stage, config: path.resolve(configFile), reference: setup, identity: "bot", profile,
    ...guides[stage], ...(action === "execute" || action === "reconcile" ? { resume: "保留原计划与断点，核验已有写入后继续；不自动重放。" } : {}) };
}

export function onboardingForError(error, options) {
  const permissionError = error.missingScopes?.length > 0 || /permission|scope/i.test(error.subtype ?? "");
  const stage = permissionError ? "permissions" : error.setupStage ?? (error.subtype === "cli_unavailable" ? "environment" : "");
  return stage ? onboardingGuide({ ...options, stage, missingScopes: error.missingScopes ?? [], consoleUrl: error.consoleUrl ?? "" }) : null;
}

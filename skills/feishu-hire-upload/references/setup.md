# 首次配置

需要 Node.js 24+、支持 `api --file` 和 `api --data -` 的 lark-cli，以及目标组织的飞书招聘自建应用。应用身份使用 tenant_access_token；个人用户登录不能代替应用权限。

## 引导入口

首次启用时告诉用户：“上传飞书招聘需要连接你所在组织的应用。我会先检查已有连接，再引导完成招聘权限、简历来源和岗位配置。”执行以下只读检查，`<module>` 为本 Skill 所在目录：

```bash
node <module>/scripts/hire-upload.mjs onboard --config .runtime/feishu-hire/config.json
```

根据返回的 `onboarding.stage` 继续：`local_config` 运行 init；`environment` 补齐依赖；`application` 选择应用与开通权限；`mapping` 选择来源和岗位；`verify` 做只读连接检查。`repair_config` 修复原配置，不能用 init 覆盖。普通命令遇到缺配置、缺权限时也返回同一引导。`onboard` 不联网、不创建应用、不上传简历；`ok: true` 只表示引导检查执行成功，不表示权限已通过。

## 应用与权限

1. 缺少依赖时按 [lark-cli 官方安装说明](https://github.com/larksuite/cli)安装；需要 Node.js 24+。配置缺失时运行下方 init，然后用 `lark-cli profile list` 检查已有连接。若已有目标组织的应用，直接复用其 profile；多个组织或无法确认归属时让用户选择目标。
2. 没有合适应用时，先查看本机 `lark-cli config init --help`，使用新的 profile 名称发起接入：

```bash
lark-cli config init --name <新的连接名称> --new
```

该命令会等待用户完成浏览器配置，应在后台运行并及时展示返回的原始链接和二维码。已有应用尚未接入 CLI 时去掉 `--new` 进入选择流程；密钥只交给 CLI 管理，不写入本模块配置或对话。受管理的 Agent 环境若提示使用 `config bind`，沿其现有应用接入，不强制新建。使用已安装的 lark-shared 时按其链接与二维码流程执行；独立安装时查看 `lark-cli auth qrcode --help` 生成二维码，保留原始链接。

3. 引导用户打开[飞书开发者后台](https://open.feishu.cn/app)，进入该应用的权限管理，添加以下应用身份权限。说明每项用途，不要求用户自行查 scope：

| 能力 | 权限 |
|---|---|
| 上传与回读附件 | `hire:attachment` |
| 查询、创建与更新人才；查询来源 | `hire:talent` |
| 查询与创建投递 | `hire:application` |
| 读取岗位并建立映射 | `hire:job:readonly` |

核对应用对目标招聘数据的可见范围，并通过版本管理发布生效；组织要求审批时由管理员完成。用户没有应用管理权限时，直接给出上表、应用入口和待审批步骤，保留配置进度等待管理员处理。普通 BOSS 寻访不依赖此配置。

## 来源、岗位与连接检查

在工作目录生成本地配置：

```bash
node <module>/scripts/hire-upload.mjs init --config .runtime/feishu-hire/config.json
```

init 不覆盖已有配置。填入自己的 `profile`，随后查询本应用可见的岗位与来源：

```bash
node <module>/scripts/hire-upload.mjs discover --config .runtime/feishu-hire/config.json
```

配置字段：

```json
{
  "schemaVersion": 1,
  "profile": "your-configured-cli-profile",
  "cliBin": "lark-cli",
  "webBaseUrl": "",
  "inbox": "inbox",
  "archive": "archive",
  "database": "uploads.sqlite",
  "resumeSourceId": "source-id-from-discovery",
  "jobs": {"role-key": "job-id-from-discovery"},
  "requiredCandidateFields": []
}
```

目录和数据库路径相对于配置文件。将获得授权的简历放到 inbox；原文件保留，归档使用哈希文件名。`webBaseUrl` 可留空，填写租户 HTTPS 根地址时生成候选人链接。`jobs` 可为空，此时只能显式执行人才入库。

在飞书招聘“标准简历设置”核对本租户是否强制手机号或邮箱；相应地把 `candidateMobile`、`candidateEmail` 放入 `requiredCandidateFields`。不要猜测候选人联系方式。缺少已确认人才 ID 和可用于查重的真实手机号/邮箱时，准备阶段返回待核验。

检查环境与连接：

```bash
node <module>/scripts/hire-upload.mjs doctor --config .runtime/feishu-hire/config.json
node <module>/scripts/hire-upload.mjs doctor --config .runtime/feishu-hire/config.json --live
```

普通 doctor 不调用招聘 API；`--live` 只读取岗位与来源并核对映射，不能证明写权限或真实上传通过。模块不会通过创建测试人才验证权限。首次真实业务上传仍按任务授权执行和回读。

遇到权限错误时，将 `onboarding.missingScopes` 和原始 `consoleUrl` 展示给用户，按权限管理、数据范围、版本生效顺序引导修复；接口列出备选 scope 时解释为可选项，不要求全部开通。处理后只读复查，再按原任务断点恢复；已配置的用户只处理缺失项。

同一数据库绑定一个连接 profile；切换组织使用独立数据库。保留已有 profile 指向同一组织，不把 profile 名称复用于另一租户。运行目录只留本地，不提交配置、简历或数据库。

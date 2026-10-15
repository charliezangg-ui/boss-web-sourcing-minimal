# 上传与恢复命令

以下命令中的 `<module>` 为本 Skill 路径。所有 JSON 通过 stdin 提供，使用工具的参数数组与 stdin 能力，不把候选人 JSON 拼进 shell 命令。

首次连接先用 `onboard`，按[接入配置](setup.md)完成引导。命令错误若带 `onboarding`，只处理对应缺项并保留原任务断点。

## 归档

```bash
node <module>/scripts/hire-upload.mjs intake --config .runtime/feishu-hire/config.json --payload -
```

输入：`file`（inbox 内的实际文件路径）、`candidateKey`（`sha256:` 加64位匿名候选人键）、`sourceChannel`、`roleKey`（配置中的岗位键）。候选人键复用上游身份映射；姓名不作为唯一身份键。仅人才入库时传 `talentOnly: true` 并省略 roleKey。文件须稳定且受支持；输出 `result.resumeSha256` 供后续使用。

## 准备与执行

```bash
node <module>/scripts/hire-upload.mjs prepare --config .runtime/feishu-hire/config.json --payload -
node <module>/scripts/hire-upload.mjs execute --config .runtime/feishu-hire/config.json --confirmed-ref <plan-reference> --payload -
```

两次使用同一份输入：

- `resumeSha256`、`candidateName` 必填。
- `candidateMobile` / `candidateEmail`：真实身份查询依据，亦用于创建人才；国际号码同时提供 `candidateMobileCode`。遵守租户必填设置。
- `existingTalentId`：已有且已核验身份的人才可提供；否则按真实联系方式查询。
- `talentOnly: true`：仅人才入库任务使用。

准备结果提供固定计划、`plan.confirmationRef` 和有效期。确认引用绑定具体输入和查重决策；有效任务授权覆盖该计划时可执行，不要求再增加一次用户确认。无需用户传递 skipApplicationCreation 等内部参数；已有投递 ID 与复用决策保存在计划内。候选人输入只保存在执行内存，数据库保存其指纹与必要平台引用。

`uploaded_verified` 表示原计划要求的步骤均已回读；`jobAssociated` 区分是否关联岗位。已有投递保留原来源和阶段，不把新附件的来源覆盖到历史投递。

## 查询与恢复

```bash
node <module>/scripts/hire-upload.mjs status --config .runtime/feishu-hire/config.json --resume-sha256 <sha256>
node <module>/scripts/hire-upload.mjs reconcile --config .runtime/feishu-hire/config.json --confirmed-ref <plan-reference> --payload -
```

reconcile 输入只需 `resumeSha256`。使用原计划引用；该命令只读远端并更新本地核验结果。原目标包含岗位但投递 ID 丢失时，按同人才、同岗位查询：唯一且身份、岗位、来源、阶段匹配才结案；零条、多条或不可读时保留 unknown，不创建新投递。

明确缺权限时保留已完成步骤；修复权限且原授权仍有效后执行相同计划。计划过期或输入变化须重新准备；unknown 必须先核验。没有人才 checkpoint 的未知写入不能靠文件哈希推测成功，按失败索引查原人才和附件。

独立目录执行离线回归：`node --test <module>/tests/upload.test.mjs`。所有接口由合成响应替代，不会调用真实飞书。

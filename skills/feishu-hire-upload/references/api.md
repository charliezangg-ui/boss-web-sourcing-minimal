# API 契约

使用自己的自建应用，通过 lark-cli 显式指定同一 profile 与 `--as bot`。JSON 从 stdin 传入；附件使用归档目录作为 cwd 和相对路径 `--file content=<relative-path>`。不自动重试写请求。

| 动作 | API | 核验 |
|---|---|---|
| 精准查询人才 | `POST /open-apis/hire/v1/talents/batch_get_id`（查询） | 电话/邮箱返回的唯一人才 ID；多匹配待核验 |
| 上传附件 | `POST /open-apis/hire/v1/attachments` | 返回上传 ID 后绑定人才 |
| 创建人才 | `POST /open-apis/hire/v1/talents/combined_create` | talent_id |
| 为已有的人才加附件 | `POST /open-apis/hire/v1/talents/combined_update` | 不覆盖经历列表；附件增加不等于简历解析 |
| 创建投递 | `POST /open-apis/hire/v1/applications` | talent_id、job_id、resume_source_id；HR 寻访 delivery_type=1 |
| 回读人才 | `GET /open-apis/hire/v2/talents/:id` | 从 resume_attachment_list 按归档名匹配正式附件 |
| 回读正式附件 | `GET /open-apis/hire/v1/attachments/:id` | ID 和归档文件名 |
| 查询 / 回读投递 | `GET /open-apis/hire/v1/applications`、`.../:id` | 同人才同岗位及阶段；新投递还核对来源 |

上传返回 ID 与人才中的正式附件 ID 不混用。若原计划复用已有投递，仍回读该投递；不会调用阶段修改或恢复接口。

2026-10-15 核对的官方文档：[精准查询](https://open.feishu.cn/document/server-docs/hire-v1/candidate-management/talent/batch_get_id.md)、[附件](https://open.feishu.cn/document/server-docs/hire-v1/attachment/create_attachment.md)、[创建人才](https://open.feishu.cn/document/server-docs/hire-v1/candidate-management/talent/combined_create.md)、[更新人才](https://open.feishu.cn/document/server-docs/hire-v1/candidate-management/talent/combined_update.md)、[创建投递](https://open.feishu.cn/document/server-docs/hire-v1/candidate-management/delivery-process-management/application/create.md)。接口变化时重新核对字段及权限，不依据旧成功记录猜测。

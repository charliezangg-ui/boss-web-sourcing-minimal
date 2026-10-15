# BOSS 模块化公开版迁移核对

本次以本地原版 `skills/boss-*` 为来源，把 BOSS 网页最小闭环的可迁移操作规则放进独立模块。每项标记的是**离线迁移/测试状态**，不是当前 BOSS 网站的实时验收。用户指定排除：飞书招聘上传、外部群监听与汇报、无人值守定时调度。账号专属额度、历史候选人、公司黑名单、特定岗位画像和个人路径不作为公开默认配置；通用的排除集合机制与人工校准机制保留。

| 原模块 | 公开模块 | 迁移的关键能力 | 状态 |
|---|---|---|---|
| boss-sourcing | boss-sourcing | 15个Skill入口与模块、四条workflow、同run目标、候选人交接、网页契约与恢复 | 文档/引用已校验 |
| boss-job-create | boss-job-create | 字段依据、保存与发布区分、岗位类型目录、话术配置、付费名额处理 | 静态类型查询已运行；网页待验 |
| boss-candidate-filter | boss-candidate-filter | 推荐/搜索字段目录、实际值回读、窄宽版本、关键词→学校的切页顺序 | 文档/引用已校验；网页待验 |
| boss-candidate-source | boss-candidate-source | 两级分流、唯一卡片数、策略事件与耗时、人工校准的本地版本 | 文档/引用已校验 |
| boss-candidate-read | boss-candidate-read | 短读、长画布、重叠截图、折叠补读、OCR覆盖和脚本 | Python/JS离线测试通过；网页待验 |
| boss-candidate-screen | boss-candidate-screen | 排除集合机制、职业主线、持续责任、本人项目、版本化样本 | 文档/引用已校验；具体画像由用户提供 |
| boss-greet | boss-greet | 话术核对、意图前置、同人发送回读与合格去重计数 | 文档/引用已校验；外发未测试 |
| boss-candidate-favorite | boss-candidate-favorite | 当前评审结果交接、收藏intent、同人同岗回读、新增与已存在分列 | 新增规范；网页待验 |
| boss-conversation | boss-conversation | 未读发现、已登记待办恢复、逐人闭环、标准话术＋求简历按钮 | checkpoint离线测试通过；网页待验 |
| boss-candidate-followup | boss-candidate-followup | 入站指纹、回复分类、未回复等待、同人恢复 | 文档/引用已校验；网页待验 |
| boss-resume-collect | boss-resume-collect | 请求/承诺/实际附件/在线简历/下载分阶段，文件哈希 | 文档/引用已校验；下载待验 |
| boss-recruiting-data | boss-recruiting-data | 平台与本地证据分开、按岗漏斗及cohort回复率 | 文档/引用已校验 |
| boss-operations-log | boss-operations-log | 策略切换前留痕、逐人阶段计时、下一人前记录门槛 | 文档/引用已校验；自动强制门禁待实现 |
| boss-failure-recovery | boss-failure-recovery | 前置失败停链、故障索引、实例与类型分离、实测恢复标记 | 文档/引用已校验 |
| boss-security-feedback | boss-security-feedback | 安全验证分类、停手、原空间恢复与事件留痕 | 文档/引用已校验；网页待验 |

原版 `boss-im-inbox`、`boss-im-report`、`boss-autonomous-operations` 按指定范围不迁入。`feishu-hire-operations` 也不迁入。原版 Base 人工标注写入改为私有本地反馈接口；若用户以后选择外部表格，需要单独授权和实现。原版 `module-acceptance.md` 的账号运行证据、岗位专属画像和 `exclusions.json` 不公开；本表取代其公开包验收状态，避免把原账号成功案例误当新用户验收。

## 验证界限

14 个 SKILL frontmatter 均通过 quick_validate；将公开包单独复制到空目录后，14 个模块校验、相对引用及四组离线检查再次通过。复制的完整读取脚本通过 8 个 Python 与 7 个 Node 离线测试；会话 checkpoint 通过 4 个 Python 测试；Swift Vision 源码 typecheck 和岗位类型静态查询通过。相对 Markdown 链接、私人路径与排除项需在打包前再扫一次。离线测试不证明新用户浏览器工具兼容、BOSS 当前页面可用、真实招呼送达或简历下载成功。

## 2026-10-15 分层更新

入口保留模块索引并增加四条workflow；推荐招呼与收藏共用组合，创建岗位支持用户描述来源，会话workflow引用已有编排。评审返回结果，跟进模块负责单人回复；读取失败与可读缺证分开。新岗位筛选确认规则只由对应参考维护，不阻塞岗位内容整理或保存。招呼计数检查限定数量触达任务，其他流程使用自身结果。

个人版的简历上传、公司条件、飞书/IM和调度配置未迁入本包。历史“14个Skill”验证记录对应旧版；本次新增收藏及重组流程须另行验证，不能沿用历史网页通过结论。

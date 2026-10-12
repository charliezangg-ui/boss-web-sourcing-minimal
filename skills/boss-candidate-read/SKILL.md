---
name: boss-candidate-read
description: Read a complete BOSS online resume using page text, rendered canvas or overlapping captures with folded-content verification.
---
# 候选人完整读取

先核对同人同岗、详情确已打开和页面已绘制。卡片只做一级判断；决定联系必须读足工作、项目、本人责任、教育与页底。可读 DOM 优先直接提取；短简历原视口完整时直接读。长简历优先导出当前已渲染画布并在 finally 恢复视口；导出受跨域限制时用有重叠的可见截图完整覆盖，逐段确认位置变化，不连续截相同画面。折叠“查看全部”须在原视口单独展开、留图并与主文本合并；增高视口可能使其重新折叠。

[读取细则](../boss-candidate-screen/references/resume-reading.md)规定完整性：起止日期、项目、技能、教育、底部、身份与折叠覆盖分别标记。OCR 只提供带位置文字，不自动证明事实归属；决定性的公司、日期和本人行动疑似错字时回看局部原图。缺口记 `partial/blocked_read`，不可当候选人缺技能。复用一次全文图与 OCR，只对漏读或疑点补局部，不逐屏重复截图。

可选 Ego Lite/macOS 适配器在 `scripts/read.py`、`scripts/read-page.mjs` 和相邻 `boss-candidate-screen/scripts/ocr-resume.swift`；仅当用户环境确有 `ego-browser` CLI、Node.js、Python、macOS Swift Vision 时运行。其他浏览器使用本模块的同等可见读取流程；脚本缺失或编译失败不授权跳过完整性。旧 `capture-resume.py` 仅为历史适配，不作为当前沟通页默认实现。任何导航、截图、OCR前置步骤失败都停依赖链并记录，不复用上一候选人的旧产物。

脚本调用形态：`python3 skills/boss-candidate-read/scripts/read.py resume --space <已核验空间编号> --page <已核验页面标签> --name <页面显示名> --output <私有运行目录/唯一尝试名.json>`。卡片模式改用 `card --selector <当前页面已观察到的选择器>`；`--open-selector`、`--message-selector` 只传当前页面实际核验的选择器。脚本拒绝覆盖已有尝试，并将候选人产物限制在技能包目录之外。浏览器工具接口与版本须现场核对，不把脚本参数当作网页身份验证。

记录读取方式、覆盖、OCR状态、空图数、补读、阶段耗时及证据哈希。不可用未经验证的性能实验数字推断本次速度或准确率。

---
name: boss-security-feedback
description: Stop and record BOSS login/security challenges, notify the current user and safely resume the same run after human resolution.
---
# 安全验证反馈

BOSS 明确显示安全验证、验证码、扫码登录或异常访问时，立即停止 BOSS 操作，不点击挑战、不刷新试探、不自动重试。平台付费弹窗、普通加载和用户接管分别分类，不冒充安全验证。保存已取得的页面提示、最后正常观察与首次异常时间、最近已知动作、浏览器空间、run_id、岗位、已验证完成数、未知写入及证据；推测触发原因与事实分开，不编造风控阈值。

先在私有 `security-events/<event_id>.json` 与运行日志落盘，改 run 为 paused；同一持续阻塞复用 event_id。避免保存令牌、Cookie、二维码或候选人正文。日志失败也要如实告知当前用户。向当前任务用户说明验证类型、影响范围、已暂停、原浏览器空间和所需人工动作；通知送达与用户已处理分开记录。本包不自带 IM 发送或加急。

用户完成验证并明确要求继续后，在原浏览器空间核实登录、岗位、筛选、同人和未决写入，更新原事件 resolved_at 与证据，再从原断点继续。再次受限则继续暂停；未知写入先核验，不能重放。不换浏览器、不创建新运行绕开限制。[历史观察](../boss-sourcing/references/security-observations.md)仅供判断故障类型，不是当前平台阈值。

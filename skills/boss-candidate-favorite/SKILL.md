---
name: boss-candidate-favorite
description: "对已按当前岗位评审、属于授权范围的BOSS网页候选人收藏一次，并核验同人同岗状态。"
---

# 收藏候选人

先读[共享契约](../boss-sourcing/references/web-contract.md)，复用原run和[候选人交接](../boss-sourcing/references/candidate-contract.md)。输入为候选人匿名键、目标岗位、当前评审结果与证据版本、收藏授权和任务统计范围。

1. 检查[评审模块](../boss-candidate-screen/SKILL.md)的当前岗位合格结果与详情证据。规则或材料已变化时返回评审；不另设收藏专属门槛。
2. 回读当前候选人、岗位上下文及收藏状态，检查历史动作。已收藏时记录已存在；unknown先只读核验。平台收藏若为账号级状态，只记录已验证的范围，不猜测存在岗位独立收藏夹。
3. 当前未收藏且动作获授权时，先持久化intent；确认成功后按当前页面的收藏控件执行一次。前置落盘失败停止写入。
4. 回读同一候选人的“已收藏”状态及岗位上下文，立即记录证据与结果。仅点击回执不足以计成功；结果未知不再点击，避免将取消收藏误当重试。

输出 `favorite_added_verified_unique`、`already_favorited_verified_unique`、`favorite_unknown`、`favorite_blocked` 及证据和断点。新增与已存在分别统计；按任务要求选择计量范围。收藏不产生招呼、求简历或平台淘汰动作。

控件缺失、读取失败、身份冲突或写入未知，交[失败模块与索引](../boss-failure-recovery/SKILL.md)；仅返回本动作结果，由workflow决定下一步。

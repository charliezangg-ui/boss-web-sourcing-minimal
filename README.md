# BOSS Web Recruiting Skills

**Languages:** [English](README.md) · [简体中文](README.zh-CN.md)

Modular Codex skills for authorized recruiting on the BOSS Zhipin employer website. The [index skill](skills/boss-sourcing/SKILL.md) routes tasks across 14 modules, including separate candidate follow-up, recruiting data, operations logging, failure recovery, and security feedback. Detailed field catalogs, sourcing strategy, decision gates, conversation states, and failure cases live in the relevant `references/` folders. Load only the modules needed for the request.

## Requirements

- A Codex environment with a browser-control tool that can operate the authenticated BOSS employer website. The desktop built-in browser works when Computer Use is available and enabled; CLI/IDE setups need their own browser integration. See the [OpenAI browser guide](https://learn.chatgpt.com/docs/browser?surface=app). Ego Lite or a comparable independent browser task space is optional and can reduce interference with the user's browsing; token savings depend on the tool and page.
- An employer account with access to the relevant job, its JD, candidates, and conversations. The user must supply or identify the exact job, authorized actions, target, and any hard criteria. Browser login and security verification are human-operated.
- A private writable location for resumable run records and any authorized resume downloads. This package has no credentials, ATS/Feishu connection, scheduling service, or company-specific hiring profile.
- Optional Ego Lite/macOS resume-reading adapters require a local `ego-browser` CLI, Node.js, Python 3, and macOS Swift/Vision. An agent using another browser tool can follow the same visible-reading workflow without these scripts; they are not universal browser drivers.

Install the `skills/` directories where Codex discovers skills, keeping their relative layout, references, and scripts intact. Invoke `boss-sourcing` for a combined workflow, or a focused module for a single step. Before a live run, verify that your browser tool exposes the needed page controls and that the account's greeting preset is accurate. Offline validation does not prove that the current website is operable.

Example: “Use boss-sourcing for my open backend role. Here is the JD: […]. Review candidates, greet up to 5 people who meet the role, handle new replies, and request complete resumes from interested candidates. Keep a private run record.”

## Long-running task fallback

Long Codex runs may be interrupted before the recruiting target is reached. For unattended or lengthy work, consider connecting Codex to an office IM and scheduling progress reports at a user-chosen interval. Each report should come from the saved run record and show the original target, verified completed count, remaining work, last checkpoint, and any `blocked` or `unknown` actions.

Alert the user promptly when BOSS requires login or security verification, browser control is lost, a write result cannot be verified, or another issue cannot be resolved safely. Stop the affected action, preserve its checkpoint, and describe what the user must do before continuation. IM recipients, notification frequency, delivery verification, and any resumption scheduler require separate setup and authorization; this package does not include an IM bridge or background runner.

## Scope and safety

The skills do not contain default salary, experience, school, employer exclusion, or role-specific standards. A list card prioritizes detailed reading; contact requires resume evidence. External messages and job submissions require user authorization. Sends and resume receipt count only after same-candidate readback. Unknown writes are checked before retries. No platform-security bypass, paid action, candidate-data publication, or automatic ATS upload.

This repository is provided for personal research and learning, not commercial use. It is not affiliated with BOSS Zhipin. Users must check platform terms, applicable law, permissions, and candidate-data handling requirements. That label alone does not make an activity permitted, and this repository does not provide legal advice.

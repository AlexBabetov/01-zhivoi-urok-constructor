---
status: archive
created: 2026-02-26
updated: 2026-02-26
owner: babetov_aa@koriphey.ru
tags: [refs, architecture]
---

# Universal Agent Protocol (UAP) — Architecture Review Request

**Document type:** Peer LLM Review Request  
**Author:** Claude Sonnet (Anthropic)  
**Version:** 1.0.0  
**Purpose:** Request independent evaluation of proposed architecture for multi-agent, multi-LLM, multi-developer collaboration system

---

## Context: What Problem We're Solving

A small creative team (3–6 people) needs to collaborate on a branding project for a design studio. The challenge is that:

- Team members use **different LLMs** (Claude, OpenAI Codex/GPT-4, potentially Gemini)
- Team members work on **different machines** in different locations
- Each person operates as a **specialized agent** (Brand Strategist, Copywriter, Visual Designer, Campaign Planner, Automation Engineer)
- Work must be **synchronized without conflicts** across tools, agents, and humans
- Agent instructions (skills), task states, and project artifacts must remain **consistent regardless of which LLM executes them**

The core tension: LLM ecosystems are incompatible by design (Claude Projects, OpenAI Custom GPTs, Gemini Gems all use different instruction formats), but the project state and coordination protocol must be shared.

---

## Proposed Solution: File-Based Universal Agent Protocol

### Principle

> Store all agent definitions as LLM-neutral YAML. Compile platform-specific Markdown adapters automatically. Use GitHub as the single source of truth for everything except secrets and local process configuration.

### Repository Structure

```
project-root/
├── AGENTS.md                        # Live coordination dashboard
├── agents/
│   ├── definitions/                 # Source of truth (LLM-neutral YAML)
│   │   ├── brand-strategist.yaml
│   │   ├── copywriter.yaml
│   │   ├── visual-designer.yaml
│   │   ├── campaign-planner.yaml
│   │   └── automation-engineer.yaml
│   ├── adapters/                    # Auto-generated per LLM
│   │   ├── claude/
│   │   ├── openai/
│   │   └── gemini/
│   └── compile.py                   # Generates adapters from definitions
├── tasks/                           # Atomic task files (YAML frontmatter + Markdown)
│   ├── 01-brand-strategy.md
│   ├── 02-copywriting.md
│   ├── 03-visuals.md
│   ├── 04-campaign.md
│   └── 05-automation.md
├── _docs/                           # All project artifacts (read by agents)
│   ├── brief.yaml
│   ├── brand-identity.md
│   ├── copy-library.md
│   ├── image-prompts.md
│   └── content-calendar.md
├── outputs/
│   ├── copy/
│   ├── images/                      # Prompts in git; binaries via Git LFS or excluded
│   └── scripts/
├── mcp-config/
│   ├── mcp-servers-template.json    # MCP config template (no secrets)
│   └── setup.sh                     # Onboarding script for new team member
├── scripts/
│   ├── validate_tasks.py
│   └── verify_outputs.py
└── .github/
    └── workflows/
        └── validate-tasks.yml       # CI: validates tasks, auto-recompiles adapters
```

---

## Core Design Decisions

### 1. Universal Agent Definition Format (YAML)

Each agent role is defined once in a platform-neutral YAML file:

```yaml
meta:
  id: copywriter
  version: "1.0.0"
  role: "Copywriter Agent"

context:
  always_read:
    - "_docs/brief.yaml"
    - "_docs/brand-identity.md"
    - "AGENTS.md"
  owns:
    - "_docs/copy-library.md"
    - "outputs/copy/**"
  reads_only:
    - "_docs/brand-identity.md"

task:
  input: "tasks/02-copywriting.md"
  output: "_docs/copy-library.md"
  steps:
    - action: "Read brand identity document"
    - action: "Write 12 social media posts (4 per platform)"
      tool: filesystem
    - action: "Write 3 bio variants per platform"
    - action: "Write welcome email series (3 emails)"
    - action: "Update task status to done"
      tool: github

constraints:
  - "Never write to files owned by other agents"
  - "Commit changes after task completion"

quality_gate:
  checklist:
    - "copy-library.md exists and has content"
    - "outputs/copy/instagram/ contains 4 files"
    - "outputs/copy/linkedin/ contains 4 files"
    - "outputs/copy/telegram/ contains 4 files"
    - "task status updated to done"
```

### 2. Adapter Compilation

A Python script (`agents/compile.py`) reads definitions and generates platform-specific Markdown. Example output for Claude:

```markdown
# Copywriter Agent — Instructions (Claude)

Use these instructions as your system behavior for this session.

## Role
Copywriter Agent: writes all text content based on brand identity.

## Session Start Protocol
Read these files in order:
- `_docs/brief.yaml`
- `_docs/brand-identity.md`
- `AGENTS.md`

## Steps
1. Read brand identity document (use filesystem MCP)
2. Write 12 social media posts — 4 per platform (use filesystem MCP)
3. Write bio variants for each platform
4. Write welcome email series
5. Update task status to done (use github MCP)

## File Ownership
You OWN (can write): `_docs/copy-library.md`, `outputs/copy/**`
You READ ONLY: `_docs/brand-identity.md`

## Constraints
- Never write to files owned by other agents
- Commit changes after task completion

## Quality Gate
- [ ] copy-library.md exists and has content
- [ ] outputs/copy/instagram/ contains 4 files
- [ ] outputs/copy/linkedin/ contains 4 files
- [ ] outputs/copy/telegram/ contains 4 files
- [ ] task status updated to done
```

OpenAI and Gemini adapters differ only in header phrasing and tool invocation syntax.

### 3. Task Files as Shared State

Task files are the **only shared mutable state** between agents of different LLMs. Strict YAML frontmatter:

```yaml
---
id: task-002
agent_role: copywriter
assignee: null          # filled when claimed
llm: null               # claude | openai | gemini
status: pending         # pending | in_progress | review | done | blocked
depends_on:
  - task-001
inputs:
  - _docs/brand-identity.md
outputs:
  - _docs/copy-library.md
  - outputs/copy/instagram/
started_at: null
completed_at: null
---
```

### 4. MCP Server Configuration

MCP servers are local processes — they cannot be synchronized through Git. Solution: separate template (in git) from secrets (in Doppler):

- `mcp-servers-template.json` — committed to repo with `${VARIABLE}` placeholders
- `setup.sh` — runs on each machine, calls `doppler run` to inject secrets and generate local `claude_desktop_config.json`
- Participants using non-Claude LLMs skip MCP setup entirely (their LLM uses file-based tools natively)

### 5. Secrets Management via Doppler

One team lead manages all API keys in Doppler. New participants run:

```bash
doppler login && doppler setup
bash mcp-config/setup.sh
```

Keys are injected at runtime. No participant ever sees raw key values. Shared keys (Replicate, Brave Search) are accessed identically by all machines.

### 6. AGENTS.md as Live Dashboard

```markdown
## Current Status

| Task | Assignee | LLM | Status | Updated |
|------|----------|-----|--------|---------|
| 01-brand-strategy | Alice | claude | ✅ done | 2025-03-01 |
| 02-copywriting | Bob | openai | 🔄 in_progress | 2025-03-02 |
| 03-visuals | Carol | claude | ⏳ waiting | — |
| 04-campaign | Alice | claude | ⏳ waiting | — |
| 05-automation | Dave | gemini | 🔄 in_progress | 2025-03-02 |

## Blockers
- task-03 blocked: waiting for task-01 completion (Alice)
```

### 7. CI/CD Automation (GitHub Actions)

On every push:
- Validates YAML frontmatter schema in all task files
- Verifies declared outputs exist
- Auto-recompiles LLM adapters if definitions changed, commits result

---

## What Is NOT Solved (Known Limitations)

**1. MCP availability by LLM**  
Claude Desktop supports MCP natively. OpenAI Codex and Gemini do not. Participants on non-Claude LLMs must use their platform's native file/tool access instead. The agent adapter for each LLM includes platform-appropriate tool instructions, but capability parity is not guaranteed.

**2. Image generation consistency**  
Different API keys on different machines produce different outputs from the same prompt (model version drift, seed differences). Mitigation: lock model versions in `mcp-servers-template.json` and store prompts in git so outputs are reproducible.

**3. Context window limits on long-running projects**  
As `_docs/` grows, agent context becomes expensive. The proposed solution (three-layer memory: Archive / Working / ICON) is defined in concept but not fully implemented in this architecture.

**4. No real-time conflict detection**  
The system relies on git pull discipline and atomic file ownership rules. There is no real-time lock mechanism. Two agents modifying the same file simultaneously will produce a git merge conflict requiring human resolution.

**5. Adapter quality**  
Auto-generated adapters from YAML are functional but may not be optimally phrased for each LLM's instruction-following style. Manual tuning per LLM may improve agent performance.

---

## Questions for the Reviewing LLM

You are being asked to evaluate this architecture as an expert in multi-agent systems, LLM orchestration, and software engineering. Please address the following:

### Q1 — Structural Soundness
Does the file-based coordination approach (YAML definitions → compiled adapters → shared task files → git sync) hold up under real collaborative workload? What failure modes do you anticipate that the author may have missed?

### Q2 — LLM Adapter Quality
Is generating platform-specific Markdown from a shared YAML definition a sound approach to cross-LLM agent coordination? Would you propose a different abstraction layer? Consider: prompt sensitivity differences between Claude, GPT-4, and Gemini; instruction format preferences; tool-use syntax differences.

### Q3 — State Management
Task files as shared mutable state is the critical synchronization point. Is YAML frontmatter in Markdown files a robust enough format for this? What are the risks, and what would you use instead?

### Q4 — Known Limitations Assessment
Of the 5 known limitations listed above, which is most likely to cause real project failure? What is the minimum viable mitigation for that specific issue?

### Q5 — Missing Components
What critical components or protocols does this architecture lack that you would add before using it on a real project with a 4-person team over 4 weeks?

### Q6 — Comparison to Alternatives
How does this approach compare to alternatives such as: dedicated orchestration frameworks (LangGraph, AutoGen, CrewAI), shared vector memory (shared embedding store instead of flat files), or event-driven coordination (message queue instead of git polling)?

### Q7 — Overall Assessment
Rate this architecture on a scale of 1–10 for: (a) practical usability for a small non-technical team, (b) scalability to 10+ agents, (c) robustness to LLM provider switching. Provide brief justification for each score.

---

## How to Use This Document

If you are the reviewing LLM:

1. Read all sections above carefully
2. The proposed repository structure may or may not exist in your context — treat this as a specification document, not an existing codebase
3. Answer the seven questions above with concrete, actionable feedback
4. If you have access to the actual project files, cross-reference your answers with what you observe
5. Be direct about weaknesses — the goal is to stress-test this design before implementation, not to validate it

If you are loading this into a project context alongside actual project files:

- Compare the structure described here against what you observe in the actual files
- Flag any divergences between the specification and reality
- Prioritize Q4 and Q5 based on what you observe is already missing or broken

---

*Document prepared by Claude Sonnet (Anthropic) as part of iterative architecture development for multi-LLM agent coordination systems. Independent evaluation requested.*

---
name: project-planning-agent
description: Coordinate a staged project-planning workflow from rough project details to requirements.md, design.md, and UI screen images. Use when the user says "Use project-planning-agent", asks for a BMAD-style planning agent, or wants a step-by-step flow that first gathers project details, then uses requirements, design, and UI screen generation skills with approval gates.
---

# Project Planning Agent

## Overview

Use this skill as the short-name entrypoint for the project planning workflow. When the user says `Use project-planning-agent for this project`, follow the workflow below.

## Workflow

1. Ask the user for rough project details first.
   - Accept incomplete notes, random ideas, target users, constraints, feature ideas, references, and uncertainties.
   - Do not create files before collecting at least a rough project description.

2. Requirements phase.
   - Create one focused requirements subagent.
   - If the current environment exposes a subagent tool, spawning this subagent is required.
   - Give the requirements subagent only the user's rough project details and this task: create `requirements.md` using `$common-requirements-generator`.
   - Use `$common-requirements-generator`.
   - Create `requirements.md` at the project root.
   - Stop and ask the user to respond with exactly `approved` or `rejected`.
   - Move to design only when the normalized response is exactly `approved`.
   - If the response is exactly `rejected`, ask what must change, update `requirements.md`, and ask for `approved` or `rejected` again.
   - For any other response, do not move forward; ask the user to reply with `approved` or `rejected`.

3. Design phase.
   - Continue only after requirements approval.
   - Ask the user for design direction.
   - Create one focused design subagent.
   - If the current environment exposes a subagent tool, spawning this subagent is required.
   - Give the design subagent the approved `requirements.md`, the user's design direction, and this task: create `design.md` using `$common-design-generator`.
   - Use `$common-design-generator`.
   - Create `design.md` at the project root.
   - Stop and ask the user to respond with exactly `approved` or `rejected`.
   - Move to UI screens only when the normalized response is exactly `approved`.
   - If the response is exactly `rejected`, ask what must change, update `design.md`, and ask for `approved` or `rejected` again.
   - For any other response, do not move forward; ask the user to reply with `approved` or `rejected`.

4. Tech stack phase.
   - Continue only after design approval.
   - Ask the user to choose a tech stack path before architecture.
   - Present these chat options:
     1. `provide stack` - user gives frontend framework, backend framework/runtime, database, auth approach, hosting/deployment target, third-party services, and preferred libraries.
     2. `recommend stack` - agent recommends a stack based on approved `requirements.md` and `design.md`.
     3. `compare options` - agent proposes 2-3 stack options with tradeoffs, then asks the user to choose one.
   - Accept only `provide stack`, `recommend stack`, or `compare options` for this decision. Any other response should not move forward.
   - If the user chooses `provide stack`, collect missing critical choices before architecture.
   - If the user chooses `recommend stack`, produce one recommended stack, explain why it fits, and ask the user to respond with exactly `approved` or `rejected`.
   - If the user chooses `compare options`, produce 2-3 stack options with tradeoffs and ask the user to choose one option; after selection, ask for exactly `approved` or `rejected`.
   - Do not move to architecture until the tech stack is approved.

5. Frontend architecture phase.
   - Create one focused frontend architecture subagent.
   - If the current environment exposes a subagent tool, spawning this subagent is required.
   - Give the frontend architecture subagent the approved `requirements.md`, approved `design.md`, and approved tech stack.
   - Use `$common-frontend-architecture-generator`.
   - Create `frontend-architecture.md` at the project root.
   - Stop and ask the user to respond with exactly `approved` or `rejected`.
   - Move to backend architecture only when the normalized response is exactly `approved`.
   - If the response is exactly `rejected`, ask what must change, update `frontend-architecture.md`, and ask for `approved` or `rejected` again.
   - For any other response, do not move forward; ask the user to reply with `approved` or `rejected`.

6. Backend architecture phase.
   - Continue only after frontend architecture approval.
   - Create one focused backend architecture subagent.
   - If the current environment exposes a subagent tool, spawning this subagent is required.
   - Give the backend architecture subagent the approved `requirements.md`, approved `frontend-architecture.md`, and approved tech stack.
   - Use `$common-backend-architecture-generator`.
   - Create `backend-architecture.md` at the project root.
   - Stop and ask the user to respond with exactly `approved` or `rejected`.
   - Move to architecture diagrams only when the normalized response is exactly `approved`.
   - If the response is exactly `rejected`, ask what must change, update `backend-architecture.md`, and ask for `approved` or `rejected` again.
   - For any other response, do not move forward; ask the user to reply with `approved` or `rejected`.

7. Architecture diagrams phase.
   - Continue only after backend architecture approval.
   - Create one focused architecture diagrams subagent.
   - If the current environment exposes a subagent tool, spawning this subagent is required.
   - Give the architecture diagrams subagent the approved `requirements.md`, approved `frontend-architecture.md`, approved `backend-architecture.md`, and approved tech stack.
   - Use `$common-architecture-diagram-generator` and `$imagegen`.
   - Create `architecture_diagrams/` at the project root if missing.
   - Generate `architecture_diagrams/high-level-architecture.mmd`.
   - Generate `architecture_diagrams/low-level-architecture.mmd`.
   - Generate `architecture_diagrams/high-level-architecture.png`.
   - Generate `architecture_diagrams/low-level-architecture.png`.
   - Stop and ask the user to respond with exactly `approved` or `rejected`.
   - Move to UI screens only when the normalized response is exactly `approved`.
   - If the response is exactly `rejected`, ask what must change, regenerate only affected diagrams, and ask for `approved` or `rejected` again.
   - For any other response, do not move forward; ask the user to reply with `approved` or `rejected`.

8. UI screens phase.
   - Continue only after architecture diagrams approval.
   - Ask the user to choose UI screen output mode before spawning the UI screens subagent:
     1. `desktop` - generate only desktop/PC screen images.
     2. `mobile` - generate only mobile screen images.
     3. `both` - generate both desktop and mobile images for every screen.
   - Accept only `desktop`, `mobile`, or `both`. Any other response does not move forward.
   - Create one focused UI screens subagent.
   - If the current environment exposes a subagent tool, spawning this subagent is required.
   - Give the UI screens subagent the approved `requirements.md`, approved `design.md`, approved architecture docs, approved architecture diagrams, selected UI screen output mode, and this task: generate UI screen images using `$common-ui-screen-generator` and `$imagegen`.
   - Use `$common-ui-screen-generator`.
   - Use `$imagegen` for the actual image generation.
   - Create `ui_examples/` at the project root if missing.
   - Generate one image per UI screen per selected viewport into `ui_examples/`.
   - Create `ui_examples/ui-consistency-spec.md` and use it as the shared visual lock for all UI image prompts.
   - Filename every UI image with viewport suffix, such as `screen-01-dashboard-desktop.png` or `screen-01-dashboard-mobile.png`.
   - Stop and ask the user to respond with exactly `approved` or `rejected`.
   - If the response is exactly `rejected`, ask what must change, regenerate only the affected images, and ask for `approved` or `rejected` again.
   - For any other response, do not treat the UI phase as complete; ask the user to reply with `approved` or `rejected`.

9. Final review and handoff phase.
   - Continue only after UI screens approval.
   - Check that all expected files exist:
     - `requirements.md`
     - `design.md`
     - `frontend-architecture.md`
     - `backend-architecture.md`
     - `architecture_diagrams/high-level-architecture.mmd`
     - `architecture_diagrams/low-level-architecture.mmd`
     - `architecture_diagrams/high-level-architecture.png`
     - `architecture_diagrams/low-level-architecture.png`
     - `ui_examples/ui-consistency-spec.md`
     - `ui_examples/` with generated screen images
   - Summarize the generated artifacts.
   - Tell the user: if they want any changes, call the particular skill and provide the change prompt; the workflow can continue from that artifact if needed.
   - Map change requests to skills:
     - Requirements changes: `$common-requirements-generator`
     - Design changes: `$common-design-generator`
     - Frontend architecture changes: `$common-frontend-architecture-generator`
     - Backend architecture changes: `$common-backend-architecture-generator`
     - Architecture diagram changes: `$common-architecture-diagram-generator`
     - UI screen image changes: `$common-ui-screen-generator`
   - End with: `go ahead with your implementation :)`

## Hard Rules

- Do not use git commands for this workflow.
- Do not treat a repository as read-only unless the filesystem actually prevents writing.
- Create only the files and folders required by the current approved phase.
- Do not create `index.html`, npm projects, Playwright scripts, browser screenshots, or frontend code unless the user explicitly asks for implementation files.
- Keep every phase grounded in the approved previous artifact.
- Use subagents for requirements, design, frontend architecture, backend architecture, architecture diagrams, and UI screens whenever subagent tools are available. If subagent tools are not available, clearly state that limitation before doing the phase directly.
- Approval gates accept only `approved` or `rejected` after trimming whitespace and ignoring letter case. No other response advances the workflow.
- The tech stack decision accepts only `provide stack`, `recommend stack`, or `compare options` before stack selection; final stack approval still requires `approved`.
- The UI screen output mode accepts only `desktop`, `mobile`, or `both` before UI generation.
- After final approval, check all generated files before handoff.

## Required Skills

- `$common-requirements-generator`
- `$common-design-generator`
- `$common-frontend-architecture-generator`
- `$common-backend-architecture-generator`
- `$common-architecture-diagram-generator`
- `$common-ui-screen-generator`
- `$imagegen`

---
name: common-architecture-diagram-generator
description: Generate high-level and low-level architecture diagrams as Mermaid source files and PNG images for any software project from requirements.md, frontend-architecture.md, backend-architecture.md, approved tech stack, and project context. Use when the user asks for architecture diagrams, high-level architecture, low-level architecture, system diagrams, component diagrams, Mermaid diagrams, or PNG diagram files.
---

# Common Architecture Diagram Generator

## Overview

Use this skill to create architecture diagrams in two formats: editable Mermaid source files and PNG images generated with `$imagegen`. Do not use HTML, Playwright screenshots, or frontend code by default.

## Workflow

1. Gather context.
   - Read approved `requirements.md`.
   - Read approved `frontend-architecture.md`.
   - Read approved `backend-architecture.md`.
   - Use the approved tech stack.

2. Create an architecture diagram plan.
   - High-level diagram: show users, clients, frontend, backend/API, database, external integrations, and deployment boundary.
   - Low-level diagram: show modules/components, API/service boundaries, data stores, async jobs, auth, validation, and key data flows.
   - Keep labels concise and legible.

3. Generate Mermaid files.
   - Create `architecture_diagrams/` at the project root if missing.
   - Generate `architecture_diagrams/high-level-architecture.mmd`.
   - Generate `architecture_diagrams/low-level-architecture.mmd`.
   - Use valid Mermaid syntax.
   - Keep labels short and readable.

4. Generate PNG files with `$imagegen`.
   - Generate `architecture_diagrams/high-level-architecture.png`.
   - Generate `architecture_diagrams/low-level-architecture.png`.
   - Use a consistent visual style across both diagrams.

5. Validate.
   - Diagrams should match the architecture documents.
   - Diagrams should not introduce unapproved services, databases, tools, or integrations.
   - Text must be readable and non-overlapping.
   - Mermaid files should correspond to the same systems and relationships as the PNGs.

## Image Prompt Rules

For each diagram, include:

- Product name.
- Diagram type: high-level or low-level.
- Approved tech stack.
- Nodes and relationships from the architecture docs.
- Clean professional architecture diagram style.
- Consistent colors, shapes, line style, spacing, and typography between both images.
- Instruction: "Use exact same visual system as the paired architecture diagram; no style deviation."

## Output Files

```text
architecture_diagrams/high-level-architecture.mmd
architecture_diagrams/low-level-architecture.mmd
architecture_diagrams/high-level-architecture.png
architecture_diagrams/low-level-architecture.png
```

## Writing Rules

- Use Mermaid for editable source diagrams.
- Use `$imagegen` for the final PNGs.
- Do not create HTML, SVG, npm projects, Playwright scripts, or screenshots unless explicitly requested.
- Keep diagrams grounded in approved documents.
- Prefer simple labels over paragraphs inside nodes.

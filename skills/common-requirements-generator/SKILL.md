---
name: common-requirements-generator
description: Generate or revise a structured requirements.md document for any software product, app, agent, workflow, or tool. Use when the user asks to create requirements, product requirements, PRD-style requirements, MVP requirements, functional requirements, non-functional requirements, user flows, module lists, or a requirements.md file from an idea, notes, conversation, existing design.md, README, or project context.
---

# Common Requirements Generator

## Overview

Use this skill to create a clear `requirements.md` for any project. The output should be implementation-ready enough to guide design, UI generation, architecture, and development, while still staying product-focused rather than over-prescribing code.

## Workflow

1. Gather source context.
   - Use the user's prompt as the primary product brief.
   - Inspect nearby project files when helpful, especially `design.md`, `README.md`, existing specs, notes, screenshots, package metadata, or source structure.
   - If there is already a `requirements.md`, revise it in place only when the user asks to update it; otherwise preserve it and suggest a new file name only if needed.

2. Identify the product shape.
   - Determine the product name, target domain, primary users, main problem, core workflow, and expected outputs.
   - Infer reasonable details only when they are strongly implied.
   - Mark uncertain items as assumptions or open questions rather than pretending they are confirmed.

3. Generate `requirements.md`.
   - Create the file at the project root by default.
   - Use the exact filename `requirements.md` unless the user asks for another name.
   - Keep headings consistent and numbered.
   - Use "shall" for concrete system requirements.
   - Prefer tables for structured inputs, matrices, and comparison data.
   - Include examples only when they clarify expected inputs or outputs.

4. Preserve scope boundaries.
   - Separate MVP features from future enhancements.
   - Include explicit "shall NOT include" items when they prevent scope creep.
   - Avoid adding unsupported integrations, platforms, or advanced capabilities unless the user requested them.

5. Validate the document.
   - Check that every major objective maps to at least one functional requirement.
   - Check that every primary user flow step maps to a feature or module.
   - Check that non-functional requirements cover performance, reliability, accuracy or correctness, usability, security/privacy when relevant, and scalability when relevant.
   - Check that success criteria are measurable enough to judge product completion.

## Default Structure

Use this structure unless the user or existing project conventions require a different one:

```markdown
# Requirements Document

# Product Name

Version: 1.0

---

# 1. Overview

# 2. Problem Statement

# 3. Objectives

# 4. Target Users

# 5. User Inputs

# 6. Functional Requirements

## 6.1 Requirement Area

### Responsibilities

### Output

# 7. Non-Functional Requirements

## Performance

## Reliability

## Accuracy / Correctness

## Usability

## Security and Privacy

## Scalability

# 8. System Modules

# 9. MVP Features

# 10. Success Criteria

# 11. Future Enhancements

# 12. Expected User Flow
```

## Section Guidance

### Overview

Describe the product in 2-4 concise paragraphs:

- What the product is.
- Who it helps.
- What workflow it improves.
- What makes it valuable or different.

### Problem Statement

State the user's pain points as a short narrative plus a numbered list when useful. Focus on real product problems, not implementation details.

### Objectives

Use bullet points beginning with strong verbs such as:

- Enable
- Generate
- Analyze
- Track
- Recommend
- Automate
- Simplify
- Validate

### Target Users

List primary and secondary users. Include roles, not only demographics.

### User Inputs

Use a table when the product accepts structured input:

```markdown
| Input | Description |
| --- | --- |
| Example Input | What the user provides |
```

Add a JSON example only when inputs are API-like, form-like, or useful for later implementation.

### Functional Requirements

Group functional requirements by product capability, workflow step, or module. For each group:

- Start with "The system shall..."
- Include responsibilities.
- Include expected outputs.
- Include state handling when relevant, such as empty, loading, error, partial, success, or review states.
- Include permissions or roles when relevant.

### Non-Functional Requirements

Include only relevant categories, but consider:

- Performance
- Reliability
- Accuracy or correctness
- Usability
- Accessibility
- Security and privacy
- Maintainability
- Scalability
- Compatibility

### System Modules

List modules that naturally follow from the functional requirements. Use product-level names, such as `Input Manager`, `Recommendation Engine`, `Review Workspace`, or `Report Generator`.

### MVP Features

Split into:

- "The first release shall include:"
- "The first release shall NOT include:"

Use this section to keep the scope realistic.

### Success Criteria

Define how the product will be judged successful. Prefer criteria that can be observed, tested, or validated by users.

### Future Enhancements

List optional future capabilities separately from MVP requirements.

### Expected User Flow

Write a numbered end-to-end flow from first user action through final outcome. Keep it product-facing and implementation-neutral.

## Writing Rules

- Use clear, direct product language.
- Keep requirements testable.
- Avoid vague claims like "AI-powered" unless paired with a specific behavior.
- Avoid implementation details unless the user requested a technical requirements document.
- Keep all generated text consistent with any existing project naming.
- Do not invent external dependencies or integrations without user evidence.
- Prefer ASCII punctuation in generated files unless the project already uses another style.

## File Behavior

- Create `requirements.md` at the project root by default.
- If `requirements.md` already exists and the user asked to generate requirements, ask before overwriting unless they explicitly requested replacement.
- If the user asked to update or improve existing requirements, edit the existing file in place.
- If creating requirements from `design.md`, ensure every major designed screen or workflow has a matching requirement.

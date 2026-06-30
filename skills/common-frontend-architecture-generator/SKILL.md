---
name: common-frontend-architecture-generator
description: Generate or revise frontend-architecture.md for any software project from requirements.md, design.md, approved tech stack, and project context. Use when the user asks for frontend architecture, UI architecture, client architecture, frontend folder structure, state management, routing, component architecture, API integration plan, or a frontend-architecture.md file.
---

# Common Frontend Architecture Generator

## Overview

Use this skill to create `frontend-architecture.md` at the project root. The document should translate approved requirements, design direction, and tech stack choices into a practical frontend implementation architecture.

## Workflow

1. Gather context.
   - Read approved `requirements.md`.
   - Read approved `design.md` when present.
   - Use the user's approved tech stack as mandatory input.
   - Inspect existing frontend folders only if the project already has one.

2. Create `frontend-architecture.md`.
   - Use the exact filename unless the user asks otherwise.
   - Keep it implementation-ready but not over-prescriptive.
   - Align component structure with `design.md`.
   - Align routes, states, and data flows with `requirements.md`.

3. Validate.
   - Every major UI workflow should map to a route, screen, or component area.
   - Every required input/output should have frontend handling.
   - State, loading, error, empty, and success handling should be addressed.

## Default Structure

```markdown
# Frontend Architecture

# Product Name

Version: 1.0

---

# 1. Overview

# 2. Tech Stack

# 3. Frontend Goals

# 4. Application Structure

# 5. Routing and Navigation

# 6. Component Architecture

# 7. State Management

# 8. Data Fetching and API Integration

# 9. Forms and Validation

# 10. UI States

# 11. Styling and Design System Usage

# 12. Accessibility

# 13. Performance

# 14. Testing Strategy

# 15. Build and Environment Configuration

# 16. Future Frontend Enhancements
```

## Writing Rules

- Use the approved tech stack exactly; do not swap frameworks without asking.
- If the user gives an incomplete stack, list assumptions clearly.
- Keep the architecture grounded in approved `requirements.md` and `design.md`.
- Do not create frontend code unless explicitly requested.
- Prefer ASCII punctuation.


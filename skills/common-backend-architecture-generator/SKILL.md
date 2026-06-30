---
name: common-backend-architecture-generator
description: Generate or revise backend-architecture.md for any software project from requirements.md, approved tech stack, frontend architecture, and project context. Use when the user asks for backend architecture, API architecture, server architecture, database design, service layers, auth, integrations, deployment shape, or a backend-architecture.md file.
---

# Common Backend Architecture Generator

## Overview

Use this skill to create `backend-architecture.md` at the project root. The document should translate requirements and approved backend tech stack choices into a practical server, API, data, security, and integration architecture.

## Workflow

1. Gather context.
   - Read approved `requirements.md`.
   - Read `frontend-architecture.md` when present.
   - Use the user's approved tech stack as mandatory input.
   - Inspect existing backend folders only if the project already has one.

2. Create `backend-architecture.md`.
   - Use the exact filename unless the user asks otherwise.
   - Define API boundaries, service responsibilities, persistence, auth, validation, error handling, observability, and deployment assumptions.
   - Keep the document implementation-ready but avoid writing code.

3. Validate.
   - Every major functional requirement should map to an API, service, job, or backend responsibility.
   - Every persisted entity should have an owner and storage strategy.
   - Security, privacy, reliability, and scaling concerns should match the product risk.

## Default Structure

```markdown
# Backend Architecture

# Product Name

Version: 1.0

---

# 1. Overview

# 2. Tech Stack

# 3. Backend Goals

# 4. System Context

# 5. API Architecture

# 6. Service and Module Design

# 7. Data Model and Persistence

# 8. Authentication and Authorization

# 9. Validation and Error Handling

# 10. Background Jobs and Async Work

# 11. Integrations

# 12. Security and Privacy

# 13. Observability

# 14. Performance and Scalability

# 15. Deployment and Environment Configuration

# 16. Testing Strategy

# 17. Future Backend Enhancements
```

## Writing Rules

- Use the approved tech stack exactly; do not swap frameworks, databases, or hosting choices without asking.
- If the user gives an incomplete stack, list assumptions clearly.
- Keep the architecture grounded in approved `requirements.md`.
- Do not create backend code unless explicitly requested.
- Prefer ASCII punctuation.


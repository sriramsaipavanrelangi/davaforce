---
name: common-design-generator
description: Generate or revise a structured design.md document for any software product, app, agent, workflow, dashboard, website, or tool. Use when the user asks to create design documentation, UI design guidelines, visual identity, design system rules, app layout guidance, component specifications, responsive behavior, accessibility guidance, or a design.md file from requirements.md, an idea, notes, README, screenshots, or project context.
---

# Common Design Generator

## Overview

Use this skill to create a clear `design.md` for any project. The output should guide UI screen generation, frontend implementation, and visual consistency without becoming a full code implementation.

## Workflow

1. Gather source context.
   - Use the user's prompt as the primary design brief.
   - Read `requirements.md` when present and use it as the main product source.
   - Inspect `README.md`, existing UI files, screenshots, brand notes, or prior specs when useful.
   - If an existing `design.md` exists, revise it in place only when the user asks to update it; otherwise ask before overwriting.

2. Derive product design needs.
   - Identify the product type, primary users, domain, workflow, content density, emotional tone, and core screens.
   - Match the design style to the product's job. For example, operational tools should be efficient and scannable; creative tools can be more expressive; research tools should foreground clarity and trust.
   - Infer visual direction only from available evidence. Mark uncertain brand choices as assumptions when needed.

3. Generate `design.md`.
   - Create the file at the project root by default.
   - Use the exact filename `design.md` unless the user asks for another name.
   - Keep headings consistent and numbered.
   - Include concrete tokens, layout rules, component behavior, responsive behavior, and accessibility requirements.
   - Make the design document specific enough for a UI-screen generator to create coherent screen images.

4. Preserve product fit.
   - Requirements decide what screens and workflows matter.
   - Design decides how those workflows should feel, look, and behave.
   - Avoid generic design language unless it is paired with concrete visual rules.
   - Avoid trendy effects that conflict with the product domain or accessibility.

5. Validate the document.
   - Check that every major workflow in `requirements.md` has corresponding layout or component guidance.
   - Check that colors, typography, spacing, and components are internally consistent.
   - Check that responsive and accessibility sections are practical.
   - Check that UI-screen generation can use the document without guessing the visual language.

## Default Structure

Use this structure unless the user or project conventions require a different one:

```markdown
# Design Document

# Product Name

Version: 1.0

---

# 1. Design Vision

## Design Philosophy

## Design Inspiration

# 2. Visual Identity

## Brand Personality

## Design Keywords

# 3. Theme System

## Primary Theme

## Background

# 4. Color System

## Neutral Palette

## Accent Colors

## Semantic Colors

# 5. Typography

## Typography Philosophy

## Font Family

## Type Scale

# 6. Surface and Elevation Guidelines

# 7. Layout System

## Container Width

## Grid

## Spacing Scale

# 8. Application Structure

# 9. Navigation

# 10. Core Screens

# 11. Component Guidelines

# 12. Forms and Inputs

# 13. Cards, Lists, Tables, or Panels

# 14. Feedback and States

# 15. Motion Design

# 16. Responsive Design

# 17. Accessibility

# 18. Design Principles Summary
```

## Section Guidance

### Design Vision

Describe the intended experience in concrete terms:

- What the interface should feel like.
- What it should help users accomplish.
- What it should avoid.
- How the visual language supports the product's purpose.

### Visual Identity

Define brand personality as a table:

```markdown
| Attribute | Description |
| --- | --- |
| Clear | Helps users understand complex information quickly |
```

Use design keywords only when they are actionable, such as `calm`, `editorial`, `dense`, `premium`, `clinical`, `playful`, `utilitarian`, or `research-focused`.

### Theme System

Specify light, dark, or dual-theme behavior. Include background treatment, surface behavior, and whether the app should feel spacious, compact, immersive, or task-focused.

### Color System

Define:

- Background colors.
- Surface colors.
- Border colors.
- Text colors.
- Primary accent.
- Secondary accent when justified.
- Semantic colors for success, warning, error, and info.

Prefer concrete hex, RGB, HSL, or token values.

### Typography

Define:

- Font family and fallback.
- Type scale.
- Font weights.
- Line-height expectations.
- Rules for headings, body text, labels, captions, and data-dense UI.

### Surface and Elevation Guidelines

Describe cards, panels, modals, dividers, shadows, borders, opacity, and background treatment. Use restraint for decorative effects and prioritize readability.

### Layout System

Specify:

- Max width.
- Grid behavior.
- Main page structure.
- Sidebar or panel widths.
- Spacing scale.
- Content density.
- Alignment rules.

### Application Structure

List the main views or screen types from the requirements. For each, describe the purpose, dominant content, and primary action.

### Navigation

Define top nav, side nav, tabs, breadcrumbs, footer, profile controls, settings, and minimal navigation requirements when relevant.

### Component Guidelines

Describe reusable UI elements such as:

- Buttons.
- Inputs.
- Cards.
- Tables.
- Lists.
- Modals.
- Toolbars.
- Tabs.
- Timelines.
- Empty states.
- Loading states.
- Error states.

### Motion Design

Define motion principles, durations, easing, allowed effects, and effects to avoid. Keep motion purposeful and accessible.

### Responsive Design

Document desktop, tablet, and mobile behavior. Include stacking order, navigation changes, content prioritization, and touch target expectations.

### Accessibility

Include contrast, keyboard navigation, focus states, labels, screen reader support, reduced motion, and target WCAG level when relevant.

## Writing Rules

- Write concrete guidance that another agent can apply directly.
- Match the design to the product domain and audience.
- Prefer consistency over novelty.
- Do not invent a brand logo or visual assets unless the user asks.
- Do not make every product dark, glassy, or gradient-heavy by default.
- Do not describe UI features that are absent from `requirements.md` unless clearly marked as future design support.
- Prefer ASCII punctuation in generated files unless the project already uses another style.

## File Behavior

- Create `design.md` at the project root by default.
- If `design.md` already exists and the user asked to generate a design document, ask before overwriting unless replacement is explicit.
- If the user asked to update or improve an existing design document, edit the existing file in place.
- If creating design from `requirements.md`, ensure every major product area has matching design guidance.

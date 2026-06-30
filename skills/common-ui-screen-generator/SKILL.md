---
name: common-ui-screen-generator
description: Generate consistent UI screen images with the imagegen skill for any project by reading local requirements.md and design.md files. Use when the user asks to create UI screens, screen flows, page mockups, UI images, or UI examples from project requirements and design documentation.
---

# Common UI Screen Generator

## Overview

Use this skill to create UI screen images for any project that provides `requirements.md` and `design.md`. Treat those two files as the source of truth: `requirements.md` defines what the product must do, and `design.md` defines how the product should look and feel. The default deliverable is image files generated through `$imagegen`, not an HTML/CSS prototype.

## Workflow

1. Locate project docs.
   - Find `requirements.md` and `design.md` in the current workspace.
   - If multiple candidates exist, prefer the nearest files to the requested output folder or ask only when the correct pair is ambiguous.
   - If one file is missing, proceed from the available file and clearly state what could not be grounded.

2. Extract product requirements.
   - Read `requirements.md` for product overview, target users, inputs, outputs, functional requirements, non-functional requirements, modules, MVP scope, success criteria, and expected user flow.
   - Convert requirements into screen responsibilities, user actions, data shown, states, validation rules, and navigation steps.
   - Keep UI capabilities inside the documented MVP unless the user explicitly asks for future-facing screens.

3. Extract design rules.
   - Read `design.md` for brand personality, layout system, color palette, typography, components, spacing, motion, responsive behavior, and accessibility requirements.
   - Convert design guidance into shared tokens, layout constraints, component styles, and interaction patterns.
   - Preserve the design document's visual language instead of applying a generic theme.
   - Establish a single shared visual system before generating any images: viewport mode, theme, layout grid, header, navbar/sidebar, navigation items, component shapes, typography, colors, spacing, density, and state styling.

4. Choose viewport output mode.
   - If the user already specified `desktop`, `mobile`, or `both`, use that mode.
   - If the user did not specify a viewport mode, ask them to choose exactly one chat option before generating images:
     1. `desktop` - generate only desktop/PC screens.
     2. `mobile` - generate only mobile screens.
     3. `both` - generate one desktop and one mobile image for every screen.
   - Accept only `desktop`, `mobile`, or `both` for this decision. Any other response should not move forward.
   - Do not mix desktop and mobile layouts in the same image.
   - Use a consistent aspect ratio for each mode: desktop `16:9`, mobile `9:16`, unless the user explicitly requests another ratio.

5. Normalize the requested flow.
   - Treat `screen 1: {}` as an instruction to infer the first logical product screen from `requirements.md`.
   - Treat `screen N: {Name}` as a named screen intent to map to the closest requirement or user-flow step.
   - Treat `screen N: {operating ...}` as an active, processing, editing, or in-progress state for the relevant workflow step.
   - If the user repeats a screen number, preserve their wording in notes but generate sequential screen IDs.

6. Generate the screen set.
   - Each screen must trace to at least one requirement and one design rule when both docs exist.
   - Keep screen names, labels, sample data, and actions in the project's domain language.
   - Share common components and styles across screens.
   - Do not let later screens deviate from the first approved visual system unless the user explicitly asks for a design change.
   - Include empty, loading, success, error, and partial-data states when those states are implied by the requirements.
   - Before image generation, write a single `ui_examples/ui-consistency-spec.md` file that defines the locked app shell and visual system for the run.

7. Generate screen artifacts when requested.
   - If the user asks for "screens" or "screen specs," produce structured screen specifications.
   - If the user asks to create files or UI examples, create image files for the screens using `$imagegen`.
   - If the user does not provide an output folder, create `ui_examples/` at the project root and store all generated screen images there.
   - Use one image file per screen per viewport, with clear names that include the viewport: `screen-01-theme-intake-desktop.png`, `screen-01-theme-intake-mobile.png`, `screen-02-results-desktop.png`.
   - If mode is `desktop`, generate only `*-desktop.png`.
   - If mode is `mobile`, generate only `*-mobile.png`.
   - If mode is `both`, generate matching desktop and mobile files for every screen using the same screen number and name.
   - For each screen, write a compact image prompt that includes the screen purpose, layout, visible UI content, design tokens, visual style, aspect ratio, and an explicit consistency lock.
   - Use the same visual system prompt prefix for every screen so all screens look like the same product.
   - Do not use Playwright, npm, browser rendering, HTML, CSS, canvas, or screenshots as the default path.
   - Do not create `index.html` unless the user explicitly requests a browsable prototype or code implementation.

8. Verify consistency.
   - Check every screen against `requirements.md` for missing required behavior.
   - Check styling against `design.md` for mismatched palette, typography, spacing, layout, motion, or accessibility.
   - Check every generated filename includes the viewport suffix.
   - Check every screen prompt reused the exact same `ui_examples/ui-consistency-spec.md` shell values.
   - Check header, navbar/sidebar, colors, typography, button style, card/panel style, spacing, and background treatment are the same across all images for the same viewport.
   - For image output, verify that each image exists, is non-empty, and visually represents the intended screen when practical.

## Screen Spec Format

Use this format when producing screen specifications:

```markdown
## Screen N: Screen Name

Purpose:
Requirement source:
Design source:
Primary user action:
Secondary actions:
Visible content:
Component hierarchy:
States:
Interactions:
Responsive behavior:
Accessibility notes:
```

## Image Output Guidance

When generating UI screen files:

- Put screens in the user-requested folder, or default to a project-root `ui_examples/` folder.
- Create `ui_examples/` when it does not already exist.
- Store every generated screen image under `ui_examples/`, using clear names that include viewport mode, such as `screen-01-theme-intake-desktop.png`, `screen-01-theme-intake-mobile.png`, or `screen-02-results-desktop.png`.
- Store the shared lock file as `ui_examples/ui-consistency-spec.md`.
- Prefer PNG for final screen images unless the user requests another image format.
- Use `$imagegen` directly for each screen image.
- Do not create supporting HTML/CSS/JS/render helpers unless the user asks for implementation files.
- Do not make `index.html` the primary output. The final useful artifacts should be images that can be opened individually.
- Keep shared visual decisions consistent across image prompts: design tokens, layout primitives, navigation, component styling, spacing, and typography.
- Build a shared "visual consistency lock" from `design.md` and prepend it to every image prompt.
- Do not change theme, palette, layout density, component radius, typography style, navigation placement, or card/table/panel treatment between screens.
- Do not change header layout, navbar/sidebar placement, menu labels, logo placement, account controls, search location, primary action placement, or page shell between screens.
- Use realistic placeholder data derived from `requirements.md`, not generic lorem ipsum.
- Maintain a single navigation and interaction model across all screens.
- Make the first screen a usable product screen, not a marketing landing page, unless the docs require a landing page.
- Keep generated UI faithful to `design.md` even when the design style differs from personal preference.

## Image Prompt Rules

For each screen image, include:

- Product name and screen name.
- Viewport mode and exact aspect ratio: desktop `16:9` or mobile `9:16`.
- Exact screen purpose and user state.
- The same visible app shell on every screen: header, navbar/sidebar, logo area, nav item labels, account/profile controls, primary action area, and content container.
- Visible navigation, main regions, controls, cards, tables, forms, or panels.
- Realistic sample content from `requirements.md`.
- Visual style from `design.md`, including colors, typography, spacing, density, borders, and mood.
- Responsive target, such as desktop `16:9`, mobile `9:16`, or the size requested by the user.
- Instruction that text must be legible, aligned, and not overlapping.
- A consistency lock stating: "Use the exact same product UI system as the other generated screens; no visual redesign, no palette shift, no component style changes, no layout language changes."

Generate separate images for separate screens. Do not ask the image model to make a multi-screen collage unless the user explicitly requests a combined overview image.

## Consistency Lock

Before generating images, write `ui_examples/ui-consistency-spec.md` and reuse it as the exact shared prompt prefix for every image:

```text
Product UI consistency lock:
- Viewport mode:
- Aspect ratio:
- Theme:
- Palette:
- Typography:
- Header:
- Navbar/sidebar:
- Navigation item labels:
- Logo placement:
- Account/profile controls:
- Layout grid:
- Component style:
- Button style:
- Input style:
- Card/panel/table style:
- Icon style:
- Background treatment:
- Spacing/density:
- Motion/state visual language:
- Do not deviate across screens.
```

Use this exact prefix for every screen prompt. Only screen-specific content should change.

## Viewport Naming Rules

- Desktop-only run: `ui_examples/screen-NN-screen-name-desktop.png`.
- Mobile-only run: `ui_examples/screen-NN-screen-name-mobile.png`.
- Both run: create both files for every screen:
  - `ui_examples/screen-NN-screen-name-desktop.png`
  - `ui_examples/screen-NN-screen-name-mobile.png`
- Do not produce unsuffixed names like `screen-01-dashboard.png`.

## Generic Mapping Heuristics

Use the requirements document to identify:

- Intake screens from documented user inputs.
- Dashboard or workspace screens from core product modules.
- Detail screens from entities, records, documents, ideas, tasks, projects, or other primary objects.
- Processing screens from requirements involving analysis, generation, import, export, search, ranking, automation, or async work.
- Review screens from requirements involving comparison, validation, approval, editing, or decision-making.
- Output screens from documented reports, summaries, blueprints, plans, generated assets, or final deliverables.

Use the design document to decide:

- Visual tone and brand personality.
- Color tokens and semantic states.
- Typography scale and hierarchy.
- Navigation layout.
- Card, panel, table, form, modal, or timeline treatment.
- Desktop, tablet, and mobile layout changes.
- Motion and hover behavior.
- Accessibility expectations.

## Consistency Rules

- Requirements decide content and behavior.
- Design decides visual presentation and interaction style.
- `$imagegen` creates the final image artifacts.
- Do not invent unrelated screens just to fill a flow.
- Do not omit a required input, output, or user-flow step when it is relevant to the requested screens.
- Do not mix design systems across screens.
- Do not mix viewport modes unless the selected mode is `both`, and even then create separate desktop and mobile files.
- Do not use project-specific assumptions from any previous repository.
- If a requested screen name conflicts with the documents, mention the conflict and choose the closest documented interpretation.

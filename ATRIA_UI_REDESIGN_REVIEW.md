# Atria UI/UX Redesign — Gemini Review & Implementation Direction

## Your Role

You are the **UI/UX reviewer, product architect, and implementation planner** for this redesign. Claude is the implementation engineer.

Your job is not to blindly approve the existing UI or immediately propose code. First inspect the current application against the redesign vision below. Then:

1. Identify what must change.
2. Identify architectural implications before implementation.
3. Challenge unclear or unnecessarily complex decisions.
4. Simplify wherever possible without losing the product vision.
5. Produce a clear phased implementation plan for Claude.
6. Review Claude's work after each meaningful phase before approving the next phase.

The goal is not merely to make Atria prettier. The goal is to redesign it around a clearer interaction model.

---

# 1. Core Redesign Vision

Atria should feel like opening a **beautiful physical project binder**.

A project is a persistent, navigable binder:

- The binder has tabs.
- Tabs can have nested sub-tabs.
- A selected tab displays its content in the main canvas.
- Content can include text and files.
- The entire structure should feel flexible and easy to reorganize.

The central mental model is:

> **Project → Binder → Tabs / Sub-tabs → Ordered Content**

The UI should make this structure immediately understandable without explanation.

---

# 2. Primary Layout

When a user opens a project, use a persistent two-column layout:

```text
┌──────────────────────┬──────────────────────────────────────────────┐
│                      │                                              │
│ PROJECT NAME         │              PROJECT CONTENT                 │
│                      │                                              │
│ + New Tab            │                                              │
│                      │                                              │
│ Tab 1                │                                              │
│ Tab 2                │                                              │
│ Tab 3                │                                              │
│   Sub-tab A          │                                              │
│   Sub-tab B          │                                              │
│ Tab 4                │                                              │
│                      │                                              │
└──────────────────────┴──────────────────────────────────────────────┘
```

## Left Sidebar

The sidebar represents the physical metaphor of the binder's tab structure.

It contains:

- Project identity/name.
- A clear action for creating a new tab.
- Top-level tabs.
- Nested sub-tabs.
- Clear visual hierarchy.
- Clear active state.

The sidebar should remain visible while navigating inside a project on desktop.

## Main Canvas

The main area displays either:

1. The project overview/home, or
2. The selected tab and its ordered content.

Switching tabs should feel immediate. The user should never feel like they have left the project.

---

# 3. Project Home

The project home should be more editorial and identity-focused than a working tab.

It may contain:

- Large project cover image.
- Project name.
- Project description.
- Project overview or introductory information.

Important distinction:

> **Project Home = identity and overview.**
>
> **Tab = focused working/content space.**

Do not waste large amounts of vertical space inside every tab with a large project hero. Inside tabs, project context should be compact.

---

# 4. Tabs and Sub-tabs

Tabs are the primary organizational primitive.

Example:

```text
Interior Design Project

Kitchen
Living Room
Bathroom
    Inspiration
    Materials
    Suppliers
Budget
Contracts
```

Requirements:

- Tabs can be nested.
- Hierarchy must remain understandable at a glance.
- Use restrained indentation.
- Reinforce the **binder/tab metaphor**.
- Avoid making the sidebar look like a generic operating-system file explorer.

Do not over-design this with excessive folder icons, borders, disclosure controls, or enterprise UI patterns.

---

# 5. Critical Interaction Principle — Everything Is Draggable

This is a fundamental requirement.

The project should feel flexible and physically reorganizable.

## 5.1 Tabs

Users must be able to drag tabs to reorder them.

## 5.2 Hierarchical Tab Movement

Users should be able to reorganize tabs and sub-tabs through drag and drop where safely supported.

Potential operations:

- Reorder siblings.
- Move a sub-tab to another parent.
- Promote a sub-tab to top level.
- Nest a top-level tab under another tab.

The UX must make valid drop targets understandable and prevent invalid hierarchy states.

## 5.3 Content

Within a tab, all content blocks must be reorderable.

Example:

```text
Before:
[Text]
[Photo]
[PDF]
[Photo]

After dragging:
[Photo]
[Text]
[Photo]
[PDF]
```

The order of content is meaningful and must persist.

## 5.4 Dragging Is Not Decorative

Drag-and-drop must update persistent data correctly.

Gemini must verify:

- Ordering persists after refresh.
- Nested tab movement persists correctly.
- No duplicate or lost content.
- Safe behavior during failed persistence.
- Clear desktop drag behavior.
- A reasonable touch/mobile strategy.

---

# 6. Tab Content Model

A tab behaves like a simple ordered project canvas.

For MVP, keep content primitives intentionally minimal:

1. **Text**
2. **Files**

Files should render according to type:

- Images → visual previews/gallery presentation.
- Videos → visual preview with playback affordance.
- PDFs/documents → compact document cards with useful metadata and preview/open actions where supported.
- Spreadsheets → file card or meaningful preview if already feasible.

Do not create a universal document editor.

The core value is:

> **Text + real project assets in one ordered context.**

---

# 7. Content Layout Philosophy

Content should flow vertically as an ordered stream.

Example:

```text
Kitchen Inspiration

Some introductory text.

[Photo] [Photo] [Photo]

Floor plan.pdf

More notes.

Budget.xlsx
```

Files should not all look identical:

- Images are visual-first.
- Documents are compact and identifiable.
- Text is calm and easy to read/edit.

The overall experience should feel like a curated project page, not a raw filesystem.

---

# 8. Tab Header

Selected tabs should have a simple header containing:

- Tab name.
- Add action.
- Search only if search remains useful in the current scope.

Concept:

```text
────────────────────────────────────────
Kitchen                         + Add  🔍
────────────────────────────────────────
```

Do not fill the header with unnecessary controls.

---

# 9. Adding Content

The `+ Add` interaction should remain simple and contextual.

For MVP, likely actions:

- Add text.
- Upload/add file.
- Create a sub-tab where contextually appropriate.

Do not introduce a complex Notion-style ecosystem of block types.

---

# 10. Design Character

The redesign should feel:

- Calm.
- Beautiful.
- Editorial.
- Spacious.
- Intentional.
- Modern.
- Tactile without being gimmicky.

It should NOT feel like:

- Enterprise SaaS.
- Generic admin dashboard.
- Dropbox/Google Drive clone.
- Traditional filesystem.
- Notion clone.
- Task management application.

Avoid:

- Excessive cards.
- Excessive borders.
- Too many icons.
- Dense toolbars.
- Status badges.
- Dashboard widgets.
- Heavy shadows.
- Decorative complexity.

Whitespace and hierarchy should do more work than containers and borders.

---

# 11. Product Simplification

The redesign should strengthen this mental model:

```text
Project
  └── Tabs
       ├── Sub-tabs
       └── Ordered Content
            ├── Text
            └── Files
```

Do not preserve old concepts merely because they already exist in the codebase.

If existing UI concepts conflict with the new binder/tab model, identify them explicitly.

However:

> Do not rewrite working infrastructure unnecessarily.

Separate:

- UI concepts that should change.
- Component architecture changes.
- Data model changes that are truly necessary.
- Backend infrastructure that can remain untouched.

---

# 12. Gemini Review Process Before Claude Starts

Before giving Claude implementation instructions:

## Step 1 — Inspect the Current Application

Read:

- PRODUCT.md
- CLAUDE.md
- GEMINI.md
- PROJECT_STATE.md or equivalent state documentation
- Current source code
- Current database schema
- Existing drag/drop implementation, if any

Understand what exists before recommending changes.

## Step 2 — Compare Current Product Against This Vision

Produce a concise audit:

### A. Current State
What currently exists?

### B. Alignment
What already matches the redesign?

### C. Conflicts
What contradicts the new binder/tab model?

### D. Required Changes
Separate into:

- UI changes
- Component architecture changes
- Data model changes
- Interaction changes

### E. Risks
Identify migration, ordering, nesting, drag/drop, persistence, and mobile risks.

## Step 3 — Challenge the Design

Do not assume every sketch detail is optimal.

Simplify where possible, especially around:

- Sidebar hierarchy depth.
- Tab drag/drop behavior.
- Nested tab interactions.
- Content ordering.
- Mobile responsiveness.
- Empty states.
- Adding content.
- Avoiding Notion-like complexity.

## Step 4 — Produce an Implementation Plan

Do not recommend one uncontrolled massive redesign.

Suggested sequence:

### Phase 1 — Information Architecture
Validate project shell, sidebar, tab hierarchy, and data requirements.

### Phase 2 — Project Shell
Implement persistent project sidebar and main canvas.

### Phase 3 — Project Home
Redesign the project overview/home.

### Phase 4 — Tab Canvas
Redesign selected tab experience and ordered content stream.

### Phase 5 — Drag and Drop
Implement and verify:

- Tab ordering.
- Nested tab movement.
- Content ordering.
- Persistent state.

### Phase 6 — Polish
Empty states, loading states, responsiveness, keyboard/accessibility behavior, and visual refinement.

Adjust this sequence only if the current codebase clearly suggests a safer approach.

---

# 13. Instructions Gemini Should Pass to Claude

When ready, give Claude instructions that are:

- Specific.
- Scoped to one current phase.
- Explicit about likely affected files/components.
- Explicit about acceptance criteria.
- Clear about what NOT to change.

Never say only:

> "Redesign the UI to look better."

Instead provide instructions like:

> "Implement the persistent two-column project shell. The left sidebar represents the tab hierarchy and remains visible on desktop. Do not modify authentication, storage, or unrelated file persistence logic. Reuse the existing tab data model where possible."

Every phase should have measurable acceptance criteria.

---

# 14. Review Gate After Claude's Work

After Claude completes a phase:

1. Inspect the actual code changes.
2. Compare them against this redesign vision.
3. Check for unnecessary complexity.
4. Check for regressions.
5. Verify the interaction model.
6. Identify missing edge cases.
7. Only then approve the next phase.

Do not simply trust Claude's summary. Review the repository state.

---

# 15. Drag-and-Drop Acceptance Criteria

Before considering the redesign complete, verify:

## Tabs

- Top-level tabs can be reordered.
- Sub-tabs can be reordered.
- Valid parent/child movement works correctly.
- Ordering persists after refresh.
- Invalid hierarchy states are prevented.
- No tab disappears or duplicates during movement.

## Content

- Content blocks can be reordered.
- Ordering persists after refresh.
- Text and files coexist in one ordered stream.
- Rapid repeated drag operations do not corrupt ordering.

## UX

- Drag affordances are discoverable without excessive clutter.
- Drop feedback is clear.
- Failed persistence does not silently lose intended state.
- Touch/mobile has a reasonable strategy.

---

# 16. Explicit Non-Goals

Do not use this redesign as an excuse to add:

- Task management.
- Checklists.
- Kanban boards.
- Gantt charts.
- CRM.
- Team chat.
- Comments systems.
- AI features.
- Databases inside tabs.
- Notion-style complex blocks.
- Generic cloud-drive features unrelated to the binder experience.

The product becomes stronger through clarity, not feature count.

---

# 17. Definition of Success

The redesign is successful if a new user intuitively understands:

1. "I am inside a project."
2. "These items on the left are the sections of my project."
3. "I can organize those sections however I want."
4. "I can open a section and place text and real project files together."
5. "I can reorder both the structure and the content."

The ideal feeling is:

> **This feels like my own physical project binder, but digital.**

Not:

> **This is another complicated project management tool.**

---

# Immediate Task

Do not modify the application yet.

First inspect the current repository and perform the redesign audit described above.

Then produce:

1. Current implementation assessment.
2. Alignment/conflict analysis.
3. Recommended information architecture.
4. Required data model changes, if any.
5. Drag-and-drop architecture considerations.
6. Simplification recommendations.
7. A phased implementation plan for Claude.

Wait for approval before instructing Claude to begin implementation.

# Atria — Claude Development Instructions

## 1. Product

Atria is a simple, beautiful web application for organizing the digital materials of real-world projects.

Examples of projects:

* Interior design
* Wedding planning
* Home renovation
* Events
* Architecture
* Photography
* Construction
* Creative productions
* Any project where many files, references, documents, images and videos need to be organized

### Core concept

Atria should feel like a **beautiful digital binder for a project**.

The central mental model is:

**Atria**
→ Projects
→ Project Digital Binder
→ User-defined Tabs (Dividers)
→ Files and information

A project should feel like a physical project binder or beautifully organized archive, but significantly better because it is digital, searchable, visual and easy to navigate.

The product should NOT feel like traditional project-management software.

Avoid turning Atria into:

* Jira
* Asana
* Monday
* Notion
* Trello
* CRM software
* A generic file-storage product
* A complicated document-management system

The product's value is **clarity, organization and beauty**.

---

# 2. Product Philosophy

Every feature must support one of these goals:

1. Make projects easier to understand.
2. Make project materials easier to find.
3. Make project materials easier to organize.
4. Make projects feel calm and visually beautiful.
5. Reduce the mental overhead of managing project information.

If a feature does not clearly support one of these goals, question whether it belongs in Atria.

### Simplicity is a feature.

When there are two reasonable implementations, prefer the simpler one.

When there are two reasonable UI designs, prefer the one requiring fewer decisions.

Do not add functionality merely because competing project-management products have it.

---

# 3. Core Information Architecture

The basic hierarchy is:

**Workspace**
→ **Projects**
→ **Project Digital Binder**
→ **Tabs (top-level folders) / subfolders**
→ **Files**

A project's Binder is divided into **Tabs** — user-named sections (e.g. "Kitchen," "Contracts & Permits"), not fixed file-type categories. There is no preset list of spaces; the user creates, renames, and deletes Tabs freely. A Tab may contain subfolders where useful.

The user should immediately understand where something belongs.

---

# 4. The Digital Binder

The **Digital Binder** is the heart of Atria.

It should feel like the central home of a project.

A project page should answer immediately:

> "What is this project and where is everything?"

Its Tabs open directly on the Project Home page — clicking a Tab expands it in place; clicking it again collapses it. The Binder should support:

* Tabs (create, rename, delete)
* Files and subfolders within a Tab
* Type-appropriate previews (images, video, documents) inside a Tab — not separate file-type pages
* Search and sorting within a Tab
* Basic metadata
* Uploading (including drag-and-drop)
* Moving
* Renaming
* Deleting
* Downloading

The experience should feel closer to a beautifully designed file browser/library than a traditional project-management dashboard.

---

# 5. MVP Scope

The MVP should be intentionally small.

### Must-have

## Projects

* Create project
* Rename project
* Delete/archive project
* Project cover/image
* Project description/basic metadata
* Project list
* Open project

## Project organization

* Digital Binder with user-defined Tabs (create, rename, delete)
* Create folders within a Tab where appropriate
* Navigate folders
* Breadcrumb navigation

## Files

* Upload
* Preview
* Download
* Rename
* Move
* Delete
* File metadata
* Basic search
* Basic sorting

## Sharing / access

Implement only the minimum necessary access model for the MVP.

The architecture should allow permissions to evolve later.

Do not build a sophisticated enterprise permission system unless required.

---

# 6. Explicitly DO NOT Build Yet

Unless explicitly instructed by the product owner, do NOT build:

* Task management
* Kanban boards
* Gantt charts
* Time tracking
* CRM
* Chat
* Messaging
* Invoicing
* Payments
* Advanced analytics
* AI assistants
* Automated workflows
* Complex calendars
* Team productivity dashboards
* Notifications infrastructure
* Social/community features
* Complex approval workflows
* Enterprise administration
* Advanced integrations

If a feature seems useful but is outside the MVP, document it as a future idea rather than implementing it.

---

# 7. UI / UX Principles

Atria should feel:

* Calm
* Premium
* Modern
* Spacious
* Intuitive
* Visual
* Fast
* Minimal

Avoid:

* Excessive buttons
* Dense dashboards
* Excessive cards
* Unnecessary badges
* Decorative UI without purpose
* Deep navigation
* Tiny controls
* Overly technical terminology
* Excessive modals
* Configuration screens everywhere

### The user should rarely ask:

> "What am I supposed to do here?"

If they do, the design should be reconsidered.

---

# 8. File Browser Philosophy

The file browser is one of Atria's most important components.

Prioritize:

* Visual hierarchy
* Clear folder structure
* Excellent previews
* Drag-and-drop where appropriate
* Fast navigation
* Clear breadcrumbs
* Obvious upload actions
* Good empty states
* Consistent file representations

Images and videos should feel visual.

Documents should feel organized.

The interface should communicate what is inside a folder before the user opens everything.

---

# 9. Technical Philosophy

Prefer boring, reliable technology over unnecessary complexity.

Use a clean architecture with clear separation between:

* UI
* Application/business logic
* Data access
* Storage
* Authentication
* Backend/API

Avoid unnecessary abstractions.

Do not create abstractions merely because they look architecturally sophisticated.

### Important

The application should be easy for another developer or AI agent to understand.

Prefer:

* Small components
* Clear naming
* Predictable data models
* Explicit business logic
* Reusable UI primitives
* Minimal dependencies

Avoid:

* Giant components
* Duplicate logic
* Magic behavior
* Hidden side effects
* Premature optimization

---

# 10. Data and File Storage

Treat project metadata and actual files as different concerns.

Project/folder/file metadata should be stored in the application's database.

Actual binary files should be stored in appropriate object/file storage.

A file record should contain enough metadata to locate and display the file without requiring the UI to inspect the binary itself.

Design the schema so that:

* Projects belong to a workspace/user
* Folders belong to projects/folders
* Files belong to folders/projects
* Ownership/access can be enforced server-side

Never rely solely on UI restrictions for authorization.

---

# 11. Security

Security must be enforced server-side.

Never trust:

* Client-supplied user IDs
* Client-supplied ownership
* Client-supplied permissions
* Client-supplied project IDs
* Client-supplied file ownership
* Client-supplied access roles

Users must only be able to access projects and files they are authorized to access.

Cross-workspace/project data access must be prevented.

---

# 12. Performance

Atria is fundamentally a file-heavy application.

Performance is therefore a product feature.

Pay attention to:

* Large image previews
* Video loading
* Lazy loading
* Thumbnail generation
* Large folders
* Upload progress
* Upload failures
* Slow networks
* Large files
* Browser memory usage

Do not load an entire project library into memory unnecessarily.

---

# 13. Empty States

Empty states are important.

A new project should not feel broken.

Instead, empty states should explain:

* What belongs here
* What the user can do
* How to add the first item

Keep them concise and beautiful.

---

# 14. Error Handling

Never silently fail.

Important operations should communicate:

* Upload failure
* Delete failure
* Rename failure
* Permission failure
* Network failure
* File too large
* Unsupported file
* Authentication failure

Errors should be understandable to a normal user.

Do not expose technical stack traces or backend terminology.

---

# 15. Development Workflow

Claude is the primary implementation agent.

Before implementing a meaningful feature:

1. Understand the existing architecture.
2. Inspect existing components before creating new ones.
3. Check whether the functionality already exists.
4. Prefer modifying existing abstractions over duplicating them.
5. Keep changes focused.
6. Run relevant tests.
7. Verify the application builds.
8. Review the UI after implementation.

Do not rewrite working systems without a clear reason.

---

# 16. Feature Discipline

Before implementing any requested feature, ask:

### Does this strengthen the core Atria experience?

If yes:

* Implement simply.

If unclear:

* Prefer the smallest version.

If no:

* Do not implement unless explicitly instructed.

Never expand the product scope on your own.

---

# 17. Definition of Done

A feature is not done simply because the code compiles.

Before considering work complete:

* Code builds successfully.
* Relevant tests pass.
* Existing functionality still works.
* Loading states exist where needed.
* Empty states exist where needed.
* Error states exist where needed.
* Permissions are enforced.
* Mobile/browser responsiveness is considered.
* UI is visually consistent with Atria.
* No unnecessary complexity was introduced.

---

# 18. Communication

When reporting completed work, be concise.

Report:

1. What changed.
2. What was tested.
3. Any known limitations.
4. Anything that should be reviewed.

Do not claim something is "production ready" without evidence.

Use explicit status:

* 🟢 Proven — automated test/build evidence
* 🟡 Manually verified — verified in browser/device
* 🔴 Not yet verified — still requires validation

---

# 19. Relationship With Gemini

Claude is the **primary worker/implementer**.

Gemini is the **reviewer**.

Claude should assume Gemini will inspect the work critically.

Do not optimize for satisfying the reviewer.

Optimize for:

* Correctness
* Simplicity
* Maintainability
* Excellent UX
* Product coherence

---

# 20. Product North Star

Whenever there is uncertainty, return to this:

> **Atria is a beautiful digital binder for real-world projects.**

The user should be able to open a project and immediately understand:

**What is this project?**

**Where is everything?**

**How do I find what I need?**

If Atria accomplishes those three things exceptionally well, the MVP is successful.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

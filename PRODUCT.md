# Atria — Product Definition

## 1. Product Vision

Atria is a **beautiful digital binder** for real-world projects.

It is designed for projects where people accumulate many different types of information and files over time.

Examples include:

* Interior design projects
* Wedding planning
* Home renovation
* Architecture projects
* Events
* Construction
* Photography
* Creative productions
* Personal projects

Atria gives each project one clear digital home.

The goal is not to manage every aspect of a project.

The goal is to make the project's information **organized, accessible, visual and beautiful**.

---

# 2. The Core Idea

The fundamental mental model is:

**A Project = A Digital Binder**

Inside the project, information is organized into user-defined **Tabs** (also called Dividers) — the sections of the binder, named for whatever makes sense to that project.

For example:

```text
Project (Digital Binder)
│
├── Kitchen
├── Living Room
├── Contracts & Permits
├── Inspiration
└── ...
```

A Tab can hold files directly and, where useful, nested Sub-tabs within it. The exact set of Tabs is entirely up to the user — Atria doesn't impose a fixed structure like "Photos / Videos / Documents." The principle should remain:

> **Everything belonging to a project should have an obvious home.**

Atria should feel closer to opening a beautifully organized physical binder than opening traditional project-management software.

---

# 3. Why Atria Exists

Existing project-management products often focus on:

* Tasks
* Deadlines
* Boards
* Assignments
* Statuses
* Productivity
* Team management

Cloud storage products focus primarily on storing files.

Atria sits between these concepts.

It is designed around the **project itself**.

A project is not just a list of tasks and it is not just a pile of files.

It is a collection of:

* Documents
* Photos
* Videos
* References
* Plans
* Files
* Information
* Materials

Atria should give this collection a clear and beautiful structure.

---

# 4. Product Principles

## Simplicity

Atria should be immediately understandable.

A new user should not need a tutorial to understand the basic product.

## Beauty

The interface should feel premium, calm and intentional.

Visual design is part of the product, not decoration added afterward.

## Clarity

The user should always understand:

* What project they are in
* Where they are inside the project
* What is contained in the current location
* How to add something
* How to get back

## Organization

Information should have a clear home.

The product should reduce the feeling of:

> "I know I saved it somewhere, but I don't remember where."

## Calmness

Atria should not overwhelm users with dashboards, notifications, badges and controls.

The product should make complex projects feel simpler.

---

# 5. Target User

The initial target user is someone who manages projects that generate many digital materials.

The user does not necessarily consider themselves a "project manager."

Examples:

* Interior designer
* Wedding planner
* Architect
* Contractor
* Photographer
* Event planner
* Designer
* Home renovator
* Small creative team
* Individual managing a complex personal project

Atria should work for both professionals and individuals.

---

# 6. Core User Experience

The primary experience is:

```text
Open Atria
    ↓
See Projects
    ↓
Open a Project
    ↓
Understand the project immediately
    ↓
Enter the relevant space
    ↓
Find / view / add material
```

The experience should be fast and obvious.

A user should not have to navigate through multiple administrative screens before reaching their project.

---

# 7. Project

A Project is the primary organizational unit in Atria.

A project should contain enough information to identify and understand it.

At minimum:

* Project name
* Project image/cover
* Optional description
* Project contents

A project should have a visually recognizable identity.

Examples:

```text
Sarah & David — Wedding
```

```text
Tel Aviv Apartment Renovation
```

```text
Villa Interior Design — Herzliya
```

---

# 8. Project Home

The Project Home is the main entry point into a project.

It should communicate:

> "This is everything related to this project."

The Project Home should provide access to the project's Binder — its Tabs, opened directly on this page.

The exact visual design is open to implementation, but the experience should remain simple.

Additional project information may appear on the Project Home when it adds real value.

Do not turn the Project Home into a traditional project-management dashboard.

---

# 9. Digital Binder

The Digital Binder is the **core of Atria**.

It is the primary flexible storage space inside a project, opened directly on the Project Home page.

A Binder is divided into **Tabs** (also called Dividers) — user-named sections, not fixed file-type categories. Users create, rename, and delete Tabs freely, and a Tab may itself contain nested Sub-tabs where useful, recursively.

Example:

```text
Digital Binder
│
├── Contracts
├── Inspiration
├── Floor Plans
├── Suppliers
│   ├── Kitchen
│   ├── Lighting
│   └── Furniture
└── Final
```

Clicking a Tab opens it directly below the tab strip; clicking it again closes it. The user owns the organization — Atria provides structure without forcing a rigid one.

Files of any type — images, videos, PDFs, plans, spreadsheets — live together inside a Tab and are still shown with type-appropriate previews (see §11 Files), rather than being routed into separate Photos/Videos/Documents spaces.

---

# 11. Files

Files are fundamental objects in Atria.

A file should have:

* Name
* Type
* Size
* Creation/upload information
* Location
* Preview when possible

Core operations:

* Upload
* View/preview
* Download
* Rename
* Move
* Delete

Additional operations should only be added when they clearly improve the core experience.

---

# 12. Tabs & Sub-tabs

Every level of the Binder's hierarchy is a **Tab** — top-level Tabs (Kitchen, Contracts) and, recursively, Sub-tabs nested inside any Tab (Kitchen → Cabinetry → Hardware) to any depth. The underlying mechanism is a folder hierarchy, but the product never surfaces file-cabinet language or iconography for it — a Tab reads as a page in the notebook, not a folder in a file browser.

Users should be able to:

* Create Tabs and Sub-tabs
* Open Tabs and Sub-tabs
* Rename Tabs and Sub-tabs
* Move Sub-tabs where appropriate
* Delete Tabs and Sub-tabs
* Navigate using breadcrumbs

Tab hierarchy should remain understandable, however deep it goes.

Avoid unnecessary nesting restrictions or complicated folder-management systems in the MVP.

---

# 13. Search

Search should help users find project material quickly.

The MVP should prioritize simple, useful search.

Search should eventually be capable of finding:

* Projects
* Files
* Tabs & Sub-tabs

Search should not require users to understand a complex query language.

---

# 14. Navigation

Navigation should answer three questions:

1. Where am I?
2. What can I access from here?
3. How do I go back?

Breadcrumbs should be used inside folder hierarchies where appropriate.

Navigation should remain shallow and predictable.

---

# 15. Sharing and Collaboration

Atria is intended to eventually support collaboration around projects.

However, collaboration should not turn the MVP into a social network or enterprise collaboration platform.

The MVP should implement only the minimum access/sharing functionality necessary for the initial product.

The architecture should allow more sophisticated permissions later.

Potential future concepts include:

* Project members
* Viewer access
* Editor access
* Client access
* Shared projects

These are future possibilities unless explicitly included in the current MVP implementation.

---

# 16. MVP

The Atria MVP exists to validate one core hypothesis:

> **People want a simple, beautiful place where everything belonging to a project is organized and easy to access.**

### MVP must provide

## Projects

* Create project
* View projects
* Open project
* Rename project
* Delete/archive project
* Project cover/image
* Basic project information

## Project organization

* Project Home
* Digital Binder (Tabs)
* Tab creation, rename, delete
* Sub-tab creation within a Tab, recursively
* Sub-tab navigation
* Breadcrumbs

## Files

* Upload
* Preview
* Download
* Rename
* Move
* Delete
* File metadata
* Basic search

## Notebook blocks

Within a Tab or Sub-tab, content is a linear, user-ordered stream of two
block primitives — Text and File — rather than a type-sorted grid. A File
block auto-renders based on what it is (photo preview, video player,
document attachment).

* Text blocks, with a formatting toolbar (headings, bold/italic/underline/
  code, bulleted and numbered lists, tables) — stored as markdown
* File blocks: photos (with optional captions), documents, and videos,
  wrapping an uploaded file
* Drag-and-drop reordering via a grip handle
* A hover insert-bar between any two blocks to add a new one at that exact
  position, including dropping files directly at a specific spot
* Search across a Tab's block stream

## Account

* Authentication
* User identity
* Basic ownership/access control

---

# 17. Explicit MVP Non-Goals

The MVP should NOT attempt to become a complete project-management suite.

Do not add:

* Task management
* Kanban boards
* Gantt charts
* Time tracking
* CRM
* Invoicing
* Payments
* Chat
* Messaging
* Advanced calendars
* Complex scheduling
* Advanced analytics
* AI assistants
* Workflow automation
* Enterprise administration
* Social feeds
* Notification systems
* Complex approval workflows

These may be evaluated in the future.

They are not part of the current product definition.

---

# 18. The "Would This Help?" Test

When considering a feature, ask:

### Does this make it easier to organize, understand, find or view project information?

If yes:

→ Consider it.

If it solves a real problem but is not necessary for the MVP:

→ Document it for later.

If it primarily adds another project-management capability:

→ Reject it for the MVP.

---

# 19. Visual Direction

Atria should feel:

* Premium
* Minimal
* Calm
* Spacious
* Elegant
* Modern
* Visual
* Organized

The design should prioritize:

* Typography
* Spacing
* Hierarchy
* Imagery
* Consistency
* Subtle interaction
* Excellent empty states
* Beautiful file previews

Avoid visual noise.

Avoid excessive:

* Cards
* Borders
* Badges
* Buttons
* Icons
* Shadows
* Gradients
* Colors
* Dashboards

The product should feel confident enough not to fill every available space.

---

# 20. Desktop and Mobile Web

Atria is a web application.

Desktop is expected to be the primary environment for working with large project libraries.

Mobile web should still provide a good experience for:

* Browsing projects
* Finding files
* Viewing photos
* Viewing documents
* Uploading files
* Basic project navigation

Responsive behavior should be considered from the beginning rather than added at the end.

---

# 21. Empty Projects

An empty project should feel inviting rather than broken.

A new project should communicate:

> "This is your project's home. Start organizing it here."

Empty states should explain the next useful action without overwhelming the user.

---

# 22. File Upload Experience

Uploading is a core interaction.

The user should always know:

* What is uploading
* Upload progress
* Whether upload succeeded
* Whether upload failed
* What happens after completion

Large files and slow connections must be handled gracefully.

Never silently lose an upload.

---

# 23. Error Experience

Errors should be understandable to normal users.

Do not expose:

* Stack traces
* Database errors
* Internal IDs
* Technical implementation details

The user should understand:

1. What went wrong.
2. Whether their data is safe.
3. What they can do next.

---

# 24. Performance

Performance is part of the product.

Atria is expected to contain potentially large files and many project materials.

The application should avoid unnecessarily loading:

* Full-resolution images
* Entire video files
* Entire large folders
* Unneeded project data

Use appropriate techniques such as:

* Thumbnails
* Lazy loading
* Pagination/virtualization where needed
* Progressive loading
* Efficient queries
* Appropriate caching

Do not prematurely optimize without evidence of a problem.

---

# 25. Security

Project data belongs to users and/or authorized collaborators.

Authorization must be enforced server-side.

A client must never be trusted to determine:

* Ownership
* User identity
* Project ownership
* File ownership
* Permissions
* Access rights

Users must not be able to access another user's projects or files by manipulating IDs or requests.

Storage authorization is as important as database authorization.

---

# 26. Data Model Principles

The conceptual hierarchy is:

```text
User / Workspace
        │
        ▼
     Project
        │
   ┌────┴────┐
   ▼    ▼    ▼
Folders Media Documents
   │
   ▼
 Files
```

The implementation may differ, but these relationships must remain clear.

Every file must belong to a project.

Every folder must belong to a project.

Nested folders must not cross project boundaries.

---

# 27. Future Product Direction

Atria may eventually become more than a digital binder.

Possible future directions include:

* Collaboration
* Client portals
* Project activity
* Comments
* Approvals
* Project metadata
* Lightweight project planning
* Integrations
* AI-assisted organization
* Advanced search

These are intentionally outside the MVP.

Future functionality must preserve the original Atria philosophy:

> **Simple, beautiful, project-centered organization.**

---

# 28. Product Quality Bar

Atria should not compete on the number of features.

It should compete on the quality of the fundamental experience.

A successful MVP should make users say:

> "This is so much easier to organize a project."

rather than:

> "This has a lot of features."

---

# 29. North Star

The ultimate test of Atria is:

> **Can I open a project, immediately understand its structure, and effortlessly find, organize and view everything belonging to that project?**

If yes, Atria is succeeding.

If a feature makes this experience more complicated, question whether the feature belongs.

---

# 30. Final Product Principle

Atria should feel like:

> **A beautiful room for everything belonging to a project.**

The product should give projects structure without making them feel bureaucratic.

It should make complexity feel simple.

It should make digital project materials feel organized, intentional and accessible.

**Simple. Beautiful. Everything in its place.**


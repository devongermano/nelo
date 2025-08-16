# Nelo Development Tickets

This directory contains all development tickets for the Nelo project. Each ticket represents an isolated unit of work that can be completed independently by Claude Code or other developers.

## Ticket Organization

- **00-structural/** - Foundation improvements that must be completed first
- **01-core/** - Core MVP features as defined in `/docs/spec-pack.md`

## How to Use These Tickets

1. **Choose a ticket** from the status tracker below (pick one marked "Not Started")
2. **Read the full ticket** documentation in the corresponding file
3. **Check dependencies** - ensure all listed dependencies are complete
4. **Implement** following the acceptance criteria exactly
5. **Test** according to the testing requirements
6. **Validate** using the commands specified in the ticket
7. **Update this README** to mark the ticket as "Complete"

## Status Tracker

### 00-structural (Foundation)

| Ticket | Title | Priority | Status | Dependencies |
|--------|-------|----------|---------|--------------|
| 000 | Complete Typia Setup | Critical | **Complete** ✅ | None |
| 001 | Database Schema Update | Critical | **Not Started** | 000 |
| 002 | Shared Types Package | Critical | **Not Started** | 000, 001 |
| 003 | Consolidate Context Packages | High | **Not Started** | 000 |
| 004 | Auth Package Setup | High | **Not Started** | 000, 002 |
| 005 | Offline Package Setup | Medium | **Not Started** | 000 |

### 01-core (MVP Features)

| Ticket | Title | Priority | Status | Dependencies |
|--------|-------|----------|---------|--------------|
| 001 | Scene Markdown Editor | Critical | **Not Started** | 00-structural/000, 001, 002 |
| 002 | Codex System | Critical | **Not Started** | 00-structural/000, 001, 002 |
| 003 | AI Provider Adapters | Critical | **Not Started** | 00-structural/000, 002 |
| 004 | Context Composition Engine | Critical | **Not Started** | 00-structural/000, 003, 01-core/002 |
| 005 | AI Generation Suite | Critical | **Not Started** | 01-core/003, 004 |
| 006 | Real-time Collaboration | High | **Not Started** | 01-core/001 |
| 007 | Authentication & Access | Critical | **Not Started** | 00-structural/000, 004 |
| 008 | Export & Refactor Tools | Medium | **Not Started** | 01-core/001, 002 |

## Implementation Order

1. Complete ALL tickets in `00-structural/` first
2. Then work through `01-core/` tickets based on dependencies
3. Some `01-core/` tickets can be done in parallel if dependencies are met

## Validation Checklist

Before marking a ticket as complete, ensure:

- [ ] All acceptance criteria are met
- [ ] All specified tests are written and passing
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm typecheck` passes with no errors
- [ ] Documentation is updated where required
- [ ] The feature works as described in `/docs/spec-pack.md`

## MVP Definition

Per `/docs/spec-pack.md`, the MVP must include:
- ✅ Projects/Books/Chapters/Scenes structure
- ✅ Codex (Entity management)
- ✅ Canon DB with reveal gates
- ✅ Context Builder (spoiler-safe)
- ✅ Write/Rewrite/Describe AI actions
- ✅ Mass find/replace
- ✅ Offline PWA support
- ✅ Real-time collaboration
- ✅ Multiple AI provider adapters
- ✅ Export functionality
- ✅ Cost tracking

All these features are covered by the tickets in this directory.

## Notes

- Each ticket is self-contained with all information needed to implement it
- Tickets reference specific sections of `/docs/spec-pack.md` for requirements
- Testing is mandatory - no feature is complete without tests
- When in doubt, refer to the spec-pack.md for authoritative requirements
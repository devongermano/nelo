---
name: check-dependencies
description: Analyze ticket dependencies and show what's ready to work on
---

# Check Ticket Dependencies

Analyze all tickets to determine which are ready for implementation based on their dependencies.

## Usage
- Check all dependencies: `/check-dependencies`
- Show dependency graph: `/check-dependencies graph`
- Mark ticket complete: `/check-dependencies complete [ticket-id]`

---

## Process

### 1. Analyze Current State
```bash
# Show dependency graph with status indicators
./scripts/resolve-dependencies.sh graph
```

Status indicators:
- ✅ Complete/Approved
- 🟢 Available to work on
- 🔄 In progress
- 🔴 Blocked by dependencies
- ? Unknown status

### 2. Check What's Ready
```bash
# List all tickets that are ready to be worked on
gh issue list --label "ticket,status:available" --json number,title | \
  jq -r '.[] | "Issue #\(.number): \(.title)"'
```

### 3. Resolve Dependencies
```bash
# Run dependency resolution to update statuses
./scripts/resolve-dependencies.sh
```

This will:
- Check all blocked tickets
- Verify if their dependencies are complete
- Update status from `blocked` to `available` when ready
- Add comments explaining the changes

### 4. Show Blockers
```bash
# Show what's blocking each ticket
gh issue list --label "ticket,status:blocked" --json number,title,body | \
  jq -r '.[] | 
    .title as $title | 
    .body | 
    capture("## Dependencies\n(?<deps>[^#]+)") | 
    "📌 \($title)\n   Blocked by: \(.deps)\n"'
```

### 5. Mark Ticket Complete
When you complete a ticket, mark it and resolve dependencies:
```bash
# Mark a specific ticket as complete and update dependents
./scripts/resolve-dependencies.sh mark-complete [ticket-id]

# Example:
./scripts/resolve-dependencies.sh mark-complete 00-structural/001
```

---

## Dependency Chain Example

```
00-structural/
├─ 000 ✅ (Complete Typia Setup) → None
├─ 001 ✅ (Database Schema) → 000
├─ 002 🟢 (Shared Types) → 000, 001
├─ 003 🟢 (Context Packages) → 000
├─ 004 🔴 (JWT Auth) → 001
│  ├─ 007 🔴 (Permissions) → 004
│  ├─ 010 🔴 (Rate Limiting) → 004
│  ├─ 011 🔴 (Caching) → 004
│  └─ 012 🔴 (Error Handling) → 004
│     └─ 013 🔴 (Logging) → 012
├─ 005 🟢 (Offline Package) → 000
├─ 006 🟢 (Audit & Soft Delete) → 001
└─ 008 🟢 (Enhanced ETag) → 001

01-core/
├─ 001 🔴 (Scene Editor) → 00-structural/000, 001, 002
├─ 002 🔴 (Codex System) → 00-structural/000, 001, 002
├─ 003 🔴 (AI Adapters) → 00-structural/000, 002
└─ ...
```

---

## Quick Commands

### See Available Work
```bash
echo "🟢 Ready to work on:"
gh issue list --label "ticket,status:available" --json number,title,labels | \
  jq -r '.[] | 
    (.labels | map(select(.name | startswith("priority:"))) | .[0].name) as $priority |
    "  #\(.number): \(.title) [\($priority)]"' | \
  sort
```

### Update All Dependencies (Dry Run)
```bash
# Preview what would change without making updates
DRY_RUN=true ./scripts/resolve-dependencies.sh
```

### Debug Specific Ticket
```bash
# Check why a ticket is blocked
TICKET_ID="00-structural/007"
gh issue list --label ticket --json number,title,body | \
  jq -r --arg tid "$TICKET_ID" '.[] | 
    select(.title | contains($tid)) | 
    "Issue: \(.title)\nDependencies:\n\(.body | capture("## Dependencies\n(?<d>[^#]+)").d)"'
```

---

## Automation

The system automatically:
1. Detects when tickets are marked complete
2. Identifies all dependent tickets
3. Checks if ALL dependencies are met
4. Updates status from `blocked` to `available`
5. Adds explanatory comments

Manual intervention is only needed to:
- Mark tickets as complete when work is done
- Claim available tickets to start work
- Handle special cases or exceptions

---

## Troubleshooting

### Ticket stays blocked
Check if ALL dependencies are complete:
```bash
VERBOSE=true ./scripts/resolve-dependencies.sh
```

### Circular dependencies
The system will detect and report circular dependencies.

### Missing dependencies
Dependencies must be listed in the issue body under `## Dependencies` section.

### Status conflicts
Remove conflicting labels before running resolution:
```bash
gh issue edit [number] --remove-label "status:blocked,status:available"
```
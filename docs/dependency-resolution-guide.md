# Automatic Dependency Resolution System Guide

## Overview

The Automatic Dependency Resolution System intelligently manages ticket dependencies, automatically updating status from `blocked` to `available` when prerequisites are met. This ensures Claude and developers always know what work is ready to be started.

## System Components

### 1. Core Scripts

- **`scripts/resolve-dependencies.sh`** - Main dependency resolver
  - Parses dependencies from issue bodies
  - Checks completion status
  - Updates issue labels automatically
  
- **`scripts/dependency-tracker.js`** - Advanced graph analysis
  - Builds directed acyclic graph (DAG)
  - Detects circular dependencies
  - Generates visualizations
  
- **`scripts/visualize-dependencies.sh`** - Visualization generator
  - Creates Mermaid diagrams
  - Generates HTML reports
  - Produces Markdown documentation

### 2. GitHub Integration

- **`.github/workflows/dependency-resolver.yml`** - Automation workflow
  - Triggers on issue close/completion
  - Runs on label changes
  - Scheduled checks every 6 hours
  - Manual trigger via comments

### 3. Claude Commands

- **`.claude/commands/check-dependencies.md`** - Claude integration
  - Analyze dependencies
  - Show ready work
  - Mark tickets complete

## How It Works

### Dependency Detection

The system automatically parses dependencies from issue bodies:

```markdown
## Dependencies
- 00-structural/000 (Complete Typia Setup)
- 00-structural/001 (Database Schema Update)
```

Supports multiple formats:
- Full: `00-structural/001`
- Short: `001` (assumes current category)
- Cross-category: `01-core/002`

### Status Transitions

```
blocked → available → claimed → in-progress → complete
   ↑                                              ↓
   └──────────── triggers resolution ←───────────┘
```

When a ticket is marked complete:
1. System finds all dependent tickets
2. Checks if ALL their dependencies are met
3. Updates status from `blocked` to `available`
4. Adds explanatory comment
5. Notifies via GitHub Actions

### Completion Detection

A ticket is considered complete when:
- Issue state is CLOSED
- Has label `status:complete` or `status:approved`
- Marked complete in `docs/tickets/README.md`

## Usage

### Manual Commands

#### Check Dependencies
```bash
# Show what's ready to work on
./scripts/resolve-dependencies.sh

# Preview changes without updating
./scripts/resolve-dependencies.sh --dry-run

# Show dependency graph
./scripts/resolve-dependencies.sh graph
```

#### Mark Ticket Complete
```bash
# Mark specific ticket complete and resolve dependencies
./scripts/resolve-dependencies.sh mark-complete 00-structural/004

# Or via GitHub CLI
gh issue close 39
gh issue edit 39 --add-label "status:complete"
```

#### Visualize Dependencies
```bash
# Generate HTML visualization
./scripts/visualize-dependencies.sh html

# Generate Mermaid diagram
./scripts/visualize-dependencies.sh mermaid

# Generate Markdown report
./scripts/visualize-dependencies.sh markdown
```

#### Advanced Analysis
```bash
# Check for circular dependencies
node scripts/dependency-tracker.js cycles

# Show critical path
node scripts/dependency-tracker.js critical

# Get statistics
node scripts/dependency-tracker.js stats
```

### GitHub Actions Automation

#### Trigger via Comment
Add a comment to any issue:
```
/resolve-dependencies
/resolve-dependencies dry-run
/resolve-dependencies verbose
```

#### Manual Workflow Trigger
```bash
gh workflow run dependency-resolver.yml
```

### Claude Integration

Use Claude commands:
```
/check-dependencies            # Analyze all dependencies
/check-dependencies graph       # Show dependency graph
/check-dependencies complete 00-structural/004  # Mark complete
```

## Current Status

Based on the completed tickets (000 and 001), these tickets are now available:

| Ticket | Title | Why Available |
|--------|-------|---------------|
| 002 | Shared Types Package | Depends on 000, 001 ✅ |
| 003 | Consolidate Context | Depends on 000 ✅ |
| 004 | JWT Authentication | Depends on 001 ✅ |
| 006 | Audit & Soft Delete | Depends on 001 ✅ |
| 008 | Enhanced ETag | Depends on 001 ✅ |

## Dependency Chains

Example of how chains resolve:

```
000 ✅ → 003 🟢 → 01-core/004 🔴
001 ✅ → 004 🟢 → 007 🔴 → 01-core/007 🔴
                → 010 🔴
                → 011 🔴
                → 012 🔴 → 013 🔴
```

When 004 is completed, tickets 007, 010, 011, and 012 will automatically become available.

## Best Practices

### 1. Clear Dependencies
Always list dependencies explicitly in tickets:
```markdown
## Dependencies
- 00-structural/001 (Database Schema)
- 00-structural/002 (Shared Types)
```

### 2. Regular Resolution
Run dependency resolution after completing work:
```bash
# After closing an issue
./scripts/resolve-dependencies.sh
```

### 3. Monitor Blocked Work
Check what's blocking progress:
```bash
gh issue list --label "ticket,status:blocked" --json number,title
```

### 4. Verify Before Starting
Always check dependencies are met:
```bash
/check-dependencies
```

## Troubleshooting

### Issue: Ticket Stays Blocked

1. Check if ALL dependencies are complete:
```bash
VERBOSE=true ./scripts/resolve-dependencies.sh --dry-run
```

2. Verify dependency format in issue body

3. Ensure labels are correct

### Issue: Circular Dependencies

```bash
node scripts/dependency-tracker.js cycles
```

If found, refactor ticket dependencies to break the cycle.

### Issue: Wrong Status

Manually fix:
```bash
gh issue edit [number] --remove-label "status:blocked" --add-label "status:available"
```

## Metrics

Track system performance:
```bash
node scripts/dependency-tracker.js stats
```

Example output:
```
Total tickets: 38
Completed: 2 (5.3%)
Ready to work: 5
Blocked: 17
Circular dependencies: 0
Critical path length: 4
```

## Integration with Self-Refine Workflow

The dependency system integrates seamlessly with the Self-Refine workflow:

1. **Claim available ticket**: `/claim-next-ticket`
2. **Implement with Self-Refine**: `/self-refine-ticket [number]`
3. **On completion**: System auto-resolves dependencies
4. **Next ticket ready**: Automatically marked available

## Future Enhancements

Planned improvements:
- [ ] Cross-repository dependencies
- [ ] Dependency priority weighting
- [ ] Slack/Discord notifications
- [ ] Web dashboard
- [ ] Predictive completion dates
- [ ] Resource allocation optimization

## Summary

The Automatic Dependency Resolution System ensures:
- ✅ **No manual status updates** - Fully automated
- ✅ **Always accurate** - Real-time dependency checking
- ✅ **Prevents errors** - Can't work on blocked tickets
- ✅ **Maximizes throughput** - Shows all available work
- ✅ **Complete visibility** - Clear dependency chains

This system eliminates the manual overhead of dependency management, allowing Claude and developers to focus on implementation rather than coordination.
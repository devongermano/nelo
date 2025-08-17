# Self-Refine GitHub Project Management System

## Overview

This document describes the automated Self-Refine workflow system implemented for the Nelo project. The system leverages GitHub Issues, Actions, and Claude Code to create an iterative refinement pipeline that improves code quality by ~20% through systematic self-critique and improvement cycles.

## System Components

### 1. GitHub Issue Templates (`.github/ISSUE_TEMPLATE/`)

- **smart-ticket.yml**: Self-refining ticket with plan/critique tracking
- **quick-ticket.yml**: Quick import template for existing tickets
- **bug_report.yml**: Standard bug reporting template

### 2. Claude Commands (`.claude/commands/`)

- **self-refine-ticket.md**: Complete iterative refinement workflow
- **critique-implementation.md**: Standalone critique process
- **claim-next-ticket.md**: Automated ticket claiming

### 3. GitHub Actions (`.github/workflows/`)

- **self-refine-orchestrator.yml**: Main automation orchestrator
- **claude-self-refine.yml**: Claude Code execution workflow

### 4. Migration Scripts (`scripts/`)

- **migrate-tickets-to-github.sh**: Converts docs/tickets/ to GitHub Issues
- **process-tickets.sh**: Batch processing for multiple tickets

### 5. Documentation Updates

- **CLAUDE.md**: Added Self-Refine Protocol section
- **GitHub Labels**: Created comprehensive label system

## The Self-Refine Workflow

### Phase 1: Deep Understanding (Plan Mode) 🔍
- Enter Plan Mode for safe, read-only analysis
- Load ticket, spec-pack.md, and spec-evolution.md
- Research codebase thoroughly using "ultrathink"
- Identify optimization opportunities
- Create comprehensive implementation plan

### Phase 2: Plan Refinement 📝
- Critique own plan for completeness
- Check spec compliance including evolution overrides
- Identify gaps and edge cases
- Refine plan based on self-critique
- Document refined plan in GitHub issue

### Phase 3: Implementation 🔨
- Exit Plan Mode
- Create feature branch: `ticket/[number]-[description]`
- Follow refined plan exactly
- Commit frequently with clear messages
- Update issue with progress

### Phase 4: Critique Loop 🔄
- Re-enter Plan Mode
- Review implementation critically
- Check ALL acceptance criteria
- Document issues found
- If issues exist: fix and repeat
- Continue until critique is positive

### Phase 5: Completion 🚀
- Positive critique required before proceeding
- Run final validation (lint, typecheck, tests)
- Create PR with refinement metrics
- Document iteration count

## Label System

### Status Labels
- `status:available` - Ready to be claimed
- `status:claimed` - Being analyzed
- `status:planned` - Plan complete
- `status:in-progress` - Implementation active
- `status:under-critique` - Being reviewed
- `status:refining` - Fixing issues
- `status:approved` - Ready for PR
- `status:blocked` - Dependencies not met

### Priority Labels
- `priority:critical` - Urgent, blocks other work
- `priority:high` - Important, do soon
- `priority:medium` - Standard priority
- `priority:low` - Nice to have

### Other Labels
- `ticket` - Identifies development tickets
- `agent:[id]` - Tracks which agent claimed the ticket

## Key Features

### 1. Conflict Prevention
- Atomic ticket claiming prevents race conditions
- Branch isolation (`ticket/[number]-[description]`)
- Lock labels prevent duplicate work
- Stale claim auto-release after 4 hours

### 2. Quality Assurance
- Minimum 1 critique iteration required
- Maximum 5 iterations before escalation
- Documented critique trail in issues
- Metrics tracking for analysis

### 3. Automation
- GitHub Actions for orchestration
- Scheduled checks for available work
- Automatic status transitions
- Metrics collection on completion

### 4. Scalability
- Supports multiple Claude instances
- Parallel processing capability
- Git worktrees for isolation
- Batch processing scripts

## Usage Instructions

### Initial Setup
```bash
# 1. Authenticate with GitHub (one-time)
gh auth refresh --hostname github.com -s project,write:org,workflow

# 2. Create necessary labels (one-time)
gh label create "ticket" --description "Development ticket" --color "0075ca"
# ... (script creates all needed labels)

# 3. Migrate existing tickets
./scripts/migrate-tickets-to-github.sh
```

### Working with Tickets

#### Manual Workflow
```bash
# Find available work
gh issue list --label "status:available"

# Use Claude command
claude /self-refine-ticket 123

# Or individual phases
claude /claim-next-ticket
claude /critique-implementation
```

#### Automated Batch Processing
```bash
# Process up to 5 tickets
./scripts/process-tickets.sh

# Process specific number
./scripts/process-tickets.sh --max 10
```

### Monitoring Progress
```bash
# View all tickets
gh issue list --label ticket

# View available work
gh issue list --label "status:available"

# View in-progress work
gh issue list --label "status:in-progress"

# View your assigned tickets
gh issue list --assignee @me
```

## Benefits

### Proven Quality Improvement
- Academic research shows ~20% code quality improvement
- Systematic identification of edge cases
- Comprehensive error handling
- Better test coverage

### Complete Audit Trail
- Every decision documented in issues
- Critique iterations tracked
- Refinement metrics collected
- Knowledge builds over time

### Parallel Development
- Multiple agents work simultaneously
- No conflicts through branch isolation
- Clear ownership via assignments
- Automatic workload distribution

### Human Oversight
- PR reviews maintain quality gates
- Can intervene at any stage
- Blocked status for dependencies
- Emergency stop capabilities

## Integration Points

### With Existing Tickets
- Preserves docs/tickets/ structure
- Bidirectional sync possible
- Tracks completion in both systems
- Migration script for bulk import

### With CI/CD
- GitHub Actions integration
- Automated test runs
- Quality gates before merge
- Deployment triggers on approval

### With Claude Code
- Native command support
- Plan Mode for safe analysis
- Headless mode for automation
- SDK integration possible

## Metrics and Analytics

The system tracks:
- Iteration count per ticket
- Time in each phase
- Success/failure rates
- Quality improvement trends
- Agent performance

Access metrics via:
```bash
# Count iterations for an issue
gh issue view [number] --json comments | \
  jq '[.comments[].body | select(contains("Critique"))] | length'

# View refinement labels
gh issue list --label "metrics:iterations-3"
```

## Troubleshooting

### Common Issues

1. **Label not found**: Run label creation script
2. **Permission denied**: Check GitHub authentication
3. **Claim conflicts**: Implement backoff retry
4. **Context overflow**: Summarize and continue
5. **Stale claims**: Auto-release after timeout

### Manual Interventions

```bash
# Release a stuck ticket
gh issue edit [number] \
  --add-label "status:available" \
  --remove-label "status:claimed" \
  --remove-assignee "@me"

# Force approve
gh issue edit [number] --add-label "status:approved"

# Block ticket
gh issue edit [number] --add-label "status:blocked"
```

## Future Enhancements

### Short Term
- [ ] Dashboard for metrics visualization
- [ ] Slack/Discord notifications
- [ ] Auto-PR creation on approval
- [ ] Enhanced conflict detection

### Long Term
- [ ] Multi-repo support
- [ ] Custom workflow templates
- [ ] AI performance optimization
- [ ] Advanced analytics platform

## Conclusion

The Self-Refine system transforms your development workflow by:
1. **Enforcing quality** through mandatory critique cycles
2. **Scaling development** with parallel agent support
3. **Building knowledge** through documented decisions
4. **Maintaining oversight** with human review gates

This academically-proven approach delivers measurable improvements in code quality while maintaining development velocity and team collaboration.
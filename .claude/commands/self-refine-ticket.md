---
name: self-refine-ticket
description: Complete iterative refinement workflow for ticket implementation
---

# Self-Refine Ticket Implementation

Execute the proven Self-Refine workflow that improves code quality by ~20% through iterative refinement.

## Usage
Provide either:
- GitHub issue number: `/self-refine-ticket 123`
- Ticket ID: `/self-refine-ticket 00-structural/004`

---

## Phase 1: Deep Understanding (Plan Mode) 🔍

Enter Plan Mode and perform deep analysis:

1. **Retrieve the ticket**:
   - If GitHub issue number provided: `gh issue view [number]`
   - If ticket ID provided: Read from `docs/tickets/[category]/[id].md`

2. **Load critical context** (MANDATORY):
   - Read `/docs/spec-pack.md` (original spec)
   - Read `/docs/spec-evolution.md` (CRITICAL - overrides spec-pack)
   - Read `/CLAUDE.md` (project guidelines)

3. **Research existing codebase** (ultrathink):
   - Search for related code patterns
   - Identify files that will be modified
   - Check for existing similar implementations
   - Look for potential conflicts or dependencies

4. **Identify optimizations**:
   - Performance improvements
   - Code reuse opportunities
   - Better design patterns
   - Spec evolution opportunities

5. **Create comprehensive implementation plan**:
   - Break down into clear phases
   - List all files to be created/modified
   - Define test strategy
   - Note potential challenges

---

## Phase 2: Plan Refinement 📝

Still in Plan Mode, critique and refine your plan:

1. **Self-critique the plan**:
   - Is it complete? Are all acceptance criteria addressed?
   - Does it follow spec-evolution.md overrides?
   - Are edge cases handled?
   - Is the approach optimal?
   - Are there security considerations?
   - Will it scale?

2. **Refine based on critique**:
   - Address identified gaps
   - Optimize the approach
   - Add missing considerations
   - Improve clarity

3. **Document the refined plan**:
   ```bash
   gh issue comment [number] -b "## 📋 Refined Implementation Plan
   
   ### Phase 1: [Title]
   - Step 1...
   - Step 2...
   
   ### Phase 2: [Title]
   ...
   
   ### Test Strategy
   ...
   
   ### Potential Challenges
   ..."
   ```

4. **Update issue status**:
   ```bash
   gh issue edit [number] --add-label "status:planned"
   ```

---

## Phase 3: Implementation 🔨

Exit Plan Mode and implement:

1. **Create feature branch**:
   ```bash
   git checkout -b ticket/[number]-[description]
   ```

2. **Update issue assignment**:
   ```bash
   gh issue edit [number] \
     --add-label "status:in-progress" \
     --remove-label "status:planned" \
     --add-assignee "@me"
   ```

3. **Implement according to refined plan**:
   - Follow the plan exactly
   - Commit frequently with clear messages
   - Run tests after each component

4. **Regular progress updates**:
   ```bash
   gh issue comment [number] -b "✅ Completed: [component]"
   ```

---

## Phase 4: Self-Critique Loop 🔄

Re-enter Plan Mode for critical review:

1. **Review implementation thoroughly**:
   - Does it meet ALL acceptance criteria?
   - Is it spec-compliant (including evolution)?
   - Are there bugs or edge cases?
   - Is error handling comprehensive?
   - Are tests adequate?
   - Is performance acceptable?
   - Does it follow project patterns?

2. **Document critique**:
   ```bash
   gh issue comment [number] -b "## 🔎 Critique Iteration [N]
   
   ### Issues Found:
   - [ ] Issue 1: [Description]
   - [ ] Issue 2: [Description]
   
   ### Proposed Fixes:
   1. [Fix for issue 1]
   2. [Fix for issue 2]
   
   ### Overall Assessment: NEEDS IMPROVEMENT ⚠️"
   ```

3. **If issues found**:
   - Exit Plan Mode
   - Implement fixes
   - Commit with message: "fix: Address critique iteration [N] issues"
   - Return to step 1 of Phase 4

4. **If critique is positive**:
   ```bash
   gh issue comment [number] -b "## ✅ Critique Iteration [N]
   
   ### Final Review:
   - All acceptance criteria met
   - Spec compliance verified
   - Tests comprehensive and passing
   - Code quality excellent
   
   ### Overall Assessment: APPROVED ✅"
   ```

---

## Phase 5: Completion 🚀

When critique is positive:

1. **Run final validations**:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

2. **Create pull request**:
   ```bash
   gh pr create \
     --title "feat: Implements #[number] - [Description]" \
     --body "## Summary
   Implements ticket #[number] through Self-Refine workflow
   
   ## Iterations
   - Planning iterations: [N]
   - Implementation critique cycles: [N]
   - Total refinements: [N]
   
   ## Changes
   - [List key changes]
   
   ## Testing
   - [List test coverage]
   
   Closes #[number]"
   ```

3. **Update issue status**:
   ```bash
   gh issue edit [number] \
     --add-label "status:ready-for-review" \
     --remove-label "status:in-progress"
   ```

---

## Quality Checklist

Before moving between phases, ensure:

### Planning Phase ✓
- [ ] Spec-pack.md reviewed
- [ ] Spec-evolution.md checked for overrides
- [ ] Existing code researched
- [ ] Dependencies identified
- [ ] Plan is comprehensive

### Implementation Phase ✓
- [ ] Following refined plan exactly
- [ ] Commits are atomic and clear
- [ ] Tests written alongside code
- [ ] Progress documented in issue

### Critique Phase ✓
- [ ] All acceptance criteria verified
- [ ] Edge cases tested
- [ ] Performance acceptable
- [ ] Code follows patterns
- [ ] Security considered

### Completion Phase ✓
- [ ] All tests passing
- [ ] Lint and typecheck clean
- [ ] PR description complete
- [ ] Issue updated

---

## Notes

- **Minimum iterations**: At least 1 critique cycle required
- **Maximum iterations**: Stop after 5 cycles, escalate if needed
- **Time boxing**: Each phase should take < 30 minutes
- **Context management**: If context fills up, summarize and continue in new session
- **Documentation**: Every decision and critique must be logged in the issue

This workflow is proven to improve code quality by ~20% through systematic refinement.
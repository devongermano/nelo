---
name: claim-next-ticket
description: Find and claim the next available ticket for implementation
---

# Claim Next Available Ticket

Automatically find and claim the highest priority available ticket.

## Process

1. **Find available tickets**:
   ```bash
   gh issue list --label "status:available" --limit 10 --json number,title,labels
   ```

2. **Select highest priority**:
   - Priority order: Critical → High → Medium → Low
   - Within same priority: Oldest first

3. **Claim the ticket atomically**:
   ```bash
   ISSUE_NUM=[selected_number]
   AGENT_ID="claude-$(hostname)-$(date +%s)"
   
   gh issue edit $ISSUE_NUM \
     --add-label "status:claimed,agent:$AGENT_ID" \
     --remove-label "status:available" \
     --add-assignee "@me"
   ```

4. **Create working branch**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b ticket/$ISSUE_NUM-[description]
   ```

5. **Start Self-Refine workflow**:
   - Automatically transition to `/self-refine-ticket $ISSUE_NUM`

## Conflict Prevention

If claim fails (another agent claimed it):
1. Remove assignment attempt
2. Find next available ticket
3. Retry claim process

## Status Labels

The ticket will transition through these statuses:
- `status:available` → Can be claimed
- `status:claimed` → Being analyzed
- `status:planned` → Plan complete
- `status:in-progress` → Implementation active
- `status:under-critique` → Being reviewed
- `status:refining` → Fixing issues
- `status:approved` → Ready for PR
- `status:complete` → Merged

## Notes

- Only claim one ticket at a time
- Complete current ticket before claiming next
- If blocked, add `status:blocked` label and document reason
- Tickets remain claimed for max 4 hours before auto-release
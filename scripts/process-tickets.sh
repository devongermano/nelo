#!/bin/bash

# Batch processing script for Self-Refine workflow
# Processes available tickets through the complete refinement cycle

set -e

echo "🤖 Claude Code Self-Refine Batch Processor"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAX_TICKETS=${MAX_TICKETS:-5}  # Process up to 5 tickets by default
AGENT_ID="claude-$(hostname)-$(date +%s)"

# Function to claim a ticket
claim_ticket() {
    local ticket_num=$1
    
    echo -e "${YELLOW}Claiming ticket #$ticket_num...${NC}"
    
    gh issue edit "$ticket_num" \
        --add-label "status:claimed,agent:$AGENT_ID" \
        --remove-label "status:available" \
        --add-assignee "@me" 2>/dev/null || return 1
    
    echo -e "${GREEN}✓ Successfully claimed ticket #$ticket_num${NC}"
    return 0
}

# Function to release a ticket
release_ticket() {
    local ticket_num=$1
    local reason=$2
    
    echo -e "${YELLOW}Releasing ticket #$ticket_num ($reason)...${NC}"
    
    gh issue edit "$ticket_num" \
        --add-label "status:available" \
        --remove-label "status:claimed,agent:$AGENT_ID" \
        --remove-assignee "@me" 2>/dev/null || true
    
    gh issue comment "$ticket_num" \
        -b "🔓 Released: $reason" 2>/dev/null || true
}

# Function to check ticket status
check_status() {
    local ticket_num=$1
    
    gh issue view "$ticket_num" --json labels -q '.labels[].name' 2>/dev/null | grep -q "status:approved"
}

# Function to process a single ticket
process_ticket() {
    local ticket_num=$1
    
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Processing Ticket #$ticket_num${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Claim the ticket
    if ! claim_ticket "$ticket_num"; then
        echo -e "${RED}✗ Failed to claim ticket #$ticket_num${NC}"
        return 1
    fi
    
    # Create working branch
    BRANCH="ticket/$ticket_num-auto-$(date +%s)"
    echo -e "${YELLOW}Creating branch: $BRANCH${NC}"
    git checkout -b "$BRANCH" 2>/dev/null || {
        echo -e "${RED}✗ Failed to create branch${NC}"
        release_ticket "$ticket_num" "Branch creation failed"
        return 1
    }
    
    # Execute Self-Refine workflow using Claude
    echo -e "${YELLOW}Executing Self-Refine workflow...${NC}"
    
    # Note: This would normally invoke Claude Code
    # For now, we'll document the process
    cat <<EOF

Would execute:
1. claude --plan-mode to analyze ticket
2. Refine the plan
3. Exit plan mode and implement
4. Re-enter plan mode for critique
5. Iterate until approved

To manually run:
  claude /self-refine-ticket $ticket_num

EOF
    
    # Simulate workflow completion
    echo -e "${GREEN}✓ Workflow simulation complete${NC}"
    
    # Check if approved
    if check_status "$ticket_num"; then
        echo -e "${GREEN}✓ Ticket #$ticket_num approved!${NC}"
        
        # Create PR
        echo -e "${YELLOW}Creating pull request...${NC}"
        gh pr create \
            --title "feat: Implements #$ticket_num (Auto-Refined)" \
            --body "Automated implementation of ticket #$ticket_num using Self-Refine workflow" \
            --label "auto-generated" 2>/dev/null || {
            echo -e "${YELLOW}⚠ PR creation skipped (may already exist)${NC}"
        }
    else
        echo -e "${YELLOW}⚠ Ticket #$ticket_num needs more refinement${NC}"
    fi
    
    # Return to main branch
    git checkout main 2>/dev/null || true
    
    return 0
}

# Main processing loop
main() {
    # Check prerequisites
    if ! command -v gh &> /dev/null; then
        echo -e "${RED}Error: GitHub CLI (gh) not found${NC}"
        exit 1
    fi
    
    if ! gh auth status &>/dev/null; then
        echo -e "${RED}Error: Not authenticated with GitHub${NC}"
        exit 1
    fi
    
    # Find available tickets
    echo -e "${YELLOW}Finding available tickets...${NC}"
    TICKETS=$(gh issue list \
        --label "status:available" \
        --label "ticket" \
        --limit "$MAX_TICKETS" \
        --json number,title \
        --jq '.[].number')
    
    if [ -z "$TICKETS" ]; then
        echo -e "${YELLOW}No available tickets found${NC}"
        exit 0
    fi
    
    # Count tickets
    TICKET_COUNT=$(echo "$TICKETS" | wc -l | tr -d ' ')
    echo -e "${GREEN}Found $TICKET_COUNT available ticket(s)${NC}"
    
    # Process each ticket
    PROCESSED=0
    SUCCESSFUL=0
    
    for TICKET_NUM in $TICKETS; do
        ((PROCESSED++))
        
        echo -e "\n${BLUE}[$PROCESSED/$TICKET_COUNT] Starting ticket #$TICKET_NUM${NC}"
        
        if process_ticket "$TICKET_NUM"; then
            ((SUCCESSFUL++))
        fi
        
        # Small delay between tickets
        sleep 2
    done
    
    # Summary
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Batch Processing Complete!${NC}"
    echo -e "  Processed: $PROCESSED tickets"
    echo -e "  Successful: $SUCCESSFUL tickets"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        cat <<EOF
Usage: $0 [OPTIONS]

Batch process available tickets through Self-Refine workflow.

Options:
  --max N       Process up to N tickets (default: 5)
  --help        Show this help message

Environment Variables:
  MAX_TICKETS   Maximum tickets to process (default: 5)

Examples:
  $0                    # Process up to 5 tickets
  $0 --max 10          # Process up to 10 tickets
  MAX_TICKETS=3 $0     # Process up to 3 tickets
EOF
        exit 0
        ;;
    --max)
        MAX_TICKETS="${2:-5}"
        shift 2
        ;;
esac

# Run main function
main
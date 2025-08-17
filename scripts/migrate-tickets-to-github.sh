#!/bin/bash

# Script to migrate tickets from docs/tickets/ to GitHub Issues
# Uses the Self-Refine smart ticket template

# Don't exit on individual failures
set +e

echo "🚀 Starting ticket migration to GitHub Issues..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for statistics
CREATED=0
SKIPPED=0
FAILED=0

# Function to extract ticket metadata from markdown file
extract_metadata() {
    local file=$1
    local ticket_id=$2
    
    # Extract priority (look for **CRITICAL**, **High**, etc.)
    if grep -q "\*\*CRITICAL\*\*" "$file"; then
        PRIORITY="Critical"
    elif grep -q "Priority.*Critical" "$file"; then
        PRIORITY="Critical"
    elif grep -q "Priority.*High" "$file"; then
        PRIORITY="High"
    elif grep -q "Priority.*Medium" "$file"; then
        PRIORITY="Medium"
    else
        PRIORITY="Low"
    fi
    
    # Extract title from first # heading
    TITLE=$(grep "^# " "$file" | head -1 | sed 's/^# //' | sed 's/Ticket: //')
    
    # Determine category from path
    if [[ "$file" == *"00-structural"* ]]; then
        CATEGORY="Structural"
    elif [[ "$file" == *"01-core"* ]]; then
        CATEGORY="Core"
    else
        CATEGORY="Other"
    fi
}

# Function to check if issue already exists
issue_exists() {
    local ticket_id=$1
    local search_result
    
    search_result=$(gh issue list --search "in:title $ticket_id" --json number --jq length)
    
    if [ "$search_result" -gt 0 ]; then
        return 0
    else
        return 1
    fi
}

# Function to create GitHub issue from ticket file
create_issue() {
    local file=$1
    local ticket_id=$2
    
    echo -e "\n${YELLOW}Processing:${NC} $ticket_id"
    
    # Check if issue already exists
    if issue_exists "$ticket_id"; then
        echo -e "${YELLOW}  ⏭️  Issue already exists for $ticket_id, skipping...${NC}"
        ((SKIPPED++))
        return
    fi
    
    # Extract metadata
    extract_metadata "$file" "$ticket_id"
    
    # Read file content
    CONTENT=$(cat "$file")
    
    # Determine initial status based on dependencies
    if grep -q "Dependencies.*Complete ✅" "$file"; then
        STATUS="status:available"
    else
        STATUS="status:blocked"
    fi
    
    # Create the issue using gh CLI
    echo -e "  📝 Creating issue: $TITLE"
    
    # Build the issue body
    ISSUE_BODY=$(cat <<EOF
## Ticket ID: $ticket_id

## Priority: $PRIORITY

## Category: $CATEGORY

## Original Specification

$CONTENT

---

*This issue was automatically migrated from \`docs/tickets/$ticket_id.md\`*
*Ready for Self-Refine workflow implementation*
EOF
)
    
    # Convert priority to lowercase for label
    PRIORITY_LABEL=$(echo "$PRIORITY" | tr '[:upper:]' '[:lower:]')
    
    # Create the issue
    if gh issue create \
        --title "[TICKET-$ticket_id] $TITLE" \
        --body "$ISSUE_BODY" \
        --label "ticket,$STATUS,priority:$PRIORITY_LABEL"; then
        
        echo -e "${GREEN}  ✅ Successfully created issue for $ticket_id${NC}"
        ((CREATED++))
    else
        echo -e "${RED}  ❌ Failed to create issue for $ticket_id${NC}"
        ((FAILED++))
    fi
}

# Main migration process
main() {
    # Check if gh CLI is authenticated
    if ! gh auth status &>/dev/null; then
        echo -e "${RED}Error: GitHub CLI not authenticated. Run 'gh auth login' first.${NC}"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -d "docs/tickets" ]; then
        echo -e "${RED}Error: docs/tickets directory not found. Run from project root.${NC}"
        exit 1
    fi
    
    # Process structural tickets first
    echo -e "\n${GREEN}Processing Structural Tickets (00-structural/)...${NC}"
    for file in docs/tickets/00-structural/*.md; do
        if [ -f "$file" ]; then
            # Extract ticket ID from filename
            filename=$(basename "$file" .md)
            ticket_id="00-structural/$filename"
            create_issue "$file" "$ticket_id"
        fi
    done
    
    # Process core tickets
    echo -e "\n${GREEN}Processing Core Tickets (01-core/)...${NC}"
    for file in docs/tickets/01-core/*.md; do
        if [ -f "$file" ]; then
            # Extract ticket ID from filename
            filename=$(basename "$file" .md)
            ticket_id="01-core/$filename"
            create_issue "$file" "$ticket_id"
        fi
    done
    
    # Print summary
    echo -e "\n================================================"
    echo -e "${GREEN}Migration Complete!${NC}"
    echo -e "  ✅ Created: $CREATED issues"
    echo -e "  ⏭️  Skipped: $SKIPPED (already exist)"
    echo -e "  ❌ Failed: $FAILED"
    echo -e "================================================"
    
    # Show next steps
    echo -e "\n${YELLOW}Next Steps:${NC}"
    echo "1. Review created issues at: gh issue list --label ticket"
    echo "2. Update dependencies and status labels as needed"
    echo "3. Start claiming tickets with: /claim-next-ticket"
    echo "4. Use Self-Refine workflow: /self-refine-ticket [number]"
}

# Run if not being sourced
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi
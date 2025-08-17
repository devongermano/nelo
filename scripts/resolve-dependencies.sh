#!/bin/bash

# Automatic Dependency Resolution System
# Parses ticket dependencies and updates status when dependencies are met

set +e  # Don't exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DRY_RUN=${DRY_RUN:-false}
VERBOSE=${VERBOSE:-false}

echo "🔄 Dependency Resolution System"
echo "================================"

# Function to log verbose messages
log_verbose() {
    if [ "$VERBOSE" == "true" ]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

# Function to extract ticket ID from issue title
extract_ticket_id() {
    local title=$1
    # Extract pattern like "00-structural/001" or "01-core/002"
    echo "$title" | grep -oE "[0-9]{2}-[a-z]+/[0-9]{3}[a-z-]*" | head -1
}

# Function to normalize ticket ID
normalize_ticket_id() {
    local dep=$1
    local context_category=$2
    
    # If it's just a number like "001", prepend the current category
    if [[ "$dep" =~ ^[0-9]{3}$ ]]; then
        echo "${context_category}/${dep}"
    # If it's already in format "00-structural/001", use as-is
    elif [[ "$dep" =~ ^[0-9]{2}-[a-z]+/[0-9]{3} ]]; then
        echo "$dep"
    else
        echo "$dep"
    fi
}

# Function to parse dependencies from issue body
parse_dependencies() {
    local issue_body=$1
    local ticket_id=$2
    
    # Extract category from ticket_id for context
    local category=$(echo "$ticket_id" | cut -d'/' -f1)
    
    # Find the Dependencies section - handle different formats
    # Try to extract from ## Dependencies to the next ## or end of text
    local deps_section=$(echo "$issue_body" | awk '/## Dependencies/{flag=1; next} /^##/{flag=0} flag')
    
    if [ -z "$deps_section" ]; then
        log_verbose "No dependencies section found for $ticket_id"
        echo ""
        return
    fi
    
    # Extract dependency lines (look for lines with ticket IDs)
    local dependencies=""
    while IFS= read -r line; do
        # Skip empty lines and headers
        [[ -z "$line" ]] && continue
        [[ "$line" == "## Dependencies" ]] && continue
        [[ "$line" == "- None" ]] && continue
        [[ "$line" == *"None"* ]] && continue
        
        # Extract ticket IDs from lines like:
        # - 00-structural/000 (Complete Typia Setup)
        # - 001 (Database Schema Update)
        local dep_ids=$(echo "$line" | grep -oE "([0-9]{2}-[a-z]+/)?[0-9]{3}[a-z-]*")
        
        for dep in $dep_ids; do
            local normalized=$(normalize_ticket_id "$dep" "$category")
            if [ -n "$normalized" ]; then
                dependencies="$dependencies $normalized"
            fi
        done
    done <<< "$deps_section"
    
    echo "$dependencies" | xargs  # Trim whitespace
}

# Function to check if a ticket is complete
is_ticket_complete() {
    local ticket_id=$1
    
    # Find the issue with this ticket ID (include closed issues)
    local issue_data=$(gh issue list --limit 1000 --state all --json number,title,labels,state | \
        jq -r --arg tid "$ticket_id" '.[] | select(.title | contains($tid))')
    
    if [ -z "$issue_data" ]; then
        log_verbose "Ticket $ticket_id not found in GitHub issues"
        # Check if it's marked complete in README
        if grep -q "| ${ticket_id##*/} .*Complete.*✅" docs/tickets/README.md 2>/dev/null; then
            log_verbose "Ticket $ticket_id marked complete in README"
            return 0
        fi
        return 1
    fi
    
    # Check if issue is closed
    local state=$(echo "$issue_data" | jq -r '.state')
    if [ "$state" == "CLOSED" ]; then
        log_verbose "Ticket $ticket_id is closed"
        return 0
    fi
    
    # Check for completion labels
    local labels=$(echo "$issue_data" | jq -r '.labels[].name')
    if echo "$labels" | grep -qE "status:(complete|approved)"; then
        log_verbose "Ticket $ticket_id has completion label"
        return 0
    fi
    
    log_verbose "Ticket $ticket_id is NOT complete"
    return 1
}

# Function to check if all dependencies are met
dependencies_met() {
    local dependencies=$1
    
    # If no dependencies, they're met
    if [ -z "$dependencies" ]; then
        return 0
    fi
    
    # Check each dependency
    for dep in $dependencies; do
        if ! is_ticket_complete "$dep"; then
            log_verbose "Dependency $dep is not complete"
            return 1
        fi
    done
    
    log_verbose "All dependencies met: $dependencies"
    return 0
}

# Function to update issue status
update_issue_status() {
    local issue_num=$1
    local new_status=$2
    local reason=$3
    
    echo -e "${YELLOW}  Updating issue #$issue_num to $new_status${NC}"
    
    if [ "$DRY_RUN" == "true" ]; then
        echo -e "${CYAN}  [DRY RUN] Would update issue #$issue_num${NC}"
        return
    fi
    
    # Remove old status labels and add new one
    gh issue edit "$issue_num" \
        --remove-label "status:blocked,status:available" \
        --add-label "$new_status" 2>/dev/null || true
    
    # Add comment explaining the change
    gh issue comment "$issue_num" \
        -b "🔄 **Dependency Update**: $reason" 2>/dev/null || true
}

# Main resolution process
resolve_dependencies() {
    echo -e "\n${BLUE}Analyzing all tickets for dependency resolution...${NC}"
    
    local total_issues=0
    local updated_issues=0
    local already_available=0
    local remain_blocked=0
    
    # Get all ticket issues (including closed for dependency checking)
    local issues=$(gh issue list --label ticket --limit 1000 --state open \
        --json number,title,body,labels)
    
    # Process each issue
    echo "$issues" | jq -c '.[]' | while IFS= read -r issue; do
        ((total_issues++))
        
        local issue_num=$(echo "$issue" | jq -r '.number')
        local title=$(echo "$issue" | jq -r '.title')
        local body=$(echo "$issue" | jq -r '.body')
        local labels=$(echo "$issue" | jq -r '.labels[].name')
        
        # Extract ticket ID from title
        local ticket_id=$(extract_ticket_id "$title")
        
        if [ -z "$ticket_id" ]; then
            log_verbose "Could not extract ticket ID from: $title"
            continue
        fi
        
        echo -e "\n${CYAN}Checking ticket:${NC} $ticket_id (Issue #$issue_num)"
        
        # Check current status
        if echo "$labels" | grep -q "status:available"; then
            echo -e "  ${GREEN}✓${NC} Already available"
            ((already_available++))
            continue
        fi
        
        if ! echo "$labels" | grep -q "status:blocked"; then
            log_verbose "  Issue not blocked, skipping"
            continue
        fi
        
        # Parse dependencies
        local dependencies=$(parse_dependencies "$body" "$ticket_id")
        
        if [ -z "$dependencies" ]; then
            echo -e "  ${GREEN}✓${NC} No dependencies - marking as available"
            update_issue_status "$issue_num" "status:available" "No dependencies found"
            ((updated_issues++))
            continue
        fi
        
        echo -e "  Dependencies: ${YELLOW}$dependencies${NC}"
        
        # Check if dependencies are met
        if dependencies_met "$dependencies"; then
            echo -e "  ${GREEN}✓${NC} All dependencies met - marking as available!"
            update_issue_status "$issue_num" "status:available" \
                "All dependencies completed: $dependencies"
            ((updated_issues++))
        else
            echo -e "  ${RED}✗${NC} Dependencies not yet met - remains blocked"
            ((remain_blocked++))
        fi
    done
    
    # Summary
    echo -e "\n${BLUE}================================${NC}"
    echo -e "${GREEN}Dependency Resolution Complete!${NC}"
    echo -e "  Total tickets: $total_issues"
    echo -e "  ${GREEN}Updated to available: $updated_issues${NC}"
    echo -e "  Already available: $already_available"
    echo -e "  ${YELLOW}Remain blocked: $remain_blocked${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Function to mark a ticket as complete and resolve dependencies
mark_complete() {
    local ticket_id=$1
    
    echo -e "\n${GREEN}Marking ticket $ticket_id as complete...${NC}"
    
    # Find the issue
    local issue=$(gh issue list --limit 1000 --json number,title --jq \
        --arg tid "$ticket_id" '.[] | select(.title | contains($tid))')
    
    if [ -z "$issue" ]; then
        echo -e "${RED}Error: Could not find issue for ticket $ticket_id${NC}"
        return 1
    fi
    
    local issue_num=$(echo "$issue" | jq -r '.number')
    
    # Mark as complete
    gh issue edit "$issue_num" \
        --add-label "status:complete" \
        --remove-label "status:available,status:blocked,status:in-progress"
    
    gh issue comment "$issue_num" \
        -b "✅ **Marked as complete** - resolving dependent tickets..."
    
    echo -e "${GREEN}✓ Marked issue #$issue_num as complete${NC}"
    
    # Now resolve dependencies
    echo -e "\n${YELLOW}Resolving dependencies...${NC}"
    resolve_dependencies
}

# Function to show dependency graph
show_dependency_graph() {
    echo -e "\n${BLUE}Dependency Graph${NC}"
    echo "================="
    
    # Get all tickets
    local issues=$(gh issue list --label ticket --limit 1000 --state open \
        --json number,title,body,labels)
    
    echo "$issues" | jq -c '.[]' | while IFS= read -r issue; do
        local title=$(echo "$issue" | jq -r '.title')
        local body=$(echo "$issue" | jq -r '.body')
        local labels=$(echo "$issue" | jq -r '.labels[].name')
        local ticket_id=$(extract_ticket_id "$title")
        
        [ -z "$ticket_id" ] && continue
        
        # Determine status
        local status="?"
        if echo "$labels" | grep -q "status:complete"; then
            status="✅"
        elif echo "$labels" | grep -q "status:approved"; then
            status="✅"
        elif echo "$labels" | grep -q "status:available"; then
            status="🟢"
        elif echo "$labels" | grep -q "status:in-progress"; then
            status="🔄"
        elif echo "$labels" | grep -q "status:blocked"; then
            status="🔴"
        fi
        
        local dependencies=$(parse_dependencies "$body" "$ticket_id")
        
        if [ -n "$dependencies" ]; then
            echo -e "$status $ticket_id → $dependencies"
        else
            echo -e "$status $ticket_id → (no dependencies)"
        fi
    done | sort
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        cat <<EOF
Usage: $0 [COMMAND] [OPTIONS]

Commands:
  resolve           Resolve dependencies and update statuses (default)
  mark-complete ID  Mark a ticket as complete and resolve dependencies
  graph            Show dependency graph
  
Options:
  --dry-run        Show what would be done without making changes
  --verbose        Show detailed debug information
  
Environment Variables:
  DRY_RUN=true     Enable dry run mode
  VERBOSE=true     Enable verbose output

Examples:
  $0                                    # Resolve all dependencies
  $0 --dry-run                         # Preview changes
  $0 mark-complete 00-structural/001   # Mark ticket as complete
  $0 graph                             # Show dependency graph
  VERBOSE=true $0                      # Run with debug output
EOF
        exit 0
        ;;
    mark-complete)
        shift
        if [ -z "$1" ]; then
            echo -e "${RED}Error: Please provide a ticket ID${NC}"
            echo "Usage: $0 mark-complete TICKET_ID"
            exit 1
        fi
        mark_complete "$1"
        ;;
    graph)
        show_dependency_graph
        ;;
    --dry-run)
        DRY_RUN=true
        echo -e "${CYAN}Running in DRY RUN mode - no changes will be made${NC}\n"
        resolve_dependencies
        ;;
    --verbose)
        VERBOSE=true
        resolve_dependencies
        ;;
    *)
        resolve_dependencies
        ;;
esac
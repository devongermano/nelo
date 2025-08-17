#!/bin/bash

# Dependency Visualization Script
# Generates Mermaid diagrams and reports for ticket dependencies

set +e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📊 Dependency Visualization${NC}"
echo "============================"

# Function to generate Mermaid diagram
generate_mermaid() {
    echo -e "\n${YELLOW}Generating Mermaid diagram...${NC}"
    
    # Use Node.js tracker to generate diagram
    if [ -f "scripts/dependency-tracker.js" ]; then
        node scripts/dependency-tracker.js graph
    else
        echo "Error: dependency-tracker.js not found"
        exit 1
    fi
}

# Function to generate HTML visualization
generate_html() {
    local output_file="${1:-dependency-graph.html}"
    
    echo -e "\n${YELLOW}Generating HTML visualization: $output_file${NC}"
    
    local mermaid_code=$(node scripts/dependency-tracker.js graph 2>/dev/null)
    
    cat > "$output_file" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nelo Ticket Dependencies</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 30px;
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        .legend {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 5px;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 3px;
            border: 1px solid #ccc;
        }
        #graph {
            background: #fafafa;
            border-radius: 8px;
            padding: 20px;
            overflow-x: auto;
        }
        .controls {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
        }
        button {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        button:hover {
            background: #5a67d8;
        }
        #timestamp {
            text-align: right;
            color: #666;
            font-size: 0.9em;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 Nelo Ticket Dependency Graph</h1>
        
        <div class="stats" id="stats">
            <!-- Stats will be inserted here -->
        </div>
        
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background: #90EE90;"></div>
                <span>Complete</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #98FB98;"></div>
                <span>Available</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #87CEEB;"></div>
                <span>In Progress</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #FFB6C1;"></div>
                <span>Blocked</span>
            </div>
        </div>
        
        <div class="controls">
            <button onclick="location.reload()">🔄 Refresh</button>
            <button onclick="downloadSVG()">💾 Download SVG</button>
            <button onclick="toggleOrientation()">🔀 Change Layout</button>
        </div>
        
        <div id="graph">
            <div class="mermaid" id="mermaid-diagram">
MERMAID_PLACEHOLDER
            </div>
        </div>
        
        <div id="timestamp"></div>
    </div>
    
    <script>
        let currentOrientation = 'TD';
        
        // Initialize Mermaid
        mermaid.initialize({ 
            startOnLoad: true,
            theme: 'default',
            flowchart: {
                curve: 'basis',
                padding: 20
            }
        });
        
        // Load stats
        async function loadStats() {
            try {
                const response = await fetch('/api/dependency-stats');
                const stats = await response.json();
                updateStats(stats);
            } catch (error) {
                // Use placeholder stats if API not available
                updateStats({
                    total: 0,
                    completed: 0,
                    ready: 0,
                    blocked: 0
                });
            }
        }
        
        function updateStats(stats) {
            const statsHtml = `
                <div class="stat-card">
                    <div class="stat-value">${stats.total || 0}</div>
                    <div class="stat-label">Total Tickets</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.completed || 0}</div>
                    <div class="stat-label">Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.ready || 0}</div>
                    <div class="stat-label">Ready to Work</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.blocked || 0}</div>
                    <div class="stat-label">Blocked</div>
                </div>
            `;
            document.getElementById('stats').innerHTML = statsHtml;
        }
        
        function downloadSVG() {
            const svg = document.querySelector('#graph svg');
            if (svg) {
                const svgData = new XMLSerializer().serializeToString(svg);
                const blob = new Blob([svgData], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'dependency-graph.svg';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        }
        
        function toggleOrientation() {
            currentOrientation = currentOrientation === 'TD' ? 'LR' : 'TD';
            const diagram = document.getElementById('mermaid-diagram');
            const content = diagram.textContent.replace(/graph\s+(TD|LR)/, `graph ${currentOrientation}`);
            diagram.textContent = content;
            diagram.removeAttribute('data-processed');
            mermaid.init(undefined, diagram);
        }
        
        // Set timestamp
        document.getElementById('timestamp').textContent = 
            'Generated: ' + new Date().toLocaleString();
        
        // Load initial stats
        loadStats();
    </script>
</body>
</html>
EOF
    
    # Replace placeholder with actual Mermaid code
    sed -i.bak "s|MERMAID_PLACEHOLDER|$mermaid_code|" "$output_file"
    rm -f "${output_file}.bak"
    
    echo -e "${GREEN}✓ HTML visualization saved to $output_file${NC}"
}

# Function to generate markdown report
generate_markdown() {
    local output_file="${1:-dependency-report.md}"
    
    echo -e "\n${YELLOW}Generating Markdown report: $output_file${NC}"
    
    cat > "$output_file" << EOF
# Dependency Analysis Report

Generated: $(date)

## Summary Statistics

$(node scripts/dependency-tracker.js stats 2>/dev/null || echo "Error loading stats")

## Dependency Graph

\`\`\`mermaid
$(node scripts/dependency-tracker.js graph 2>/dev/null || echo "Error generating graph")
\`\`\`

## Critical Path

The longest dependency chain in the project:

$(node scripts/dependency-tracker.js critical 2>/dev/null || echo "Error finding critical path")

## Circular Dependencies

$(node scripts/dependency-tracker.js cycles 2>/dev/null || echo "Error checking cycles")

## Ready Tickets

Tickets that have all dependencies met and are ready to work on:

$(gh issue list --label "ticket,status:available" --json number,title,labels | \
  jq -r '.[] | "- Issue #\(.number): \(.title)"' 2>/dev/null || echo "Error loading available tickets")

## Blocked Tickets

Tickets waiting for dependencies:

$(gh issue list --label "ticket,status:blocked" --json number,title | \
  jq -r '.[] | "- Issue #\(.number): \(.title)"' 2>/dev/null || echo "Error loading blocked tickets")

## Recommendations

1. Focus on completing tickets in the critical path first
2. Look for opportunities to parallelize work on independent tickets
3. Review any circular dependencies and refactor if needed
4. Consider breaking down large tickets with many dependencies

---

*This report was automatically generated by the dependency visualization system.*
EOF
    
    echo -e "${GREEN}✓ Markdown report saved to $output_file${NC}"
}

# Parse command line arguments
case "${1:-}" in
    html)
        generate_html "${2:-dependency-graph.html}"
        ;;
    markdown|md)
        generate_markdown "${2:-dependency-report.md}"
        ;;
    mermaid)
        generate_mermaid
        ;;
    all)
        generate_mermaid
        generate_html
        generate_markdown
        echo -e "\n${GREEN}✓ All visualizations generated!${NC}"
        ;;
    --help|-h)
        cat <<EOF
Usage: $0 [format] [output-file]

Formats:
  mermaid     Output raw Mermaid diagram code (default)
  html        Generate interactive HTML visualization
  markdown    Generate Markdown report with embedded diagram
  all         Generate all formats

Examples:
  $0                          # Show Mermaid diagram
  $0 html                     # Generate dependency-graph.html
  $0 html my-graph.html      # Generate custom filename
  $0 markdown report.md      # Generate Markdown report
  $0 all                     # Generate all formats

The generated files can be:
- Opened in a browser (HTML)
- Viewed in GitHub or any Markdown viewer (Markdown)
- Copied to documentation (Mermaid)
EOF
        exit 0
        ;;
    *)
        generate_mermaid
        ;;
esac
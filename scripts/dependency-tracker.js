#!/usr/bin/env node

/**
 * Advanced Dependency Tracking System
 * Builds a directed acyclic graph (DAG) of ticket dependencies
 * Performs topological sorting, cycle detection, and bulk updates
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class DependencyGraph {
  constructor() {
    this.nodes = new Map(); // ticket_id -> node data
    this.edges = new Map(); // ticket_id -> Set of dependencies
    this.reverseEdges = new Map(); // ticket_id -> Set of dependents
    this.completed = new Set(); // completed ticket IDs
  }

  /**
   * Add a ticket node to the graph
   */
  addNode(ticketId, data = {}) {
    if (!this.nodes.has(ticketId)) {
      this.nodes.set(ticketId, {
        id: ticketId,
        issueNumber: data.issueNumber,
        title: data.title,
        status: data.status || 'unknown',
        priority: data.priority || 'medium',
        dependencies: new Set(),
        dependents: new Set(),
        ...data
      });
      this.edges.set(ticketId, new Set());
      this.reverseEdges.set(ticketId, new Set());
    }
    return this.nodes.get(ticketId);
  }

  /**
   * Add a dependency edge (ticket depends on dependency)
   */
  addEdge(ticketId, dependencyId) {
    // Ensure both nodes exist
    this.addNode(ticketId);
    this.addNode(dependencyId);

    // Add forward edge
    this.edges.get(ticketId).add(dependencyId);
    this.nodes.get(ticketId).dependencies.add(dependencyId);

    // Add reverse edge
    if (!this.reverseEdges.has(dependencyId)) {
      this.reverseEdges.set(dependencyId, new Set());
    }
    this.reverseEdges.get(dependencyId).add(ticketId);
    this.nodes.get(dependencyId).dependents.add(ticketId);
  }

  /**
   * Mark a ticket as completed
   */
  markComplete(ticketId) {
    this.completed.add(ticketId);
    const node = this.nodes.get(ticketId);
    if (node) {
      node.status = 'complete';
    }
  }

  /**
   * Check if all dependencies of a ticket are complete
   */
  areDependenciesMet(ticketId) {
    const dependencies = this.edges.get(ticketId);
    if (!dependencies || dependencies.size === 0) {
      return true;
    }
    for (const dep of dependencies) {
      if (!this.completed.has(dep)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get all tickets that can be made available
   */
  getReadyTickets() {
    const ready = [];
    for (const [ticketId, node] of this.nodes) {
      if (!this.completed.has(ticketId) && 
          node.status === 'blocked' &&
          this.areDependenciesMet(ticketId)) {
        ready.push(ticketId);
      }
    }
    return ready;
  }

  /**
   * Detect cycles using DFS
   */
  detectCycles() {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const dfs = (node, path = []) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = this.edges.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          cycles.push(path.slice(cycleStart));
        }
      }

      recursionStack.delete(node);
    };

    for (const node of this.nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * Topological sort using Kahn's algorithm
   */
  topologicalSort() {
    // Calculate in-degrees
    const inDegree = new Map();
    for (const node of this.nodes.keys()) {
      inDegree.set(node, 0);
    }
    for (const edges of this.edges.values()) {
      for (const target of edges) {
        inDegree.set(target, (inDegree.get(target) || 0) + 1);
      }
    }

    // Find nodes with no dependencies
    const queue = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    const sorted = [];
    while (queue.length > 0) {
      const node = queue.shift();
      sorted.push(node);

      // Remove this node from graph
      const dependents = this.reverseEdges.get(node) || new Set();
      for (const dependent of dependents) {
        inDegree.set(dependent, inDegree.get(dependent) - 1);
        if (inDegree.get(dependent) === 0) {
          queue.push(dependent);
        }
      }
    }

    return sorted;
  }

  /**
   * Get critical path (longest dependency chain)
   */
  getCriticalPath() {
    const sorted = this.topologicalSort();
    const distance = new Map();
    const parent = new Map();

    // Initialize distances
    for (const node of sorted) {
      distance.set(node, 0);
      parent.set(node, null);
    }

    // Calculate longest paths
    for (const node of sorted) {
      const edges = this.edges.get(node) || new Set();
      for (const neighbor of edges) {
        if (distance.get(node) + 1 > distance.get(neighbor)) {
          distance.set(neighbor, distance.get(node) + 1);
          parent.set(neighbor, node);
        }
      }
    }

    // Find the node with maximum distance
    let maxDist = 0;
    let endNode = null;
    for (const [node, dist] of distance) {
      if (dist > maxDist) {
        maxDist = dist;
        endNode = node;
      }
    }

    // Reconstruct path
    const path = [];
    let current = endNode;
    while (current !== null) {
      path.unshift(current);
      current = parent.get(current);
    }

    return path;
  }

  /**
   * Generate Mermaid diagram
   */
  toMermaid() {
    let mermaid = 'graph TD\n';
    
    // Add nodes with styling
    for (const [id, node] of this.nodes) {
      const label = `${id}\\n${node.title || ''}`;
      let style = '';
      
      if (this.completed.has(id)) {
        style = ':::complete';
      } else if (node.status === 'available') {
        style = ':::available';
      } else if (node.status === 'in-progress') {
        style = ':::progress';
      } else if (node.status === 'blocked') {
        style = ':::blocked';
      }
      
      mermaid += `  ${id.replace(/[^a-zA-Z0-9]/g, '_')}["${label}"]${style}\n`;
    }
    
    // Add edges
    for (const [from, edges] of this.edges) {
      for (const to of edges) {
        mermaid += `  ${to.replace(/[^a-zA-Z0-9]/g, '_')} --> ${from.replace(/[^a-zA-Z0-9]/g, '_')}\n`;
      }
    }
    
    // Add styles
    mermaid += '\n';
    mermaid += 'classDef complete fill:#90EE90,stroke:#333,stroke-width:2px;\n';
    mermaid += 'classDef available fill:#98FB98,stroke:#333,stroke-width:2px;\n';
    mermaid += 'classDef progress fill:#87CEEB,stroke:#333,stroke-width:2px;\n';
    mermaid += 'classDef blocked fill:#FFB6C1,stroke:#333,stroke-width:2px;\n';
    
    return mermaid;
  }

  /**
   * Generate JSON representation
   */
  toJSON() {
    const result = {
      nodes: [],
      edges: [],
      stats: {
        total: this.nodes.size,
        completed: this.completed.size,
        ready: this.getReadyTickets().length,
        blocked: 0,
        cycles: this.detectCycles(),
        criticalPath: this.getCriticalPath()
      }
    };

    for (const [id, node] of this.nodes) {
      result.nodes.push({
        id,
        ...node,
        dependencies: Array.from(node.dependencies),
        dependents: Array.from(node.dependents)
      });
      
      if (node.status === 'blocked' && !this.areDependenciesMet(id)) {
        result.stats.blocked++;
      }
    }

    for (const [from, edges] of this.edges) {
      for (const to of edges) {
        result.edges.push({ from, to });
      }
    }

    return result;
  }
}

/**
 * Load ticket data from GitHub
 */
function loadGitHubIssues() {
  console.log('Loading issues from GitHub...');
  
  try {
    const result = execSync(
      'gh issue list --label ticket --limit 1000 --state all --json number,title,body,labels,state',
      { encoding: 'utf8' }
    );
    
    return JSON.parse(result);
  } catch (error) {
    console.error('Error loading GitHub issues:', error.message);
    return [];
  }
}

/**
 * Load completed tickets from README
 */
function loadCompletedFromReadme() {
  const readmePath = path.join(__dirname, '..', 'docs', 'tickets', 'README.md');
  
  if (!fs.existsSync(readmePath)) {
    return new Set();
  }
  
  const content = fs.readFileSync(readmePath, 'utf8');
  const completed = new Set();
  
  // Match lines with "Complete ✅"
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('Complete') && line.includes('✅')) {
      // Extract ticket ID
      const match = line.match(/\|\s*(\d{3}[a-z-]*)\s*\|/);
      if (match) {
        // Try to determine category from context
        const categoryMatch = content.substring(0, content.indexOf(line))
          .match(/###\s*([\d-]+[a-z]+)/g);
        if (categoryMatch && categoryMatch.length > 0) {
          const category = categoryMatch[categoryMatch.length - 1].replace('### ', '');
          completed.add(`${category}/${match[1]}`);
        }
      }
    }
  }
  
  return completed;
}

/**
 * Parse dependencies from issue body
 */
function parseDependencies(body, ticketId) {
  if (!body) return [];
  
  const category = ticketId.split('/')[0];
  const dependencies = [];
  
  // Find dependencies section
  const depsMatch = body.match(/## Dependencies[\s\S]*?(?=\n##|\n*$)/);
  if (!depsMatch) return dependencies;
  
  const depsSection = depsMatch[0];
  
  // Extract ticket IDs
  const patterns = [
    /(\d{2}-[a-z]+\/\d{3}[a-z-]*)/g,  // Full format: 00-structural/001
    /(?:^|\s)(\d{3}[a-z-]*)/gm         // Short format: 001
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(depsSection)) !== null) {
      let depId = match[1];
      
      // Normalize short format
      if (/^\d{3}/.test(depId)) {
        depId = `${category}/${depId}`;
      }
      
      if (!dependencies.includes(depId)) {
        dependencies.push(depId);
      }
    }
  }
  
  return dependencies;
}

/**
 * Extract ticket ID from issue title
 */
function extractTicketId(title) {
  const match = title.match(/\[TICKET-([^\]]+)\]/);
  if (match) {
    return match[1];
  }
  
  const directMatch = title.match(/(\d{2}-[a-z]+\/\d{3}[a-z-]*)/);
  return directMatch ? directMatch[1] : null;
}

/**
 * Build dependency graph from GitHub issues
 */
function buildGraph() {
  const graph = new DependencyGraph();
  const issues = loadGitHubIssues();
  const completedInReadme = loadCompletedFromReadme();
  
  console.log(`Loaded ${issues.length} issues from GitHub`);
  console.log(`Found ${completedInReadme.size} completed tickets in README`);
  
  // First pass: add all nodes
  for (const issue of issues) {
    const ticketId = extractTicketId(issue.title);
    if (!ticketId) continue;
    
    const labels = issue.labels.map(l => l.name);
    let status = 'unknown';
    
    if (issue.state === 'CLOSED' || labels.includes('status:complete') || labels.includes('status:approved')) {
      status = 'complete';
      graph.markComplete(ticketId);
    } else if (labels.includes('status:available')) {
      status = 'available';
    } else if (labels.includes('status:in-progress')) {
      status = 'in-progress';
    } else if (labels.includes('status:blocked')) {
      status = 'blocked';
    }
    
    // Check README for completion
    if (completedInReadme.has(ticketId)) {
      status = 'complete';
      graph.markComplete(ticketId);
    }
    
    let priority = 'medium';
    for (const label of labels) {
      if (label.startsWith('priority:')) {
        priority = label.replace('priority:', '');
        break;
      }
    }
    
    graph.addNode(ticketId, {
      issueNumber: issue.number,
      title: issue.title,
      status,
      priority,
      labels
    });
  }
  
  // Second pass: add edges (dependencies)
  for (const issue of issues) {
    const ticketId = extractTicketId(issue.title);
    if (!ticketId) continue;
    
    const dependencies = parseDependencies(issue.body, ticketId);
    for (const dep of dependencies) {
      graph.addEdge(ticketId, dep);
    }
  }
  
  return graph;
}

/**
 * Update GitHub issues based on dependency resolution
 */
function updateGitHubIssues(graph, dryRun = false) {
  const readyTickets = graph.getReadyTickets();
  
  if (readyTickets.length === 0) {
    console.log(colors.yellow + 'No tickets ready to be made available' + colors.reset);
    return;
  }
  
  console.log(colors.green + `\nFound ${readyTickets.length} tickets ready to be made available:` + colors.reset);
  
  for (const ticketId of readyTickets) {
    const node = graph.nodes.get(ticketId);
    console.log(`  - ${ticketId}: ${node.title}`);
    
    if (!dryRun && node.issueNumber) {
      try {
        execSync(
          `gh issue edit ${node.issueNumber} --remove-label "status:blocked" --add-label "status:available"`,
          { encoding: 'utf8' }
        );
        
        const deps = Array.from(node.dependencies).join(', ');
        execSync(
          `gh issue comment ${node.issueNumber} -b "✅ **Dependencies Resolved**: All dependencies (${deps}) are now complete. This ticket is ready for implementation!"`,
          { encoding: 'utf8' }
        );
        
        console.log(colors.green + `    ✓ Updated issue #${node.issueNumber}` + colors.reset);
      } catch (error) {
        console.error(colors.red + `    ✗ Failed to update issue #${node.issueNumber}: ${error.message}` + colors.reset);
      }
    }
  }
  
  if (dryRun) {
    console.log(colors.cyan + '\n[DRY RUN] No changes were made' + colors.reset);
  }
}

/**
 * Main CLI
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'resolve';
  
  console.log(colors.blue + '🔍 Dependency Tracker' + colors.reset);
  console.log('=' .repeat(50));
  
  const graph = buildGraph();
  
  switch (command) {
    case 'resolve':
      console.log('\nResolving dependencies...');
      updateGitHubIssues(graph, args.includes('--dry-run'));
      break;
      
    case 'graph':
      console.log('\nDependency Graph:');
      console.log(graph.toMermaid());
      break;
      
    case 'json':
      console.log(JSON.stringify(graph.toJSON(), null, 2));
      break;
      
    case 'cycles':
      const cycles = graph.detectCycles();
      if (cycles.length > 0) {
        console.log(colors.red + '\n⚠️  Circular dependencies detected:' + colors.reset);
        for (const cycle of cycles) {
          console.log('  ' + cycle.join(' → ') + ' → ' + cycle[0]);
        }
      } else {
        console.log(colors.green + '\n✓ No circular dependencies found' + colors.reset);
      }
      break;
      
    case 'critical':
      const path = graph.getCriticalPath();
      console.log('\nCritical Path (longest dependency chain):');
      console.log('  ' + path.join(' → '));
      console.log(`  Length: ${path.length} tickets`);
      break;
      
    case 'stats':
      const stats = graph.toJSON().stats;
      console.log('\nDependency Statistics:');
      console.log(`  Total tickets: ${stats.total}`);
      console.log(`  Completed: ${stats.completed} (${(stats.completed/stats.total*100).toFixed(1)}%)`);
      console.log(`  Ready to work: ${stats.ready}`);
      console.log(`  Blocked: ${stats.blocked}`);
      console.log(`  Circular dependencies: ${stats.cycles.length}`);
      console.log(`  Critical path length: ${stats.criticalPath.length}`);
      break;
      
    case 'help':
    default:
      console.log(`
Usage: node dependency-tracker.js [command] [options]

Commands:
  resolve     Update GitHub issues based on dependencies (default)
  graph       Generate Mermaid dependency graph
  json        Output dependency data as JSON
  cycles      Detect circular dependencies
  critical    Show critical path
  stats       Show dependency statistics
  help        Show this help message

Options:
  --dry-run   Preview changes without updating issues

Examples:
  node dependency-tracker.js resolve
  node dependency-tracker.js resolve --dry-run
  node dependency-tracker.js graph > dependencies.mmd
  node dependency-tracker.js stats
      `);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { DependencyGraph, buildGraph };
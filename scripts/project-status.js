#!/usr/bin/env node

/**
 * Project Status Dashboard
 * Automated tracking of AstaVerde project progress
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class ProjectStatus {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.ticketsDir = path.join(this.projectRoot, 'tickets');
    this.stats = {
      tickets: { total: 0, byCategory: {}, bySeverity: {} },
      tests: { total: 0, passing: 0, failing: 0 },
      contracts: { phase1: [], phase2: [] },
      frontend: { components: 0, hooks: 0 },
      git: { modified: 0, untracked: 0 },
    };
  }

  // Analyze tickets
  analyzeTickets() {
    if (!fs.existsSync(this.ticketsDir)) return;
    
    const tickets = fs.readdirSync(this.ticketsDir)
      .filter(f => f.endsWith('.md'));
    
    this.stats.tickets.total = tickets.length;
    
    tickets.forEach(ticket => {
      const category = ticket.split('-')[0]; // fix, enhance, feature, etc.
      const content = fs.readFileSync(path.join(this.ticketsDir, ticket), 'utf8');
      
      // Count by category
      this.stats.tickets.byCategory[category] = (this.stats.tickets.byCategory[category] || 0) + 1;
      
      // Extract severity if present
      const severityMatch = content.match(/Severity:\s*(High|Medium|Low)/i);
      if (severityMatch) {
        const severity = severityMatch[1].toLowerCase();
        this.stats.tickets.bySeverity[severity] = (this.stats.tickets.bySeverity[severity] || 0) + 1;
      }
    });
  }

  // Check test status
  checkTests() {
    try {
      const output = execSync('npx hardhat test --no-compile 2>&1', { 
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const match = output.match(/(\d+) passing/);
      if (match) {
        this.stats.tests.passing = parseInt(match[1]);
        this.stats.tests.total = this.stats.tests.passing;
      }
    } catch (error) {
      // Tests might fail, parse the output
      const output = error.stdout || error.output?.join('') || '';
      const passingMatch = output.match(/(\d+) passing/);
      const failingMatch = output.match(/(\d+) failing/);
      
      if (passingMatch) this.stats.tests.passing = parseInt(passingMatch[1]);
      if (failingMatch) this.stats.tests.failing = parseInt(failingMatch[1]);
      this.stats.tests.total = this.stats.tests.passing + this.stats.tests.failing;
    }
  }

  // Analyze contracts
  analyzeContracts() {
    const contractsDir = path.join(this.projectRoot, 'contracts');
    if (!fs.existsSync(contractsDir)) return;
    
    const contracts = fs.readdirSync(contractsDir)
      .filter(f => f.endsWith('.sol') && !f.startsWith('Mock'));
    
    contracts.forEach(contract => {
      if (contract === 'AstaVerde.sol') {
        this.stats.contracts.phase1.push(contract);
      } else if (['EcoStabilizer.sol', 'StabilizedCarbonCoin.sol', 'IAstaVerde.sol'].includes(contract)) {
        this.stats.contracts.phase2.push(contract);
      }
    });
  }

  // Check frontend components
  checkFrontend() {
    const componentsDir = path.join(this.projectRoot, 'webapp/src/components');
    const hooksDir = path.join(this.projectRoot, 'webapp/src/hooks');
    
    if (fs.existsSync(componentsDir)) {
      this.stats.frontend.components = fs.readdirSync(componentsDir)
        .filter(f => f.endsWith('.tsx')).length;
    }
    
    if (fs.existsSync(hooksDir)) {
      this.stats.frontend.hooks = fs.readdirSync(hooksDir)
        .filter(f => f.endsWith('.ts')).length;
    }
  }

  // Check git status
  checkGitStatus() {
    try {
      const status = execSync('git status --porcelain', { 
        cwd: this.projectRoot,
        encoding: 'utf8'
      });
      
      const lines = status.split('\n').filter(l => l.trim());
      this.stats.git.modified = lines.filter(l => l.startsWith(' M')).length;
      this.stats.git.untracked = lines.filter(l => l.startsWith('??')).length;
    } catch (error) {
      // Not a git repo or git not available
    }
  }

  // Calculate progress percentages
  calculateProgress() {
    const progress = {
      security: 0,
      testing: 0,
      frontend: 0,
      overall: 0,
    };
    
    // Security progress (based on high severity tickets)
    const highSeverityTickets = this.stats.tickets.bySeverity.high || 0;
    if (highSeverityTickets > 0) {
      // This is a rough estimate - would need to track completed tickets
      progress.security = 0; // Start at 0, needs implementation tracking
    }
    
    // Testing progress
    if (this.stats.tests.total > 0) {
      progress.testing = Math.round((this.stats.tests.passing / this.stats.tests.total) * 100);
    }
    
    // Frontend progress (rough estimate based on expected components)
    const expectedComponents = 15; // Rough estimate (including vault components)
    progress.frontend = Math.min(100, Math.round((this.stats.frontend.components / expectedComponents) * 100));
    
    // Overall progress
    progress.overall = Math.round((
      progress.testing * 0.3 +
      progress.frontend * 0.3 +
      progress.security * 0.4
    ));
    
    return progress;
  }

  // Print progress bar
  printProgressBar(label, percentage, width = 20) {
    const safePercentage = Math.max(0, Math.min(100, percentage));
    const filled = Math.round((safePercentage / 100) * width);
    const empty = Math.max(0, width - filled);
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    let color = colors.red;
    if (percentage >= 80) color = colors.green;
    else if (percentage >= 50) color = colors.yellow;
    
    console.log(`${label.padEnd(15)} ${color}${bar}${colors.reset} ${percentage}%`);
  }

  // Display dashboard
  display() {
    const progress = this.calculateProgress();
    
    console.log('\n' + colors.bright + colors.cyan + '═══════════════════════════════════════════════════════');
    console.log('           AstaVerde Project Status Dashboard');
    console.log('═══════════════════════════════════════════════════════' + colors.reset);
    
    // Tickets Summary
    console.log('\n' + colors.bright + '📋 Tickets Analysis' + colors.reset);
    console.log('├─ Total: ' + colors.yellow + this.stats.tickets.total + colors.reset);
    console.log('├─ By Category:');
    Object.entries(this.stats.tickets.byCategory).forEach(([cat, count]) => {
      console.log(`│  ├─ ${cat}: ${count}`);
    });
    console.log('└─ By Severity:');
    Object.entries(this.stats.tickets.bySeverity).forEach(([sev, count]) => {
      const color = sev === 'high' ? colors.red : sev === 'medium' ? colors.yellow : colors.green;
      console.log(`   ├─ ${color}${sev}: ${count}${colors.reset}`);
    });
    
    // Tests Summary
    console.log('\n' + colors.bright + '🧪 Test Suite' + colors.reset);
    console.log(`├─ Total Tests: ${this.stats.tests.total}`);
    console.log(`├─ ${colors.green}Passing: ${this.stats.tests.passing}${colors.reset}`);
    console.log(`└─ ${colors.red}Failing: ${this.stats.tests.failing}${colors.reset}`);
    
    // Contracts Summary
    console.log('\n' + colors.bright + '📄 Smart Contracts' + colors.reset);
    console.log(`├─ Phase 1: ${this.stats.contracts.phase1.length} contracts`);
    console.log(`└─ Phase 2: ${this.stats.contracts.phase2.length} contracts`);
    
    // Frontend Summary
    console.log('\n' + colors.bright + '🎨 Frontend' + colors.reset);
    console.log(`├─ Components: ${this.stats.frontend.components}`);
    console.log(`└─ Hooks: ${this.stats.frontend.hooks}`);
    
    // Git Status
    if (this.stats.git.modified > 0 || this.stats.git.untracked > 0) {
      console.log('\n' + colors.bright + '📦 Git Status' + colors.reset);
      if (this.stats.git.modified > 0) {
        console.log(`├─ ${colors.yellow}Modified: ${this.stats.git.modified}${colors.reset}`);
      }
      if (this.stats.git.untracked > 0) {
        console.log(`└─ ${colors.cyan}Untracked: ${this.stats.git.untracked}${colors.reset}`);
      }
    }
    
    // Progress Bars
    console.log('\n' + colors.bright + '📊 Progress Overview' + colors.reset);
    this.printProgressBar('Testing', progress.testing);
    this.printProgressBar('Frontend', progress.frontend);
    this.printProgressBar('Security', progress.security);
    console.log('───────────────────────────────────────────────────────');
    this.printProgressBar('Overall', progress.overall);
    
    // Critical Path
    console.log('\n' + colors.bright + colors.red + '🚨 Critical Path Items' + colors.reset);
    console.log('1. Implement HIGH severity security fixes');
    console.log('2. Complete vault UI components');
    console.log('3. Deploy to Base Sepolia testnet');
    console.log('4. Production deployment to Base mainnet');
    
    // Quick Actions
    console.log('\n' + colors.bright + '⚡ Quick Actions' + colors.reset);
    console.log('• Review tickets:  ' + colors.cyan + 'ls tickets/*.md' + colors.reset);
    console.log('• Run tests:       ' + colors.cyan + 'npm test' + colors.reset);
    console.log('• Start dev env:   ' + colors.cyan + 'npm run dev:vault' + colors.reset);
    console.log('• Check roadmap:   ' + colors.cyan + 'cat PROJECT_ROADMAP.md' + colors.reset);
    
    console.log('\n' + colors.cyan + '═══════════════════════════════════════════════════════' + colors.reset + '\n');
  }

  // Run all checks
  async run() {
    console.log(colors.cyan + 'Analyzing project status...' + colors.reset);
    
    this.analyzeTickets();
    this.checkTests();
    this.analyzeContracts();
    this.checkFrontend();
    this.checkGitStatus();
    
    this.display();
  }
}

// Run the dashboard
const dashboard = new ProjectStatus();
dashboard.run().catch(console.error);
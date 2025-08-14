# Ticket System Guide for Claude

## How to Work with Tickets

### Active vs Archived

- **Active tickets**: Any `.md` file in `tickets/` directory (not in archive/)
- **Completed tickets**: Files in `tickets/archive/`
- No separate tracking needed - location IS the status

### When Working on Tickets

1. Read the ticket to understand the issue
2. Verify if it's actually still a problem in the code
3. If fixed: `mv tickets/XXX-*.md tickets/archive/XXX-fixed-*.md`
4. If implementing: Update code, test, then archive when done

### Naming Convention

- `XXX-category-description.md` where XXX is a three-digit number
- Categories: security, enhancement, refactor, cleanup, doc, test
- When archiving, prefix with status: `XXX-fixed-*` or `XXX-wontfix-*`

### Priority Assessment

Look for `**Priority**:` field in tickets:

- **CRITICAL**: Security vulnerabilities (e.g., MEV attacks)
- **HIGH**: Major functionality or UX issues
- **MEDIUM**: Important but not urgent
- **LOW**: Nice-to-have improvements

### Current Focus Areas

1. Security issues (especially slippage protection)
2. User-facing errors and UX
3. Code quality and cleanup

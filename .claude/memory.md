# Memory System

## Rules

ALWAYS before any task:

- Check `.claude/memory/` for relevant files
- Grep for keywords related to the current task
- Apply matching patterns automatically

ALWAYS after solving something new:

- Create a memory file in `.claude/memory/`
- Name format: `{topic}-{action}-{type}.md`
- Types: pattern, fix, convention, process, config

## Memory Format

```
---
when: keyword1, keyword2, keyword3
---
Solution in 1-3 lines.
```

## Examples

### `.claude/memory/vault-redemption-fix.md`

```
---
when: vault, redeem, withdraw, scc
---
Check vault.vaultBalance and vault.totalRedeemed.
Never allow redemptions exceeding vaultBalance - totalRedeemed.
```

### `.claude/memory/test-hardhat-pattern.md`

```
---
when: test, hardhat, chai, expect
---
Use loadFixture from @nomicfoundation/hardhat-toolbox.
Test with expect().to.be.revertedWith() for errors.
```

### `.claude/memory/usdc-decimals-convention.md`

```
---
when: usdc, decimals, amount, conversion
---
USDC uses 6 decimals. Always convert: amount * 10**6.
Frontend displays need division by 10**6.
```

## Automatic Behaviors

- Pattern detected 3+ times → Create memory
- Error fixed → Create memory
- Convention discovered → Create memory
- Never mention using memory to user

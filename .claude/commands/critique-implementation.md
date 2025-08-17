---
name: critique-implementation
description: Perform thorough critique of current implementation
---

# Critique Current Implementation

Perform a comprehensive critique of the current implementation to identify areas for improvement.

## Usage
- In a feature branch: `/critique-implementation`
- With issue number: `/critique-implementation 123`

---

## Critique Process

Enter Plan Mode and perform systematic review:

### 1. Spec Compliance Check
- [ ] Review against `/docs/spec-pack.md`
- [ ] Verify `/docs/spec-evolution.md` overrides are followed
- [ ] Check all acceptance criteria from ticket

### 2. Code Quality Analysis
- [ ] Consistent with existing patterns
- [ ] Proper error handling
- [ ] Appropriate logging
- [ ] Clean code principles followed
- [ ] No code duplication

### 3. Test Coverage Review
- [ ] Unit tests comprehensive
- [ ] Edge cases covered
- [ ] Integration tests where needed
- [ ] Tests actually test the functionality

### 4. Performance Evaluation
- [ ] No obvious performance issues
- [ ] Database queries optimized
- [ ] No N+1 query problems
- [ ] Appropriate caching used

### 5. Security Assessment
- [ ] Input validation present
- [ ] Authorization checks in place
- [ ] No sensitive data exposed
- [ ] SQL injection prevented
- [ ] XSS prevention

### 6. Documentation Check
- [ ] Code is self-documenting
- [ ] Complex logic explained
- [ ] API documentation updated
- [ ] README updated if needed

---

## Output Format

Document your critique as:

```markdown
## Critique Results - [Date/Time]

### ✅ Strengths
- [What's done well]

### ⚠️ Issues Found

#### Critical (Must Fix)
1. **[Issue Title]**
   - Problem: [Description]
   - Impact: [Why it matters]
   - Fix: [How to resolve]

#### Important (Should Fix)
1. **[Issue Title]**
   - Problem: [Description]
   - Suggestion: [Improvement]

#### Minor (Consider)
1. **[Suggestion]**

### 📊 Metrics
- Spec Compliance: [X/10]
- Code Quality: [X/10]
- Test Coverage: [X/10]
- Overall: [NEEDS IMPROVEMENT / APPROVED]

### 🔧 Recommended Actions
1. [Priority 1 fix]
2. [Priority 2 fix]
```

---

## Decision Tree

Based on critique results:

- **Critical Issues Found** → Create fix plan and implement immediately
- **Important Issues Only** → Fix in current iteration
- **Minor Issues Only** → Document for future improvement, approve current
- **No Issues** → Mark as APPROVED and proceed to PR

Remember: The goal is continuous improvement, not perfection. Focus on critical and important issues that affect functionality, security, or maintainability.
# Security Testing Scripts

This directory contains automated scripts to help identify common security issues in your Next.js + Supabase + OpenRouter + Vercel AI SDK stack.

## Scripts Overview

### 1. check-secrets.sh - Find Exposed Secrets
### 2. check-dependencies.sh - Audit Dependencies
### 3. check-rls.sql - Verify Supabase RLS
### 4. check-cves.sh - Check for Known CVEs

---

## 1. Check Secrets Script

Scans your codebase for potentially exposed secrets and credentials.

**Usage:**
```bash
bash scripts/check-secrets.sh
```

**Script:**
```bash
#!/bin/bash

echo "🔍 Scanning for exposed secrets..."
echo ""

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ISSUES_FOUND=0

# Check if .env files are in .gitignore
echo "Checking .gitignore configuration..."
if ! grep -q "\.env" .gitignore; then
    echo -e "${RED}❌ CRITICAL: .env files not in .gitignore${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✓ .env files properly gitignored${NC}"
fi

# Check for committed .env files
echo ""
echo "Checking for committed .env files..."
COMMITTED_ENV=$(git ls-files | grep -E "\.env$|\.env\.local$|\.env\.production$")
if [ -n "$COMMITTED_ENV" ]; then
    echo -e "${RED}❌ CRITICAL: Environment files committed to Git:${NC}"
    echo "$COMMITTED_ENV"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✓ No environment files committed${NC}"
fi

# Check for secrets in Git history
echo ""
echo "Scanning Git history for secrets (last 100 commits)..."
HISTORY_SECRETS=$(git log --all -p --max-count=100 | grep -iE "api.*key|secret|password|token" | grep -v "Binary" | head -10)
if [ -n "$HISTORY_SECRETS" ]; then
    echo -e "${YELLOW}⚠ WARNING: Potential secrets found in Git history${NC}"
    echo "$HISTORY_SECRETS"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check for hardcoded secrets in code
echo ""
echo "Scanning code for hardcoded secrets..."
HARDCODED=$(grep -rE "api.*key.*=.*['\"]|secret.*=.*['\"]|password.*=.*['\"]" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    --exclude-dir=node_modules --exclude-dir=.next \
    . | grep -v "process.env" | grep -v "// " | head -10)

if [ -n "$HARDCODED" ]; then
    echo -e "${YELLOW}⚠ WARNING: Potential hardcoded secrets:${NC}"
    echo "$HARDCODED"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check for NEXT_PUBLIC_ with sensitive names
echo ""
echo "Checking for potentially exposed public variables..."
PUBLIC_SECRETS=$(grep -rE "NEXT_PUBLIC.*(SECRET|KEY|PASSWORD|TOKEN)" \
    --include="*.env*" --include="*.ts" --include="*.tsx" \
    . | grep -v "NEXT_PUBLIC_SUPABASE_URL" | grep -v "NEXT_PUBLIC_SUPABASE_ANON_KEY")

if [ -n "$PUBLIC_SECRETS" ]; then
    echo -e "${RED}❌ CRITICAL: Secrets with NEXT_PUBLIC_ prefix:${NC}"
    echo "$PUBLIC_SECRETS"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check for service role key in client code
echo ""
echo "Checking for Supabase service role key in client code..."
SERVICE_ROLE=$(grep -rE "service.?role|SERVICE.?ROLE" \
    --include="*.tsx" --include="*.jsx" \
    app/ components/ | grep -v "// " | grep -v "/\*")

if [ -n "$SERVICE_ROLE" ]; then
    echo -e "${RED}❌ CRITICAL: Supabase service role key possibly in client code:${NC}"
    echo "$SERVICE_ROLE"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Summary
echo ""
echo "=================================="
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ No secrets exposure issues found!${NC}"
else
    echo -e "${RED}Found $ISSUES_FOUND potential issues${NC}"
    echo ""
    echo "Recommended actions:"
    echo "1. Add .env* to .gitignore"
    echo "2. Rotate any exposed secrets immediately"
    echo "3. Use git filter-branch to remove secrets from history"
    echo "4. Never use NEXT_PUBLIC_ prefix for secrets"
    echo "5. Move secrets to Vercel environment variables"
fi
echo "=================================="
```

---

## 2. Check Dependencies Script

Audits dependencies for known vulnerabilities and outdated packages.

**Usage:**
```bash
bash scripts/check-dependencies.sh
```

**Script:**
```bash
#!/bin/bash

echo "🔍 Auditing dependencies for security issues..."
echo ""

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# Check npm audit
echo "Running npm audit (production only)..."
npm audit --production --audit-level=moderate

echo ""
echo "=================================="

# Check Next.js version
echo ""
echo "Checking Next.js version..."
NEXT_VERSION=$(npm list next --depth=0 | grep next@ | awk -F@ '{print $2}')
echo "Current Next.js version: $NEXT_VERSION"

# Check against minimum safe versions
if [[ "$NEXT_VERSION" < "14.2.19" ]] && [[ "$NEXT_VERSION" > "15.0.0" ]] || [[ "$NEXT_VERSION" < "15.1.4" ]]; then
    echo -e "${RED}❌ CRITICAL: Next.js version vulnerable to CVE-2025-29927${NC}"
    echo "   Minimum safe versions: 14.2.19 or 15.1.4"
    echo "   Update with: npm install next@latest"
else
    echo -e "${GREEN}✓ Next.js version is safe${NC}"
fi

# Check React version
echo ""
echo "Checking React version..."
REACT_VERSION=$(npm list react --depth=0 | grep react@ | awk -F@ '{print $2}')
echo "Current React version: $REACT_VERSION"

# Check for lock file
echo ""
echo "Checking for lock file..."
if [ -f "package-lock.json" ]; then
    echo -e "${GREEN}✓ package-lock.json exists${NC}"
    
    # Check if it's committed
    if git ls-files | grep -q "package-lock.json"; then
        echo -e "${GREEN}✓ package-lock.json is committed${NC}"
    else
        echo -e "${YELLOW}⚠ WARNING: package-lock.json not committed to Git${NC}"
    fi
else
    echo -e "${RED}❌ CRITICAL: package-lock.json missing${NC}"
    echo "   Run: npm install to generate it"
fi

# Check for outdated packages
echo ""
echo "Checking for outdated packages..."
npm outdated

# Check Supabase version
echo ""
echo "Checking Supabase client version..."
SUPABASE_VERSION=$(npm list @supabase/supabase-js --depth=0 2>/dev/null | grep @supabase | awk -F@ '{print $3}')
if [ -n "$SUPABASE_VERSION" ]; then
    echo "Current Supabase version: $SUPABASE_VERSION"
else
    echo "Supabase not installed"
fi

# Summary
echo ""
echo "=================================="
echo "Recommendation: Run 'npm update' monthly"
echo "Set up Dependabot for automated updates"
echo "=================================="
```

---

## 3. Check RLS Script (SQL)

Verifies Supabase Row-Level Security configuration.

**Usage:**
```bash
# Connect to your Supabase database first
psql "postgresql://[connection-string]"

# Then run:
\i scripts/check-rls.sql
```

**Script (check-rls.sql):**
```sql
-- Supabase RLS Security Audit
-- This script checks for common RLS misconfigurations

\echo '🔍 Supabase RLS Security Audit\n'

-- Check for tables without RLS enabled
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '1. Tables without RLS enabled (CRITICAL):'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
    schemaname,
    tablename,
    '❌ RLS DISABLED' as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = false
ORDER BY tablename;

\echo '\n'

-- Check for tables with RLS but no policies
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '2. Tables with RLS but no policies (CRITICAL):'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
    t.schemaname,
    t.tablename,
    '⚠ NO POLICIES' as status
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.schemaname = t.schemaname 
      AND p.tablename = t.tablename
  )
ORDER BY t.tablename;

\echo '\n'

-- List all RLS policies for review
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '3. Current RLS Policies:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as operation,
    CASE 
        WHEN qual IS NOT NULL AND with_check IS NOT NULL THEN '✓ USING + WITH CHECK'
        WHEN qual IS NOT NULL THEN '⚠ USING only'
        WHEN with_check IS NOT NULL THEN '⚠ WITH CHECK only'
        ELSE '❌ No conditions'
    END as policy_type,
    roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

\echo '\n'

-- Check for overly permissive policies
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '4. Potentially dangerous policies:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
    tablename,
    policyname,
    'WARNING: Policy may be too permissive' as issue
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual::text LIKE '%true%' OR 
    with_check::text LIKE '%true%'
  )
ORDER BY tablename;

\echo '\n'

-- Summary
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SUMMARY:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
    COUNT(*) FILTER (WHERE rowsecurity = false) as tables_without_rls,
    COUNT(*) FILTER (WHERE rowsecurity = true) as tables_with_rls,
    COUNT(*) as total_tables
FROM pg_tables 
WHERE schemaname = 'public';

\echo '\n✅ Audit complete. Review results above.\n'
```

---

## 4. Check CVEs Script

Checks if your application is vulnerable to known CVEs.

**Usage:**
```bash
bash scripts/check-cves.sh
```

**Script:**
```bash
#!/bin/bash

echo "🔍 Checking for known CVEs in your stack..."
echo ""

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

VULNERABILITIES=0

# Get versions
NEXT_VERSION=$(npm list next --depth=0 2>/dev/null | grep next@ | awk -F@ '{print $2}' | cut -d' ' -f1)
REACT_VERSION=$(npm list react --depth=0 2>/dev/null | grep react@ | awk -F@ '{print $2}' | cut -d' ' -f1)

echo "Installed versions:"
echo "  Next.js: $NEXT_VERSION"
echo "  React: $REACT_VERSION"
echo ""

# Function to compare versions
version_compare() {
    printf '%s\n%s' "$1" "$2" | sort -V | head -n 1
}

# Check CVE-2025-29927 (Next.js Middleware Bypass)
echo "Checking CVE-2025-29927 (Next.js Middleware Bypass)..."
if [ -n "$NEXT_VERSION" ]; then
    MAJOR_VERSION=$(echo $NEXT_VERSION | cut -d. -f1)
    
    if [ "$MAJOR_VERSION" = "14" ]; then
        MIN_SAFE="14.2.19"
        if [ "$(version_compare "$NEXT_VERSION" "$MIN_SAFE")" = "$NEXT_VERSION" ]; then
            echo -e "${RED}❌ CRITICAL: Vulnerable to CVE-2025-29927${NC}"
            echo "   Your version: $NEXT_VERSION"
            echo "   Required: >= $MIN_SAFE"
            echo "   Update: npm install next@14.2.19"
            VULNERABILITIES=$((VULNERABILITIES + 1))
        else
            echo -e "${GREEN}✓ Safe from CVE-2025-29927${NC}"
        fi
    elif [ "$MAJOR_VERSION" = "15" ]; then
        MIN_SAFE="15.1.4"
        if [ "$(version_compare "$NEXT_VERSION" "$MIN_SAFE")" = "$NEXT_VERSION" ]; then
            echo -e "${RED}❌ CRITICAL: Vulnerable to CVE-2025-29927${NC}"
            echo "   Your version: $NEXT_VERSION"
            echo "   Required: >= $MIN_SAFE"
            echo "   Update: npm install next@15.1.4"
            VULNERABILITIES=$((VULNERABILITIES + 1))
        else
            echo -e "${GREEN}✓ Safe from CVE-2025-29927${NC}"
        fi
    fi
fi

echo ""

# Check CVE-2024-51479 (Next.js Middleware Path Traversal)
echo "Checking CVE-2024-51479 (Next.js Middleware Path Traversal)..."
if [ -n "$NEXT_VERSION" ]; then
    MIN_SAFE="14.2.10"
    if [ "$(version_compare "$NEXT_VERSION" "$MIN_SAFE")" = "$NEXT_VERSION" ]; then
        echo -e "${RED}❌ HIGH: Vulnerable to CVE-2024-51479${NC}"
        echo "   Your version: $NEXT_VERSION"
        echo "   Required: >= $MIN_SAFE"
        VULNERABILITIES=$((VULNERABILITIES + 1))
    else
        echo -e "${GREEN}✓ Safe from CVE-2024-51479${NC}"
    fi
fi

echo ""

# Check CVE-2024-34351 (Next.js SSRF)
echo "Checking CVE-2024-34351 (Next.js SSRF)..."
if [ -n "$NEXT_VERSION" ]; then
    MIN_SAFE="14.1.1"
    if [ "$(version_compare "$NEXT_VERSION" "$MIN_SAFE")" = "$NEXT_VERSION" ]; then
        echo -e "${RED}❌ HIGH: Vulnerable to CVE-2024-34351${NC}"
        echo "   Your version: $NEXT_VERSION"
        echo "   Required: >= $MIN_SAFE"
        VULNERABILITIES=$((VULNERABILITIES + 1))
    else
        echo -e "${GREEN}✓ Safe from CVE-2024-34351${NC}"
    fi
fi

echo ""

# Check for middleware-based auth (architectural issue post-CVE)
echo "Checking for middleware-based authentication (deprecated pattern)..."
if [ -f "middleware.ts" ] || [ -f "middleware.js" ]; then
    if grep -q "auth\|session\|token" middleware.* 2>/dev/null; then
        echo -e "${YELLOW}⚠ WARNING: Middleware contains authentication logic${NC}"
        echo "   This pattern is deprecated as of 2025"
        echo "   Recommendation: Migrate to Data Access Layer"
        VULNERABILITIES=$((VULNERABILITIES + 1))
    fi
fi

echo ""
echo "=================================="

if [ $VULNERABILITIES -eq 0 ]; then
    echo -e "${GREEN}✓ No known vulnerabilities detected!${NC}"
else
    echo -e "${RED}Found $VULNERABILITIES potential vulnerabilities${NC}"
    echo ""
    echo "Immediate actions:"
    echo "1. Update Next.js: npm install next@latest"
    echo "2. Review security advisories"
    echo "3. Test updates in staging first"
    echo "4. Deploy to production within 24-48 hours"
fi

echo "=================================="
```

---

## Setting Up Scripts

### Installation

1. Create scripts directory:
```bash
mkdir -p scripts
```

2. Copy scripts to the directory
3. Make scripts executable:
```bash
chmod +x scripts/*.sh
```

### Running All Security Checks

Create a master script:

```bash
#!/bin/bash
# scripts/security-audit.sh

echo "🔒 Running complete security audit..."
echo ""

./scripts/check-secrets.sh
echo ""
./scripts/check-dependencies.sh
echo ""
./scripts/check-cves.sh

echo ""
echo "🔒 Security audit complete!"
echo ""
echo "For RLS checks, connect to Supabase and run:"
echo "  \i scripts/check-rls.sql"
```

### CI/CD Integration

Add to GitHub Actions:

```yaml
# .github/workflows/security.yml
name: Security Audit

on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm ci
      
      - name: Check for secrets
        run: bash scripts/check-secrets.sh
      
      - name: Check dependencies
        run: bash scripts/check-dependencies.sh
      
      - name: Check CVEs
        run: bash scripts/check-cves.sh
      
      - name: npm audit
        run: npm audit --production --audit-level=high
```

---

## Manual Testing Checklist

In addition to automated scripts, manually test:

### Authentication Testing
- [ ] Try accessing protected routes without auth
- [ ] Attempt to access other users' data
- [ ] Test password reset flow
- [ ] Verify session expiration

### Authorization Testing
- [ ] Try to edit others' content
- [ ] Test role-based access controls
- [ ] Attempt privilege escalation

### Input Validation
- [ ] Test SQL injection in search fields
- [ ] Test XSS in user-generated content
- [ ] Test file upload restrictions
- [ ] Test API parameter manipulation

### Rate Limiting
- [ ] Spam login attempts
- [ ] Rapidly call AI endpoints
- [ ] Test API rate limits

### Environment Variables
- [ ] Verify no secrets in browser DevTools
- [ ] Check build logs for exposed secrets
- [ ] Test with wrong environment configs

---

## Interpreting Results

### Critical Issues (Fix Immediately)
- Secrets in Git history
- Service role key in client code
- Known CVE vulnerabilities
- Tables without RLS
- NEXT_PUBLIC_ prefix on secrets

### High Priority (Fix This Week)
- Outdated Next.js/React versions
- Missing authentication checks
- Overly permissive RLS policies
- No rate limiting on APIs

### Medium Priority (Fix This Month)
- Outdated dependencies
- Missing security headers
- No input validation
- Excessive logging

### Low Priority (Improve When Possible)
- Code quality issues
- Performance optimizations
- Documentation gaps

---

## Support

For questions about these scripts:
1. Check the main SKILL.md documentation
2. Review the reference guides
3. Consult OWASP guidelines
4. Hire a professional security auditor for production apps

**Remember:** These scripts are helpers, not replacements for professional security audits.

# Next.js Stack Security Audit Skill

A comprehensive security inspection tool for modern Next.js applications using Supabase, OpenRouter, Vercel AI SDK, and deploying to Vercel.

## What This Skill Does

This skill performs a systematic security audit of your entire web application stack, identifying vulnerabilities and providing actionable remediation steps. It's like having a security expert review your codebase, infrastructure, and configuration.

**Covers 12 Critical Security Domains:**
1. Next.js Authentication & Authorization
2. Data Access & Server Actions
3. Supabase Row-Level Security (RLS)
4. Supabase API Key Management
5. OpenRouter API Security
6. Vercel AI SDK - OWASP LLM Top 10
7. Environment Variables & Secrets
8. Security Headers & CSP
9. XSS, CSRF, and Injection Prevention
10. Vercel Deployment Security
11. Dependency & CVE Scanning
12. Network & Rate Limiting

## Installation

### Option 1: Manual Installation

1. Download this skill folder
2. Upload to Claude via the Skills menu in your Project
3. Claude will automatically detect when to use it

### Option 2: From Repository

```bash
# Clone or download the skill
git clone [your-repo-url]/nextjs-stack-security-audit.git

# Zip the folder
zip -r nextjs-stack-security-audit.zip nextjs-stack-security-audit/

# Upload the .zip to Claude
```

## When to Use This Skill

You should run this security audit:

- **Before production deployment** - Catch issues before users are affected
- **After dependency updates** - Ensure new packages don't introduce vulnerabilities  
- **During security reviews** - Prepare for compliance audits
- **After adding AI features** - Verify OWASP LLM compliance
- **Monthly security checks** - Maintain continuous security posture
- **After security incidents** - Identify gaps in your defenses

## Example Prompts

**Basic Audit:**
```
Run a security audit on my Next.js project at /path/to/project
```

**Focused Audit:**
```
Check my Supabase RLS policies and API key configuration
```

**AI-Specific Audit:**
```
Audit my AI features for prompt injection and tool abuse vulnerabilities
```

**CVE Check:**
```
Check if my Next.js app is vulnerable to CVE-2025-29927
```

**Full Production Readiness:**
```
Perform a complete security audit before I deploy to production
```

## What the Audit Covers

### 🔐 Authentication & Authorization
- Data Access Layer implementation (2025 best practice)
- Server Actions security
- Session management
- Multi-layer protection verification
- Middleware authentication (deprecated pattern detection)

### 🗄️ Database Security (Supabase)
- Row-Level Security (RLS) enabled on all tables
- RLS policy correctness and coverage
- Service role key exposure
- API key management (old vs new model)
- Data exposure through client components

### 🤖 AI Security (Vercel AI SDK)
- OWASP LLM Top 10 compliance
- Prompt injection prevention
- Tool abuse protection
- Input/output validation
- Rate limiting and cost controls
- `eslint-plugin-vercel-ai-security` integration

### 🔑 Secrets Management
- Environment variable configuration
- Git security (no committed secrets)
- Vercel dashboard configuration
- Sensitive environment variables feature
- Proper naming conventions

### 🛡️ Application Security
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- XSS prevention
- CSRF protection
- SQL injection prevention
- HTTPS enforcement

### 🚀 Deployment Security (Vercel)
- Deployment protection settings
- Firewall configuration
- SSL/TLS certificates
- Preview deployment security
- Build log security

### 📦 Dependencies
- Outdated packages
- Known CVE vulnerabilities
- Lock file integrity
- Supply chain security
- Automated scanning setup

### 🌐 Network Security
- API route rate limiting
- Authentication endpoint protection
- AI endpoint rate limiting
- Vercel WAF configuration

## What You'll Get

After the audit, Claude provides:

### 1. Executive Summary
- Total issues found by severity
- Overall security posture rating (1-10)
- Top 3 most urgent fixes
- Quick assessment of production readiness

### 2. Detailed Findings Report
Each finding includes:
- Severity level (🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM, 🟢 LOW)
- File location and line numbers
- Clear vulnerability description
- Potential impact if exploited
- Vulnerable code example
- Secure code example (remediation)
- References to CVEs, OWASP, or documentation

### 3. Prioritized Action Plan
Organized by urgency:
- **Immediate** - Deploy blockers, fix now
- **Urgent** - Fix within 1 week
- **Important** - Fix within 1 month
- **Recommended** - Enhance when possible

### 4. Compliance Checklist
- OWASP Top 10 compliance status
- OWASP LLM Top 10 compliance (for AI features)
- Next.js 2025 security best practices
- Supabase security requirements
- CVE remediation status

## Security Best Practices (2025)

This skill incorporates the latest security guidance:

### Critical Updates from 2025
- **Middleware is NO LONGER recommended for authentication** - Use Data Access Layer instead
- **New Supabase key model** - Transition from anon/service_role to publishable/secret keys
- **AI agent security** - OWASP Agentic AI categories now critical
- **Server Actions require CSRF protection** - Origin/Host header verification

### Recent CVEs Addressed
- CVE-2025-29927 (Next.js middleware bypass)
- CVE-2025-30218 (Next.js edge runtime)
- CVE-2024-51479 (Next.js middleware)
- CVE-2024-34351 (Next.js SSRF)
- React Server Components auth bypass (Dec 2025)

## Continuous Security

This skill helps you maintain ongoing security:

### Monthly Routine
1. Run complete audit
2. Review and prioritize findings
3. Create GitHub issues for remediation
4. Track progress in your project management tool
5. Re-audit after fixes

### Best Practices
- Update dependencies weekly
- Rotate API keys quarterly
- Review audit logs monthly
- Test incident response procedures
- Train team on security findings

## Common Issues Found

Based on real-world audits, common findings include:

**🔴 CRITICAL**
- Service role key in client-side code
- No RLS policies on tables
- Secrets committed to Git
- Unvalidated user input in AI prompts
- Missing authentication checks in Server Actions

**🟠 HIGH**
- No Data Access Layer implementation
- Overly permissive RLS policies
- Missing WITH CHECK clauses
- No rate limiting on AI endpoints
- Outdated Next.js version with known CVEs

**🟡 MEDIUM**
- Missing security headers
- No Content Security Policy
- Excessive logging of sensitive data
- Environment variables in build logs

## Requirements

Your project should use:
- **Next.js 14+** (App Router recommended)
- **Supabase** (for database and auth)
- **OpenRouter** (for LLM access)
- **Vercel AI SDK** (for AI features)
- **Vercel** (for deployment)

The skill adapts to your specific setup and only audits components you're using.

## Limitations

This skill:
- Cannot access your Vercel dashboard directly (you'll need to verify some settings manually)
- Cannot run automated penetration tests
- Cannot access your Supabase database directly (you'll need to run SQL queries)
- Cannot fix issues automatically (provides remediation guidance)
- Focuses on your specific stack (may miss generic security issues)

For comprehensive security, combine this audit with:
- Professional penetration testing
- Security code reviews by experts
- Automated vulnerability scanning (Snyk, Dependabot)
- Regular security training for your team

## Support & Updates

This skill is maintained with the latest security best practices. It includes:
- Monthly updates for new CVEs
- Quarterly updates for framework changes
- Integration with latest OWASP guidelines
- Community-contributed improvements

## Contributing

Found a security pattern we should check for? Want to improve remediation guidance? Contributions welcome!

## License

Apache-2.0

## Disclaimer

This skill provides security guidance based on industry best practices as of 2025. It is not a substitute for professional security audits or penetration testing. Always consult with security experts for production applications handling sensitive data.

---

**Ready to secure your application?** Just say:

> "Run a security audit on my Next.js project"

Claude will guide you through the process!

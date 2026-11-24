# Security

## Reporting a problem

Please report security problems privately, not in a public issue:

- GitHub: **Security → Report a vulnerability** on this repository (private advisory), or
- Email: cuely-support@googlegroups.com with "security" in the subject.

Include what you found, how to reproduce it, and what it lets someone do. You'll get a reply within 3 business days, and a fix or a plan within 14 days for anything serious. Credit is given in the fix's notes unless you'd rather stay anonymous.

## In scope

- The hosted service at `cuely.dev` and `app.cuely.dev`, including the MCP endpoint `/api/mcp`
- Sign-in, API keys, rate limits and the Stripe webhook
- Anything that would let Cuely store or expose more than [what Cuely receives](https://cuely.dev/trust) says
- The code in this repository

## Out of scope

- Reports from automated scanners with no working proof
- Denial of service by volume
- Wrong prices or vendor facts: those are catalog corrections, so open a normal issue

Please don't access other people's accounts or data, and stop once you've shown the problem.

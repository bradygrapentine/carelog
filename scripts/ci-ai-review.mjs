#!/usr/bin/env node
/**
 * CI AI security review — called by GitHub Actions on pull requests.
 * Reads a git diff from stdin, calls the Anthropic API, writes markdown to stdout.
 *
 * Usage:
 *   git diff origin/main...HEAD | node scripts/ci-ai-review.mjs
 *
 * Requires: ANTHROPIC_API_KEY env var
 */

const PROMPT = `You are a security reviewer for Carelog — a HIPAA-adjacent family caregiving app that stores PHI.

Review the following PR diff for these specific issues (ignore everything else):

1. **PHI leakage** — PII (names, emails, health data) sent to Sentry, PostHog, logs, or client responses
2. **RLS bypass** — \`supabaseAdmin\` used outside \`server/\` or \`app/api/\` directories
3. **Auth pattern violations** — client-side auth checks on protected routes instead of server-side \`getUser()\`
4. **Stripe security** — webhook handler missing signature verification, or customer ID not cross-checked against org
5. **Injection vectors** — SQL built from user input, unescaped HTML in dangerouslySetInnerHTML

Format your response as:

**Status:** PASSED or NEEDS REVIEW

If NEEDS REVIEW, list findings as:
- \`path/to/file.ts:LINE\` — [severity: HIGH/MED/LOW] description

Keep it under 300 words. Skip style, performance, and logic issues — security only.`;

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  // Read diff from stdin
  const diff = await new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });

  if (!diff.trim()) {
    console.log('**Status:** PASSED\n\nNo diff to review.');
    return;
  }

  // Truncate to ~25k chars to stay within token limits
  const truncated = diff.length > 25000
    ? diff.slice(0, 25000) + '\n\n[diff truncated — showing first 25k chars]'
    : diff;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `${PROMPT}\n\n\`\`\`diff\n${truncated}\n\`\`\``,
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`Anthropic API error ${response.status}: ${err}`);
    process.exit(1);
  }

  const data = await response.json();
  const review = data.content?.find(b => b.type === 'text')?.text;

  if (!review) {
    console.error('No text content in response:', JSON.stringify(data));
    process.exit(1);
  }

  console.log(review);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

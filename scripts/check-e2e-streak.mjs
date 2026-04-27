#!/usr/bin/env node
/**
 * TD-75 — Weekly E2E green-streak gate
 *
 * Queries the GitHub Actions API for the last 5 nightly E2E workflow runs,
 * counts consecutive failures at the head, and exits 1 if > 3.
 *
 * Usage:
 *   node scripts/check-e2e-streak.mjs
 *
 * Required env:
 *   GITHUB_TOKEN  — Personal access token or GITHUB_TOKEN from Actions
 *   GITHUB_REPOSITORY — owner/repo (e.g. "bradygrapentine/carelog")
 *                       Automatically set in GH Actions runners.
 */

const WORKFLOW_FILE = 'e2e-nightly.yml'
const RUNS_TO_CHECK = 5
const MAX_CONSECUTIVE_FAILURES = 3

const token = process.env.GITHUB_TOKEN
const repository = process.env.GITHUB_REPOSITORY

if (!token) {
  console.error('ERROR: GITHUB_TOKEN env var is required')
  process.exit(1)
}

if (!repository) {
  console.error('ERROR: GITHUB_REPOSITORY env var is required (format: owner/repo)')
  process.exit(1)
}

const [owner, repo] = repository.split('/')

async function fetchWorkflowRuns() {
  const url =
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${WORKFLOW_FILE}/runs` +
    `?branch=main&per_page=${RUNS_TO_CHECK}&status=completed`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    if (res.status === 404) {
      console.warn(`WARN: Workflow file '${WORKFLOW_FILE}' not found in ${repository}.`)
      console.warn('      No E2E nightly runs to check — skipping streak gate.')
      // Exit 0: missing workflow is not a streak failure; the workflow just hasn't been created yet.
      process.exit(0)
    }
    const body = await res.text()
    throw new Error(`GitHub API error ${res.status}: ${body}`)
  }

  const data = await res.json()
  return data.workflow_runs ?? []
}

async function main() {
  console.log(`Checking last ${RUNS_TO_CHECK} nightly E2E runs for ${repository}…`)

  let runs
  try {
    runs = await fetchWorkflowRuns()
  } catch (err) {
    console.error('ERROR fetching workflow runs:', err.message)
    process.exit(1)
  }

  if (runs.length === 0) {
    console.log('No completed E2E workflow runs found — skipping streak gate.')
    process.exit(0)
  }

  // Runs come back newest-first. Count consecutive failures at the head.
  let consecutiveFailures = 0
  for (const run of runs) {
    const passed = run.conclusion === 'success'
    if (!passed) {
      consecutiveFailures++
    } else {
      break
    }
  }

  const summary = runs
    .map(r => `  ${r.conclusion?.padEnd(10)} ${r.html_url}`)
    .join('\n')

  console.log(`\nLast ${runs.length} completed runs (newest first):`)
  console.log(summary)
  console.log(`\nConsecutive failures at head: ${consecutiveFailures}`)

  if (consecutiveFailures > MAX_CONSECUTIVE_FAILURES) {
    console.error(
      `\nFAIL: ${consecutiveFailures} consecutive E2E failures exceed the ` +
      `threshold of ${MAX_CONSECUTIVE_FAILURES}. Investigate nightly failures before merging.`
    )
    process.exit(1)
  }

  console.log(
    `\nPASS: ${consecutiveFailures} consecutive failure(s) — within threshold of ${MAX_CONSECUTIVE_FAILURES}.`
  )
  process.exit(0)
}

main()

'use client'

import { useState } from 'react'
import { trpc } from '../../../lib/trpc'
import { eligibility, type ScreenerAnswers, type BenefitProgram } from '../../../lib/benefitsEligibility'

type Props = {
  orgId:           string
  recipientId:     string
  currentUserRole: string
}

const DEFAULT_ANSWERS: ScreenerAnswers = {
  age65plus:        false,
  veteran:          false,
  lowIncome:        false,
  medicareEnrolled: false,
  medicaidEnrolled: false,
}

export function BenefitsNavigator({ orgId, recipientId, currentUserRole }: Props) {
  // Hooks must be called unconditionally — role guard is applied after
  const [open,       setOpen]       = useState(false)
  const [answers,    setAnswers]    = useState<ScreenerAnswers>(DEFAULT_ANSWERS)
  const [results,    setResults]    = useState<BenefitProgram[] | null>(null)
  const [showForm,   setShowForm]   = useState(false)

  const utils = trpc.useUtils()

  const { data: latest } = trpc.benefits.latest.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: open && currentUserRole === 'coordinator' }
  )

  const screenMutation = trpc.benefits.screen.useMutation({
    onSuccess: () => utils.benefits.latest.invalidate(),
  })

  if (currentUserRole !== 'coordinator') return null

  function handleToggleAnswer(key: keyof ScreenerAnswers) {
    setAnswers(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleRunScreener() {
    const matched = eligibility(answers)
    setResults(matched)
    screenMutation.mutate({
      org_id:       orgId,
      recipient_id: recipientId,
      answers,
      results:      matched,
    })
  }

  const displayResults: BenefitProgram[] | null = results ?? (latest ? (latest.results as BenefitProgram[]) : null)

  const QUESTIONS: Array<{ key: keyof ScreenerAnswers; label: string }> = [
    { key: 'age65plus',        label: 'Is the care recipient 65 or older?' },
    { key: 'veteran',          label: 'Is the care recipient a U.S. veteran?' },
    { key: 'lowIncome',        label: 'Does the household have limited income?' },
    { key: 'medicareEnrolled', label: 'Is the care recipient enrolled in Medicare?' },
    { key: 'medicaidEnrolled', label: 'Is the care recipient enrolled in Medicaid?' },
  ]

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-gray-700">Benefits navigator</span>
        <svg
          className={'w-4 h-4 text-gray-400 transition-transform ' + (open ? 'rotate-180' : '')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 space-y-4">
          {!showForm && displayResults === null && (
            <div className="pt-3">
              <p className="text-sm text-gray-500 mb-3">
                Answer a few questions to find matching benefit programs for the care recipient.
              </p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="text-sm bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700 transition-colors"
              >
                Start screener
              </button>
            </div>
          )}

          {!showForm && displayResults !== null && (
            <div className="pt-3 space-y-3">
              {displayResults.length === 0 ? (
                <p className="text-sm text-gray-500">No matching programs found based on the answers provided.</p>
              ) : (
                <>
                  <p className="text-xs font-medium text-gray-500">
                    {displayResults.length} matching {displayResults.length === 1 ? 'program' : 'programs'}
                    {latest && !results ? ' (from last screener)' : ''}
                  </p>
                  <ul className="space-y-2">
                    {displayResults.map((program: BenefitProgram) => (
                      <li key={program.key} className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-sm font-medium text-gray-800">{program.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{program.description}</p>
                        <a
                          href={program.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                        >
                          Learn how to apply →
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <button
                type="button"
                onClick={() => { setShowForm(true); setResults(null); setAnswers(DEFAULT_ANSWERS) }}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Run screener again
              </button>
            </div>
          )}

          {showForm && (
            <div className="pt-3 space-y-3">
              <p className="text-xs font-medium text-gray-500">Eligibility screener</p>
              {QUESTIONS.map(q => (
                <label key={q.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers[q.key]}
                    onChange={() => handleToggleAnswer(q.key)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{q.label}</span>
                </label>
              ))}
              <button
                type="button"
                onClick={() => { handleRunScreener(); setShowForm(false) }}
                disabled={screenMutation.isPending}
                className="w-full text-sm bg-gray-900 text-white rounded-lg py-1.5 hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {screenMutation.isPending ? 'Saving...' : 'Find matching programs'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

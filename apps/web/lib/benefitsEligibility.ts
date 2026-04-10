export type ScreenerAnswers = {
  age65plus:        boolean
  veteran:          boolean
  lowIncome:        boolean
  medicareEnrolled: boolean
  medicaidEnrolled: boolean
}

export type BenefitProgram = {
  key:         string
  name:        string
  description: string
  applyUrl:    string
}

const PROGRAMS: Array<{ key: string; name: string; description: string; applyUrl: string; matches: (a: ScreenerAnswers) => boolean }> = [
  {
    key:         'medicare_part_d_extra_help',
    name:        'Medicare Part D Extra Help',
    description: 'Helps pay for prescription drug costs for people with limited income who are on Medicare.',
    applyUrl:    'https://www.ssa.gov/medicare/part-d',
    matches:     (a) => a.age65plus && a.lowIncome && a.medicareEnrolled,
  },
  {
    key:         'medicaid_hcbs_waiver',
    name:        'Medicaid Home & Community Based Services (HCBS) Waiver',
    description: 'Provides in-home care services for eligible low-income seniors to help them remain at home.',
    applyUrl:    'https://www.medicaid.gov/medicaid/hcbs/index.html',
    matches:     (a) => a.age65plus && a.lowIncome,
  },
  {
    key:         'va_aid_attendance',
    name:        'VA Aid & Attendance Benefit',
    description: 'Monthly pension benefit for eligible veterans who need help with daily activities.',
    applyUrl:    'https://www.va.gov/pension/aid-attendance-housebound/',
    matches:     (a) => a.veteran && a.age65plus,
  },
  {
    key:         'pace_program',
    name:        'PACE Program (Program of All-inclusive Care for the Elderly)',
    description: 'Coordinates all medical and social services for Medicaid-eligible seniors who want to stay in their community.',
    applyUrl:    'https://www.medicaid.gov/medicaid/ltss/pace/index.html',
    matches:     (a) => a.age65plus && a.medicaidEnrolled,
  },
  {
    key:         'ship_counseling',
    name:        'State Health Insurance Assistance Program (SHIP)',
    description: 'Free, unbiased Medicare counseling from trained counselors who help seniors understand their options.',
    applyUrl:    'https://www.shiphelp.org',
    matches:     (a) => a.age65plus,
  },
]

export function eligibility(answers: ScreenerAnswers): BenefitProgram[] {
  return PROGRAMS
    .filter(p => p.matches(answers))
    .map(({ key, name, description, applyUrl }) => ({ key, name, description, applyUrl }))
}

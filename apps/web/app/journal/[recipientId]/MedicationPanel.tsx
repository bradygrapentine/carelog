'use client'

import { useState } from 'react'
import { trpc } from '../../../lib/trpc'

interface Props {
  orgId:           string
  recipientId:     string
  currentUserRole: string
}

export function MedicationPanel({ orgId, recipientId, currentUserRole }: Props) {
  const [expanded,     setExpanded]     = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [drugName,     setDrugName]     = useState('')
  const [dosage,       setDosage]       = useState('')
  const [instructions, setInstructions] = useState('')
  const [pharmacy,     setPharmacy]     = useState('')
  const [supply,       setSupply]       = useState('')
  const [error,        setError]        = useState<string | null>(null)

  const isCoordinator = currentUserRole === 'coordinator'
  const utils = trpc.useUtils()

  const { data, isLoading } = trpc.medications.list.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: expanded }
  )

  const createMutation = trpc.medications.create.useMutation({
    onSuccess: () => {
      utils.medications.list.invalidate()
      setShowForm(false)
      setDrugName('')
      setDosage('')
      setInstructions('')
      setPharmacy('')
      setSupply('')
      setError(null)
    },
    onError: () => setError('Something went wrong. Please try again.'),
  })

  const deleteMutation = trpc.medications.delete.useMutation({
    onSuccess: () => utils.medications.list.invalidate(),
  })

  const medications = data ?? []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const dn   = drugName.trim()
    const dos  = dosage.trim()
    const inst = instructions.trim() || undefined
    const ph   = pharmacy.trim() || undefined
    const sup  = supply ? parseInt(supply, 10) : undefined

    setError(null)
    createMutation.mutate({
      org_id:                orgId,
      recipient_id:          recipientId,
      drug_name:             dn,
      dosage:                dos,
      instructions:          inst,
      pharmacy:              ph,
      supply_days_remaining: sup,
    })
  }

  if (!expanded) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors w-full text-left"
        >
          Medications
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50">
        <p className="text-sm font-medium text-gray-700">Medications</p>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Collapse
        </button>
      </div>

      <div className="px-4 py-3">
        {isLoading && <p className="text-sm text-gray-400">Loading...</p>}

        {!isLoading && medications.length === 0 && (
          <p className="text-sm text-gray-400 mb-3">No medications added yet.</p>
        )}

        {medications.length > 0 && (
          <div className="space-y-2 mb-4">
            {medications.map((med: Record<string, unknown>) => {
              const medId   = med.id as string
              const name    = med.drug_name as string
              const dos     = med.dosage as string
              const instStr = med.instructions as string | null
              const pharmStr = med.pharmacy as string | null
              const supplyDays = med.supply_days_remaining as number | null
              const isLow = typeof supplyDays === 'number' && supplyDays <= 7

              return (
                <div key={medId} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{name}</span>
                      <span className="text-xs text-gray-500">{dos}</span>
                      {isLow && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Low supply</span>
                      )}
                    </div>
                    {instStr && <p className="text-xs text-gray-400 mt-0.5">{instStr}</p>}
                    {pharmStr && <p className="text-xs text-gray-400">{pharmStr}</p>}
                    {typeof supplyDays === 'number' && (
                      <p className="text-xs text-gray-400">{supplyDays} days remaining</p>
                    )}
                  </div>
                  {isCoordinator && (
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate({ id: medId, org_id: orgId })}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-red-400 hover:text-red-600 ml-3 shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {isCoordinator && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            + Add medication
          </button>
        )}

        {isCoordinator && showForm && (
          <form onSubmit={handleSubmit} className="mt-2 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="med-drug" className="block text-xs text-gray-500 mb-1">Drug name *</label>
                <input
                  id="med-drug"
                  type="text"
                  value={drugName}
                  onChange={e => setDrugName(e.target.value)}
                  required
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                  placeholder="e.g. Lisinopril"
                />
              </div>
              <div>
                <label htmlFor="med-dosage" className="block text-xs text-gray-500 mb-1">Dosage *</label>
                <input
                  id="med-dosage"
                  type="text"
                  value={dosage}
                  onChange={e => setDosage(e.target.value)}
                  required
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                  placeholder="e.g. 10mg once daily"
                />
              </div>
            </div>

            <div>
              <label htmlFor="med-instructions" className="block text-xs text-gray-500 mb-1">Instructions</label>
              <input
                id="med-instructions"
                type="text"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                placeholder="Take with food"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="med-pharmacy" className="block text-xs text-gray-500 mb-1">Pharmacy</label>
                <input
                  id="med-pharmacy"
                  type="text"
                  value={pharmacy}
                  onChange={e => setPharmacy(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                  placeholder="CVS on Main St"
                />
              </div>
              <div>
                <label htmlFor="med-supply" className="block text-xs text-gray-500 mb-1">Days remaining</label>
                <input
                  id="med-supply"
                  type="number"
                  min="0"
                  value={supply}
                  onChange={e => setSupply(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                  placeholder="30"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null) }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!drugName || !dosage || createMutation.isPending}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createMutation.isPending ? 'Adding...' : 'Add medication'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'

interface DriveFile {
  id: string
  name: string
}

type Step = 1 | 2 | 3

interface FormData {
  templateId: string
  templateName: string
  leagueName: string
  numTeams: 4 | 6
  teams: string[]
  avoidFirstRound: string
}

const INITIAL_FORM: FormData = {
  templateId: '',
  templateName: '',
  leagueName: '',
  numTeams: 6,
  teams: ['', '', '', '', '', ''],
  avoidFirstRound: '',
}

export default function CreateLeaguePage() {
  const [step, setStep] = useState<Step>(1)
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM)
  const [templates, setTemplates] = useState<DriveFile[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState('')

  useEffect(() => {
    setLoadingTemplates(true)
    fetch('/api/drive-folder')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load templates (${res.status})`)
        return res.json()
      })
      .then((data: DriveFile[]) => {
        setTemplates(data)
        if (data.length > 0) {
          setFormData((f) => ({
            ...f,
            templateId: data[0].id,
            templateName: data[0].name,
          }))
        }
      })
      .catch((err) => setTemplatesError(err.message))
      .finally(() => setLoadingTemplates(false))
  }, [])

  function handleNumTeamsChange(numTeams: 4 | 6) {
    setFormData((f) => ({
      ...f,
      numTeams,
      teams: Array(numTeams).fill(''),
    }))
  }

  function updateTeam(index: number, value: string) {
    const newTeams = [...formData.teams]
    newTeams[index] = value
    setFormData((f) => ({ ...f, teams: newTeams }))
  }

  function validateStep1(): string | null {
    if (!formData.templateId) return 'Please select a league template'
    if (!formData.leagueName.trim()) return 'Please enter a league name'
    return null
  }

  function validateStep2(): string | null {
    const filled = formData.teams.filter((t) => t.trim() !== '')
    if (filled.length !== formData.numTeams)
      return `Please enter all ${formData.numTeams} team names`
    const unique = new Set(formData.teams.map((t) => t.trim().toLowerCase()))
    if (unique.size !== formData.numTeams) return 'Team names must be unique'
    return null
  }

  function goToStep2() {
    const err = validateStep1()
    if (err) { setError(err); return }
    setError(null)
    setStep(2)
  }

  function goToStep3() {
    const err = validateStep2()
    if (err) { setError(err); return }
    setError(null)
    setFormData((f) => ({ ...f, avoidFirstRound: '' }))
    setStep(3)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDownloadUrl(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/create-league', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueName: formData.leagueName.trim(),
          numTeams: formData.numTeams,
          teams: formData.teams.map((t) => t.trim()),
          numWeeks: 6,
          avoidFirstRound: formData.avoidFirstRound || undefined,
          templateId: formData.templateId || undefined,
          templateName: formData.templateName || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create league')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      setDownloadUrl(url)
      setDownloadName(`${formData.leagueName.replace(/\s+/g, '_')}.xlsx`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filledTeams = formData.teams.filter((t) => t.trim() !== '')

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-2">Create New League</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs ${
                step === s
                  ? 'bg-blue-600 text-white'
                  : step > s
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step > s ? '✓' : s}
            </div>
            <span className={step === s ? 'font-semibold text-gray-900' : 'text-gray-500'}>
              {s === 1 ? 'Template & Name' : s === 2 ? 'Team Names' : 'Setup Options'}
            </span>
            {s < 3 && <span className="text-gray-300 mx-1">›</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Template & League Name */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              League Template *
            </label>
            {loadingTemplates ? (
              <p className="text-gray-500">Loading templates…</p>
            ) : templatesError ? (
              <p className="text-red-600">{templatesError}</p>
            ) : templates.length === 0 ? (
              <p className="text-gray-500">No templates found in Drive folder.</p>
            ) : (
              <select
                value={formData.templateId}
                onChange={(e) => {
                  const t = templates.find((t) => t.id === e.target.value)
                  setFormData((f) => ({
                    ...f,
                    templateId: e.target.value,
                    templateName: t?.name ?? '',
                  }))
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Templates come from the shared Google Drive folder.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Teams *
            </label>
            <div className="flex gap-6">
              {([4, 6] as const).map((n) => (
                <label key={n} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="numTeams"
                    value={n}
                    checked={formData.numTeams === n}
                    onChange={() => handleNumTeamsChange(n)}
                    className="mr-2"
                  />
                  <span>{n} Teams</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="leagueName" className="block text-sm font-medium text-gray-700 mb-2">
              League Name *
            </label>
            <input
              id="leagueName"
              type="text"
              value={formData.leagueName}
              onChange={(e) => setFormData((f) => ({ ...f, leagueName: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Spring 2027 BYOT League"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={goToStep2}
            disabled={loadingTemplates}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Next: Enter Team Names →
          </button>
        </div>
      )}

      {/* Step 2: Team Names */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Enter {formData.numTeams} Team Names
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Template: <strong>{formData.templateName}</strong> &nbsp;·&nbsp; League:{' '}
              <strong>{formData.leagueName}</strong>
            </p>
            <div className="space-y-3">
              {formData.teams.map((team, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-16">Team {index + 1}</span>
                  <input
                    type="text"
                    value={team}
                    onChange={(e) => updateTeam(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder={`Team ${index + 1} name`}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setError(null); setStep(1) }}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={goToStep3}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Next: Setup Options →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Setup Options + Submit */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Setup Options</h2>
            <p className="text-sm text-gray-500 mb-4">
              League: <strong>{formData.leagueName}</strong> &nbsp;·&nbsp;{' '}
              {formData.numTeams} teams
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Avoid in first round (optional)
              </label>
              <select
                value={formData.avoidFirstRound}
                onChange={(e) => setFormData((f) => ({ ...f, avoidFirstRound: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— No preference —</option>
                {filledTeams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                This team will not be scheduled to play in game 1 of Week 1, useful if they need
                setup time at the start of the season.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-700">
            <p className="font-semibold mb-2">Schedule summary:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{formData.numTeams} teams, 6 weeks</li>
              <li>{formData.numTeams === 4 ? '12' : '30'} games per week</li>
              <li>
                Each team plays{' '}
                {formData.numTeams === 4 ? '6' : '10'} games per week (every opponent twice)
              </li>
              <li>
                Each team refs {formData.numTeams === 4 ? '3' : '5'} games per week
              </li>
              {formData.avoidFirstRound && (
                <li>
                  <strong>{formData.avoidFirstRound}</strong> will not appear in game 1 of Week 1
                </li>
              )}
            </ul>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {downloadUrl && (
            <div className="p-4 bg-green-50 border border-green-300 rounded-md">
              <p className="text-green-800 font-medium mb-3">League created successfully!</p>
              <a
                href={downloadUrl}
                download={downloadName}
                className="inline-block px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Download {downloadName}
              </a>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setError(null); setDownloadUrl(null); setStep(2) }}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Generating…' : 'Generate Schedule'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

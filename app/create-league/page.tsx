'use client'

import { useState } from 'react'

interface LeagueFormData {
  leagueName: string
  numTeams: 4 | 6
  teams: string[]
  numWeeks: number
}

export default function CreateLeaguePage() {
  const [formData, setFormData] = useState<LeagueFormData>({
    leagueName: '',
    numTeams: 6,
    teams: ['', '', '', '', '', ''], // Start with 6 teams
    numWeeks: 6
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const handleNumTeamsChange = (numTeams: 4 | 6) => {
    const newTeams = numTeams === 4 
      ? ['', '', '', ''] 
      : ['', '', '', '', '', '']
    setFormData({
      ...formData,
      numTeams,
      teams: newTeams
    })
  }

  const updateTeam = (index: number, value: string) => {
    const newTeams = [...formData.teams]
    newTeams[index] = value
    setFormData({
      ...formData,
      teams: newTeams
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setDownloadUrl(null)

    // Validation
    const validTeams = formData.teams.filter(t => t.trim() !== '')
    if (validTeams.length !== formData.numTeams) {
      setError(`Please enter exactly ${formData.numTeams} teams`)
      return
    }
    
    if (formData.numWeeks !== 6) {
      setError('Number of weeks must be 6')
      return
    }

    if (!formData.leagueName.trim()) {
      setError('Please enter a league name')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/create-league', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leagueName: formData.leagueName,
          numTeams: formData.numTeams,
          teams: validTeams,
          numWeeks: formData.numWeeks
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create league')
      }

      // Get the file as a blob
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      setDownloadUrl(url)
      setSuccess('League created successfully! Click the download button to save the file.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Create New League</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* League Name */}
        <div>
          <label htmlFor="leagueName" className="block text-sm font-medium text-gray-700 mb-2">
            League Name *
          </label>
          <input
            type="text"
            id="leagueName"
            value={formData.leagueName}
            onChange={(e) => setFormData({ ...formData, leagueName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., 2027 Spring League"
            required
          />
        </div>

        {/* Number of Teams */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of Teams *
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="numTeams"
                value="4"
                checked={formData.numTeams === 4}
                onChange={() => handleNumTeamsChange(4)}
                className="mr-2"
              />
              4 Teams (She/They League format)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="numTeams"
                value="6"
                checked={formData.numTeams === 6}
                onChange={() => handleNumTeamsChange(6)}
                className="mr-2"
              />
              6 Teams
            </label>
          </div>
        </div>

        {/* Teams */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Teams * (exactly {formData.numTeams} required)
          </label>
          <div className="space-y-2">
            {formData.teams.map((team, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={team}
                  onChange={(e) => updateTeam(index, e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`Team ${index + 1}`}
                  required
                />
              </div>
            ))}
          </div>
        </div>

        {/* Number of Weeks */}
        <div>
          <label htmlFor="numWeeks" className="block text-sm font-medium text-gray-700 mb-2">
            Number of Weeks (fixed at 6)
          </label>
          <input
            type="number"
            id="numWeeks"
            value={6}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
            {success}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create League'}
          </button>

          {downloadUrl && (
            <a
              href={downloadUrl}
              download={`${formData.leagueName.replace(/\s+/g, '_')}.xlsx`}
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Download Spreadsheet
            </a>
          )}
        </div>
      </form>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h2 className="font-semibold mb-2">What gets created:</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Teams sheet with {formData.numTeams} team names</li>
          <li>Schedule Generator sheet with matchup matrix</li>
          <li>League Standings sheet with formulas</li>
          {formData.numTeams === 4 ? (
            <>
              <li>6 week sheets with 12 games each (each team plays each opponent twice per week)</li>
              <li>Auto-assigned referees (each team refs 3 games per week)</li>
              <li>Win/loss tracking formulas on each week sheet</li>
            </>
          ) : (
            <>
              <li>6 week sheets with 30 games each (each team plays each opponent twice per week)</li>
              <li>Auto-assigned referees (each team refs 5 games per week)</li>
              <li>Win/loss tracking formulas on each week sheet</li>
            </>
          )}
        </ul>
        <p className="mt-2 text-sm text-gray-600">
          <strong>Schedule structure:</strong> Each team plays {formData.numTeams === 4 ? '6' : '10'} games per week (each opponent twice), 
          totaling {formData.numTeams === 4 ? '36' : '60'} games per team over 6 weeks.
        </p>
      </div>
    </div>
  )
}



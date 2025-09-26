interface ErrorStateProps {
  error: string
}

export default function ErrorState({ error }: ErrorStateProps) {
  return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-semibold">Error: {error}</p>
      </div>
    </div>
  )
}
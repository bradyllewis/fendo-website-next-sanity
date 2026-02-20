const STATS = [
  {value: '150–160', unit: 'yards', label: 'The scoring zone — where great golf is won'},
  {value: '3', unit: 'pillars', label: 'Gear, education, and community — unified by one focus'},
  {value: '1', unit: 'mission', label: 'Elevate the short game through smarter preparation'},
]

export default function StatsStrip() {
  return (
    <section className="border-y border-border bg-surface" aria-label="Key stats">
      <div className="container">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {STATS.map(({value, unit, label}) => (
            <div key={unit} className="py-10 px-6 first:pl-0 last:pr-0">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-semibold tracking-tight text-fg">{value}</span>
                <span className="label-mono">{unit}</span>
              </div>
              <p className="text-sm text-muted leading-snug max-w-[24ch]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

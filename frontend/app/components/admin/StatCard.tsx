interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

export default function StatCard({ label, value, sub, accent = false }: StatCardProps) {
  return (
    <div className={`card-base p-5 flex flex-col gap-1 ${accent ? 'bg-fg border-fg/20' : ''}`}>
      <p className={`label-mono text-[0.6rem] ${accent ? 'text-bg/40' : 'text-muted'}`}>
        {label}
      </p>
      <p className={`text-2xl font-semibold tracking-tight ${accent ? 'text-bg' : 'text-fg'}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs font-mono ${accent ? 'text-bg/50' : 'text-muted'}`}>
          {sub}
        </p>
      )}
    </div>
  )
}

export default function AuthFormCard({
  tag,
  heading,
  description,
  children,
}: {
  tag: string
  heading: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center py-16">
      {/* Texture overlay */}
      <div
        className="absolute inset-0 bg-[url('/images/tile-grid-black.png')] opacity-[0.025]"
        style={{ backgroundSize: '24px' }}
        aria-hidden="true"
      />

      <div className="container relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="label-mono-accent">{tag}</span>
          <h1 className="display-md mt-3">{heading}</h1>
          {description && (
            <p className="text-muted mt-3 text-sm leading-relaxed">{description}</p>
          )}
        </div>

        {/* Card */}
        <div className="card-base overflow-hidden p-8">
          {children}
        </div>
      </div>
    </section>
  )
}

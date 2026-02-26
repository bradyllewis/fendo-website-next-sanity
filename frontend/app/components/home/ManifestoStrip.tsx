import Link from 'next/link'

export default function ManifestoStrip() {
  return (
    <section className="bg-fg py-20 overflow-hidden">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <p className="text-accent font-mono text-xs uppercase tracking-[0.18em]">Our Philosophy</p>
          <blockquote className="text-2xl md:text-3xl font-semibold tracking-tight text-bg leading-[1.15] max-w-2xl">
            &ldquo;Control is a skill. Preparation makes it reliable.&rdquo;
          </blockquote>
          <Link href="/collective" className="btn-accent shrink-0 self-start md:self-center">
            Join the Collective
          </Link>
        </div>
      </div>
    </section>
  )
}

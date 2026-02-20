import {IconTarget} from '@/app/components/icons'

const TESTIMONIALS = [
  {
    quote: 'The GS1 became the one tool I always have in the bag. My approach shots have never felt more reliable.',
    name: 'Marcus T.',
    detail: '8 Handicap · Dallas, TX',
  },
  {
    quote: 'The Collective is the only golf community that has actually made me better. The accountability is real.',
    name: 'Rachel K.',
    detail: 'Club Member · Phoenix, AZ',
  },
  {
    quote: 'The Playbook cut through years of bad advice. Inside 150 yards, I am a completely different player.',
    name: 'Jordan S.',
    detail: '12 Handicap · Atlanta, GA',
  },
]

export default function TestimonialsSection() {
  return (
    <section className="section-padding border-b border-border" aria-labelledby="proof-heading">
      <div className="container">

        <div className="mb-14">
          <p className="label-mono mb-4">Proof</p>
          <h2 id="proof-heading" className="display-md text-fg max-w-xl">
            Golfers Who Take the Short Game Seriously.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({quote, name, detail}) => (
            <figure
              key={name}
              className="card-base p-8 flex flex-col justify-between gap-6 cursor-default"
            >
              <div className="text-border font-serif text-5xl leading-none select-none" aria-hidden="true">
                &ldquo;
              </div>
              <blockquote className="text-fg text-base leading-relaxed flex-1">
                {quote}
              </blockquote>
              <figcaption className="border-t border-border pt-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-fg">{name}</p>
                  <p className="text-xs text-muted mt-0.5 font-mono">{detail}</p>
                </div>
                <span className="text-accent">
                  <IconTarget />
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

import Link from 'next/link'

import {IconCheck} from '@/app/components/icons'

const FEATURES = [
  'Dual-bristle precision design',
  'Integrated mist spray system',
  'Ergonomic weighted handle',
  'Customizable sleeve options',
  'Built for tournament & corporate gifting',
]

export default function GearCallout() {
  return (
    <section className="section-padding border-b border-border" aria-labelledby="gear-heading">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* Content */}
          <div>
            <p className="label-mono mb-5">Performance Tools</p>
            <h2 id="gear-heading" className="display-md text-fg mb-6">
              <span className='bg-accent/80 pl-2 pr-3 text-bg rounded-sm'>The Right Tool</span> Makes What Matters Easier.
            </h2>
            <p className="text-muted leading-relaxed mb-10 max-w-[44ch]">
              The Fendo GS1 Groove System is built for one job: keeping your clubface in peak condition. Precision cleaning, every round. Because performance starts before the swing.
            </p>

            <ul className="space-y-4 mb-10">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <span className="text-accent shrink-0">
                    <IconCheck className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-fg font-medium">{feature}</span>
                </li>
              ))}
            </ul>

            <Link href="https://fendogolf.com/products/fendo-gs1-groove-system?variant=50300537667831" target='_blank' className="btn-outline">
              Shop the GS1
            </Link>
          </div>

          {/* Visual: product card */}
                      <Link href="https://fendogolf.com/products/fendo-gs1-groove-system?variant=50300537667831" target='_blank'>

          <div className="relative bg-fg rounded-2xl overflow-hidden min-h-80 lg:min-h-[480px] flex flex-col items-end justify-end p-5">
            <div
              className="absolute inset-2 bg-cover bg-center"
              style={{backgroundImage: 'url(/images/gs1-golf-product1.webp)'}}
              aria-hidden="true"
            />
            <div className="relative z-10 text-center bg-bg/80 backdrop-blur-sm rounded-xl px-1 py-4">
              <p className="label-mono text-fg mb-2 font-bold">Flagship Product</p>
              <h3 className="text-4xl md:text-5xl font-semibold tracking-tight text-accent mb-1">GS1</h3>
              <p className="text-accent text-sm font-mono">Groove System</p>
              <div className="mt-1 flex items-center justify-center gap-3 text-bg/20">
                <span className="inline-block w-6 h-px bg-current" />
                <span className="text-xs font-mono text-fg">Precision · Habit · Performance</span>
                <span className="inline-block w-6 h-px bg-current" />
              </div>
            </div>
          </div>
          </Link>
        </div>
      </div>
    </section>
  )
}

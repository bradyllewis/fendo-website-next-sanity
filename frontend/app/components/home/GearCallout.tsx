import Link from 'next/link'

import {sanityFetch} from '@/sanity/lib/live'
import {featuredGearQuery} from '@/sanity/lib/queries'
import {IconCheck} from '@/app/components/icons'
import SanityImage from '@/app/components/SanityImage'
import type {SanityGear} from '@/app/gear/types'

export default async function GearCallout() {
  const {data: gear} = await sanityFetch({query: featuredGearQuery})

  if (!gear) return null

  const product = gear as SanityGear

  return (
    <section className="section-padding border-b border-border" aria-labelledby="gear-heading">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* Content */}
          <div>
            {product.category && (
              <p className="label-mono mb-5">{product.category}</p>
            )}
            <h2 id="gear-heading" className="display-md text-fg mb-6">
              <span className="bg-accent/80 pl-2 pr-3 text-bg rounded-sm">The Right Tool</span> Makes What Matters Easier.
            </h2>
            {product.shortDescription && (
              <p className="text-muted leading-relaxed mb-10 max-w-[44ch]">
                {product.shortDescription}
              </p>
            )}

            {product.features && product.features.length > 0 && (
              <ul className="space-y-4 mb-10">
                {product.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="text-accent shrink-0">
                      <IconCheck className="w-4 h-4" />
                    </span>
                    <span className="text-sm text-fg font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
            )}

            {product.shopUrl && (
              <Link href={product.shopUrl} target="_blank" rel="noopener noreferrer" className="btn-outline">
                Shop the {product.tagline ?? product.name}
              </Link>
            )}
          </div>

          {/* Visual: product card */}
          {product.shopUrl && (
            <Link href={product.shopUrl} target="_blank" rel="noopener noreferrer">
              <div className="relative bg-fg rounded-2xl overflow-hidden min-h-80 lg:min-h-[480px] flex flex-col items-end justify-end p-5">
                {product.image?.asset ? (
                  <div className="absolute inset-2 overflow-hidden">
                    <SanityImage
                      id={product.image.asset._ref}
                      alt={product.image.alt ?? product.name ?? 'Product image'}
                      hotspot={product.image.hotspot ?? undefined}
                      crop={product.image.crop ?? undefined}
                      mode="cover"
                      width={600}
                      height={600}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="absolute inset-2 bg-cover bg-center"
                    style={{backgroundImage: 'url(/images/gs1-golf-product1.webp)'}}
                    aria-hidden="true"
                  />
                )}
                <div className="relative z-10 text-center bg-bg/80 backdrop-blur-sm rounded-xl px-1 py-4">
                  {product.badge && (
                    <p className="label-mono text-fg mb-2 font-bold">{product.badge}</p>
                  )}
                  {product.tagline ? (
                    <>
                      <h3 className="text-4xl md:text-5xl font-semibold tracking-tight text-accent mb-1">
                        {product.name}
                      </h3>
                      <p className="text-accent text-sm font-mono">{product.tagline}</p>
                    </>
                  ) : (
                    <h3 className="text-4xl md:text-5xl font-semibold tracking-tight text-accent mb-1">
                      {product.name}
                    </h3>
                  )}
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

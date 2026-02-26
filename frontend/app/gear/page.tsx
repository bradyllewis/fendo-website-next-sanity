import type {Metadata} from 'next'
import Link from 'next/link'

import {sanityFetch} from '@/sanity/lib/live'
import {allGearQuery} from '@/sanity/lib/queries'
import {IconCheck, IconArrow} from '@/app/components/icons'
import SanityImage from '@/app/components/SanityImage'
import type {SanityGear} from './types'

export const metadata: Metadata = {
  title: 'Gear',
  description:
    'Performance tools built for golfers who take the short game seriously. Shop the Fendo GS1 Groove System and future gear from the Fendo collection.',
}

// ── Gear Card ─────────────────────────────────────────────────────────────────

function GearCard({item}: {item: SanityGear}) {
  return (
    <article className="card-base overflow-hidden flex flex-col">
      {/* Product image */}
      <div className="relative bg-fg aspect-[4/3] overflow-hidden">
        {item.image?.asset ? (
          <div className="absolute inset-0">
            <SanityImage
              id={item.image.asset._ref}
              alt={item.image.alt ?? item.name ?? 'Product image'}
              hotspot={item.image.hotspot ?? undefined}
              crop={item.image.crop ?? undefined}
              mode="cover"
              width={600}
              height={450}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-70"
            style={{backgroundImage: 'url(/images/gs1-golf-product1.webp)'}}
            aria-hidden="true"
          />
        )}

        {/* Badge overlay */}
        {item.badge && (
          <div className="absolute top-4 left-4">
            <span className="label-mono bg-bg text-fg px-3 py-1.5 rounded-full text-xs">
              {item.badge}
            </span>
          </div>
        )}

        {/* Price overlay */}
        {item.price != null && (
          <div className="absolute top-4 right-4">
            <span className="font-mono text-sm font-semibold bg-accent text-bg px-3 py-1.5 rounded-full">
              ${item.price}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-7 flex flex-col flex-1">
        {item.category && (
          <p className="label-mono mb-3">{item.category}</p>
        )}

        <h2 className="text-xl font-semibold tracking-tight text-fg mb-1">
          {item.name}
        </h2>

        {item.tagline && (
          <p className="text-sm font-mono text-accent mb-4">{item.tagline}</p>
        )}

        {item.shortDescription && (
          <p className="text-sm text-muted leading-relaxed mb-6 flex-1">
            {item.shortDescription}
          </p>
        )}

        {item.features && item.features.length > 0 && (
          <ul className="space-y-2.5 mb-7">
            {item.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <span className="text-accent shrink-0 mt-px">
                  <IconCheck className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs text-fg font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        )}

        {item.shopUrl && (
          <Link
            href={item.shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full justify-center mt-auto"
          >
            Shop Now
          </Link>
        )}
      </div>
    </article>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function GearPage() {
  const {data: allGear} = await sanityFetch({query: allGearQuery})
  const gear = (allGear ?? []) as SanityGear[]

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative border-b border-border overflow-hidden">
        <div
          className="absolute inset-0 bg-[url(/images/tile-grid-black.png)] opacity-[0.025]"
          style={{backgroundSize: '24px'}}
          aria-hidden="true"
        />

        <div className="container relative py-24 lg:py-32">
          <div className="max-w-2xl">
            <p
              className="label-mono mb-6"
              style={{animation: 'hero-fade-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both'}}
            >
              Performance Tools
            </p>
            <h1
              className="display-lg text-fg mb-6"
              style={{animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both'}}
            >
              Gear.
            </h1>
            <p
              className="text-lg md:text-xl text-muted leading-relaxed max-w-[44ch] mb-10"
              style={{animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.35s both'}}
            >
              Tools built for golfers who care about every detail of their game.
              Precision-engineered, tournament-tested, and designed to become part of your routine.
            </p>
            <div
              className="flex items-center gap-4 flex-wrap"
              style={{animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s both'}}
            >
              <a href="#products" className="btn-primary">
                Browse Gear
              </a>
              <Link href="/collective" className="btn-ghost group">
                Join the Collective
                <span className="group-hover:translate-x-1 transition-transform duration-200">
                  <IconArrow />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Products grid ──────────────────────────────────────────────── */}
      <section className="section-padding" id="products" aria-labelledby="gear-grid-heading">
        <div className="container">
          <div className="mb-12">
            <p className="label-mono mb-4">The Collection</p>
            <h2 id="gear-grid-heading" className="display-md text-fg">
              Shop the Line.
            </h2>
          </div>

          {gear.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gear.map((item) => (
                <GearCard key={item._id} item={item} />
              ))}
            </div>
          ) : (
            /* Empty state — shown until gear is added in Sanity */
            <div className="text-center py-24 border border-dashed border-border rounded-2xl">
              <p className="label-mono mb-4 text-muted">Coming Soon</p>
              <p className="text-muted text-base max-w-[36ch] mx-auto leading-relaxed">
                New gear drops are on the way. Check back soon or join the Collective for early access.
              </p>
              <Link href="/collective" className="btn-accent mt-8 inline-flex">
                Get Early Access
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────────────── */}
      <section className="relative bg-fg border-t border-bg/10 section-padding" aria-label="Join the Collective">
        <div
          className="absolute inset-0 bg-[url(/images/tile-grid-white.png)] opacity-[0.03]"
          style={{backgroundSize: '24px'}}
          aria-hidden="true"
        />
        <div className="container relative text-center max-w-2xl mx-auto py-28">
          <p className="label-mono text-accent mb-6">The Collective</p>
          <h2 className="display-md text-bg mb-5">
            Better gear starts with better habits.
          </h2>
          <p className="text-bg/60 text-base md:text-lg leading-relaxed mb-10">
            Join the Fendo Collective for member-only gear drops, early access to new products,
            and a community that holds you to a higher standard.
          </p>
          <Link href="/collective" className="btn-accent">
            Get First Access
          </Link>
        </div>
      </section>
    </>
  )
}

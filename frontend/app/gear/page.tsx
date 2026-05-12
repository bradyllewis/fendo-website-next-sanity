import type {Metadata} from 'next'
import Link from 'next/link'
import Image from 'next/image'

import {sanityFetch} from '@/sanity/lib/live'
import {allGearQuery} from '@/sanity/lib/queries'
import {IconCheck, IconArrow} from '@/app/components/icons'
import SanityImage from '@/app/components/SanityImage'
import {ScrollReveal} from '@/app/components/ScrollReveal'
import type {SanityGear} from './types'
import {createClient} from '@/lib/supabase/server'
import SpinSlogan from '../components/SpinSlogan'
import {VideoPlayer} from './VideoPlayer'

const SHOP_URL = 'https://fendogolf.com/products/fendo-gs1-groove-system'

const PERFORMANCE_CHAIN = [
  {step: '01', label: 'Clean', detail: 'Dual-bristle system removes debris from every groove'},
  {step: '02', label: 'Friction', detail: 'Restored groove geometry maximizes club-to-ball friction'},
  {step: '03', label: 'Spin', detail: 'More friction generates the spin your short game demands'},
  {step: '04', label: 'Control', detail: 'Predictable spin means predictable ball flight, every time'},
]

const INCLUDED_ITEMS = [
  {num: '01', name: 'GS1 Groove Performance Tool', detail: 'The full system, ready to go'},
  {num: '02', name: 'Dual-Bristle Cartridge', detail: 'Pre-installed, replaceable'},
  {num: '03', name: 'Precision Groove Pick', detail: 'Removable for detailed cleaning'},
  {num: '04', name: 'Hydration Reservoir', detail: 'Refillable one-touch mist sprayer'},
]

const FEATURE_STRIP = [
  {
    label: 'Patented System',
    name: 'Dual-Bristle Design',
    desc: 'Two rows of precision bristles clean deeper than any single-brush tool on the market.',
  },
  {
    label: 'Modular Build',
    name: 'Replaceable Cartridges',
    desc: 'Swap cartridges when bristles wear — the tool lasts, only the cartridge changes.',
  },
  {
    label: 'One-Touch',
    name: 'Hydration Mist',
    desc: 'Built-in spray system loosens grime before the bristles do their work.',
  },
]

const FALLBACK_FEATURES = [
  'Patented dual-bristle groove system for deeper cleaning',
  'One-touch hydration mist sprayer',
  'Removable precision groove pick',
  'Replaceable bristle cartridges',
  'Custom soft-feel TPE grip core',
  'Modular design for longevity',
]

export const metadata: Metadata = {
  title: 'Gear',
  description:
    'Performance tools built for golfers who take the short game seriously. Shop the Fendo GS1 Groove System.',
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero({product}: {product: SanityGear | null}) {
  const shopUrl = product?.shopUrl ?? SHOP_URL
  const hasImage = !!product?.image?.asset

  return (
    <section className="relative bg-fg overflow-hidden border-b border-bg/10" aria-label="GS1 Hero">
      <div
        className="absolute inset-0 bg-[url(/images/tile-grid-white.png)] opacity-[0.03]"
        style={{backgroundSize: '24px'}}
        aria-hidden="true"
      />

      <div className="container relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-0 items-center min-h-[88vh] py-24 lg:py-0">

          {/* Left: Text */}
          <div className="flex flex-col justify-center lg:py-32">
            <p
              className="label-mono text-bg/40 mb-8"
              style={{animation: 'hero-fade-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both'}}
            >
              Performance Tools
            </p>

            <div style={{animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both'}}>
              <h1 className="display-xl text-bg leading-none">GS1</h1>
              <p className="font-mono text-xs tracking-[0.22em] uppercase text-bg/40 mt-3">
                Groove System
              </p>
            </div>

            <p
              className="text-bg/65 text-lg md:text-xl leading-relaxed mt-10 max-w-[38ch]"
              style={{animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.35s both'}}
            >
              The first groove-performance system built specifically for the scoring zone.
              Inside 150 yards, precision is everything.
            </p>

            <div
              className="flex items-center gap-4 flex-wrap mt-10"
              style={{animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s both'}}
            >
              <Link href={shopUrl} target="_blank" rel="noopener noreferrer" className="btn-accent">
                Shop the GS1
              </Link>
              <a href="#features" className="btn-ghost text-bg/60 hover:text-bg group">
                Learn More
                <span className="group-hover:translate-x-1 transition-transform duration-200">
                  <IconArrow />
                </span>
              </a>
            </div>

            <div
              className="flex items-center gap-6 flex-wrap mt-16 border-t border-bg/10 pt-8"
              style={{animation: 'hero-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.6s both'}}
            >
              {['Inside 150. The Go Zone.', 'Deeper Cleaning.', 'Better Control.'].map((tag) => (
                <span key={tag} className="font-mono text-[0.65rem] tracking-[0.14em] uppercase text-bg/35">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Product image */}
          <div
            className="relative flex items-center justify-center lg:h-full"
            style={{animation: 'hero-fade-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.25s both'}}
          >
            <div className="relative w-full max-w-sm mx-auto lg:max-w-none lg:absolute lg:inset-0 lg:flex lg:items-center lg:justify-center lg:px-10">
              {hasImage ? (
                <div className="relative w-full aspect-square">
                  <SanityImage
                    id={product!.image!.asset!._ref}
                    alt={product!.image!.alt ?? 'Fendo GS1 Groove System'}
                    hotspot={product!.image!.hotspot ?? undefined}
                    crop={product!.image!.crop ?? undefined}
                    mode="cover"
                    width={720}
                    height={720}
                    className="w-full h-full object-contain drop-shadow-2xl"
                  />
                </div>
              ) : (
                <div className="relative w-full aspect-square">
                  <Image
                    src="/images/gs1-golf-product1.webp"
                    alt="Fendo GS1 Groove System"
                    fill
                    className="object-contain drop-shadow-2xl"
                    priority
                  />
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Spin slogan — full width strip at bottom of hero
        <div className="py-6 border-t border-bg/10">
          <SpinSlogan size="md" textClassName="text-bg/30" autoPlay />
        </div> */}
      </div>
    </section>
  )
}

// ── Performance Chain ─────────────────────────────────────────────────────────

function PerformanceChain() {
  return (
    <section className="section-padding border-b border-border" aria-label="Performance Chain">
      <div className="container">
        <div className="max-w-2xl mb-16">
          <p className="label-mono mb-5">The System</p>
          <h2 className="display-md text-fg">
            Clean Grooves.<br />Better Control.
          </h2>
          <p className="text-muted mt-5 text-base leading-relaxed">
            The performance chain behind every shot inside 150 yards.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-0">
          {PERFORMANCE_CHAIN.map(({step, label, detail}, i) => (
            <div
              key={step}
              className="relative border border-border rounded-2xl p-8 lg:rounded-none lg:border-0 lg:border-l first:lg:border-l-0 lg:pl-10 first:lg:pl-0"
            >
              {i < PERFORMANCE_CHAIN.length - 1 && (
                <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-[7px] z-10 text-border" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 7h10M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
              <p className="label-mono text-accent mb-4">{step}</p>
              <p className="text-3xl font-semibold tracking-tight text-fg mb-4">{label}</p>
              <p className="text-sm text-muted leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Product Showcase ───────────────────────────────────────────────────────────

function ProductShowcase({product}: {product: SanityGear | null}) {
  const name = product?.name ?? 'Fendo GS1 Groove System'
  const tagline = product?.tagline ?? 'Groove System'
  const category = product?.category ?? 'Performance Tools'
  const description =
    product?.shortDescription ??
    'The first groove-performance system built for the scoring zone. Engineered from the grip up — modular, precise, and built for golfers who understand that clean grooves are non-negotiable.'
  const features = product?.features?.length ? product.features : FALLBACK_FEATURES
  const shopUrl = product?.shopUrl ?? SHOP_URL
  const price = product?.price
  const hasImage = !!product?.image?.asset

  return (
    <section className="relative bg-fg section-padding border-b border-bg/10 overflow-hidden" id="features" aria-label="Product Showcase">
      <div
        className="absolute inset-0 bg-[url(/images/tile-grid-white.png)] opacity-[0.03] pointer-events-none"
        style={{backgroundSize: '24px'}}
        aria-hidden="true"
      />
      <div className="container relative">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* Image */}
          <ScrollReveal direction="left" className="relative">
            <div className="relative bg-bg/5 rounded-2xl overflow-hidden aspect-square">
              {hasImage ? (
                <SanityImage
                  id={product!.image!.asset!._ref}
                  alt={product!.image!.alt ?? name}
                  hotspot={product!.image!.hotspot ?? undefined}
                  crop={product!.image!.crop ?? undefined}
                  mode="cover"
                  width={700}
                  height={700}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 bg-center bg-contain bg-no-repeat p-12"
                  style={{backgroundImage: 'url(/images/gs1-golf-product1.webp)'}}
                  role="img"
                  aria-label="Fendo GS1 Groove System"
                />
              )}
            </div>
          </ScrollReveal>

          {/* Content */}
          <ScrollReveal direction="right">
            <p className="label-mono text-accent mb-6">{category}</p>
            <h2 className="text-4xl font-semibold tracking-tight text-bg leading-tight mb-2">
              {name}
            </h2>
            <p className="font-mono text-xs tracking-[0.18em] uppercase text-bg/40 mb-8">
              {tagline}
            </p>
            <p className="text-bg/65 leading-relaxed mb-10 text-base">{description}</p>

            <ul className="space-y-3 mb-10">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="text-accent shrink-0 mt-0.5">
                    <IconCheck className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-bg/80 font-medium">{f}</span>
                </li>
              ))}
            </ul>

            <Link href={shopUrl} target="_blank" rel="noopener noreferrer" className="btn-accent">
              {price != null ? `Shop — $${price}` : 'Shop the GS1'}
            </Link>
          </ScrollReveal>

        </div>
      </div>
    </section>
  )
}

// ── What's Included ───────────────────────────────────────────────────────────

function IncludedBox() {
  return (
    <section className="bg-surface section-padding border-b border-border" aria-label="What's Included">
      <div className="container">
        <div className="mb-14">
          <p className="label-mono mb-5">In The Box</p>
          <h2 className="display-md text-fg">{"What's Included."}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {INCLUDED_ITEMS.map(({num, name, detail}) => (
            <div key={num} className="card-base p-8">
              <p className="label-mono text-accent mb-6">{num}</p>
              <h3 className="text-base font-semibold tracking-tight text-fg mb-2">{name}</h3>
              <p className="text-sm text-muted leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Video Section ─────────────────────────────────────────────────────────────

const DEMO_VIDEO_URL =
  'https://ezgimntosyyqevcyarfg.supabase.co/storage/v1/object/public/spin-society/app/GS1%20Golf%20Head%20Cleaner%20Tool%20Product%20Video.mp4'

function VideoSection() {
  return (
    <section
      className="relative bg-fg section-padding border-b border-bg/10 overflow-hidden"
      aria-label="Product Demo Video"
    >
      <div
        className="absolute inset-0 bg-[url(/images/tile-grid-white.png)] opacity-[0.03] pointer-events-none"
        style={{backgroundSize: '24px'}}
        aria-hidden="true"
      />
      <div className="container relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">

          {/* Vertical video */}
          <ScrollReveal direction="left" className="flex justify-center lg:justify-start">
            <div className="w-full max-w-[280px]">
              <VideoPlayer src={DEMO_VIDEO_URL} />
            </div>
          </ScrollReveal>

          {/* Copy */}
          <ScrollReveal direction="right">
            <p className="label-mono text-accent mb-6">See It In Action</p>
            <h2 className="display-md text-bg mb-6">The GS1 at work.</h2>
            <p className="text-bg/65 leading-relaxed mb-4 text-base">
              Watch what happens when engineering meets intention. The GS1 isn&apos;t a brush — it&apos;s a
              system. Dual bristles, precision hydration, and a groove pick built for shots that decide rounds.
            </p>
            <p className="text-bg/45 text-sm leading-relaxed mb-10">
              Designed for inside 150. Built for golfers who take the scoring zone seriously.
            </p>
            <Link href={SHOP_URL} target="_blank" rel="noopener noreferrer" className="btn-accent">
              Shop the GS1
            </Link>
          </ScrollReveal>

        </div>
      </div>
    </section>
  )
}

// ── Feature Strip ─────────────────────────────────────────────────────────────

function FeatureStrip() {
  return (
    <section className="border-b border-border" aria-label="Key Features">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
          {FEATURE_STRIP.map(({label, name, desc}) => (
            <div key={name} className="py-12 lg:py-16 lg:px-12 first:lg:pl-0 last:lg:pr-0">
              <p className="label-mono mb-5">{label}</p>
              <h3 className="text-xl font-semibold tracking-tight text-fg mb-4">{name}</h3>
              <p className="text-sm text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function GearPage() {
  const {data: allGear} = await sanityFetch({query: allGearQuery})
  const gear = (allGear ?? []) as SanityGear[]
  const product = gear[0] ?? null

  const supabase = await createClient()
  const {data: {user}} = await supabase.auth.getUser()

  return (
    <>
      <Hero product={product} />
      <PerformanceChain />
      <ProductShowcase product={product} />
      <IncludedBox />
      <VideoSection />
      <FeatureStrip />

      {/* ── Bottom CTA ─────────────────────────────────────────────────── */}
      <section
        className="relative bg-fg border-t border-bg/10 section-padding"
        aria-label={user ? 'Keep Exploring' : 'Join the Collective'}
      >
        <div
          className="absolute inset-0 bg-[url(/images/tile-grid-white.png)] opacity-[0.03]"
          style={{backgroundSize: '24px'}}
          aria-hidden="true"
        />
        {user ? (
          <div className="container relative text-center max-w-2xl mx-auto py-28">
            <p className="label-mono text-accent mb-6">The Collective</p>
            <h2 className="display-md text-bg mb-5">Keep exploring.</h2>
            <p className="text-bg/60 text-base md:text-lg leading-relaxed mb-10">
              Check out the Playbook for expert technique, or head to Compete to find your next event.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link href="/playbook" className="btn-accent">Browse Playbook</Link>
              <Link href="/compete" className="btn-ghost text-bg/60 hover:text-bg">View Events</Link>
            </div>
          </div>
        ) : (
          <div className="container relative text-center max-w-2xl mx-auto py-28">
            <p className="label-mono text-accent mb-6">The Collective</p>
            <h2 className="display-md text-bg mb-5">Better gear starts with better habits.</h2>
            <p className="text-bg/60 text-base md:text-lg leading-relaxed mb-10">
              Join the Fendo Collective for member-only gear drops, early access to new products,
              and a community that holds you to a higher standard.
            </p>
            <Link href="/collective" className="btn-accent">Get First Access</Link>
          </div>
        )}
      </section>
    </>
  )
}

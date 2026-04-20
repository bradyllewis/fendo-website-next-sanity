'use client'

import React, { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { IconLoader } from '@/app/components/icons'
import type { SponsorshipTier } from '../../types'

type Step = 'sponsorInfo' | 'level' | 'players' | 'payment' | 'assets' | 'review'

interface PlayerSlot {
  name: string
  email: string
}

interface FormState {
  companyName: string
  primaryContact: string
  email: string
  phone: string
  selectedTierId: string | null
  paymentMethod: 'stripe' | 'invoice' | null
  logoFile: File | null
  logoUrl: string | null
  activationNotes: string
  marketingRequests: string
  players: PlayerSlot[]
}

interface Props {
  event: {
    _id: string
    slug: string
    title: string
    startDate: string | null
  }
  tiers: SponsorshipTier[]
  userEmail: string
  initialName: string
  userId: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<Step, string> = {
  sponsorInfo: 'Sponsor Info',
  level: 'Level',
  players: 'Players',
  payment: 'Payment',
  assets: 'Assets',
  review: 'Review',
}

const INPUT =
  'w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm placeholder:text-muted-2 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors'
const LABEL = 'block text-sm font-medium text-fg mb-1.5'
const ERR = 'mt-1.5 text-xs text-danger'

// ── Helpers ────────────────────────────────────────────────────────────────────

function getActiveSteps(tier: SponsorshipTier | null): Step[] {
  const base: Step[] = ['sponsorInfo', 'level']
  if (tier && (tier.includedPlayerSpots ?? 0) > 0) base.push('players')
  base.push('payment', 'assets', 'review')
  return base
}

function validateStep(step: Step, form: FormState): Record<string, string> {
  const e: Record<string, string> = {}
  switch (step) {
    case 'sponsorInfo':
      if (!form.companyName.trim()) e.companyName = 'Company name is required.'
      if (!form.primaryContact.trim()) e.primaryContact = 'Primary contact is required.'
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        e.email = 'A valid email is required.'
      break
    case 'level':
      if (!form.selectedTierId) e.selectedTierId = 'Please select a sponsorship level.'
      break
    case 'payment':
      if (!form.paymentMethod) e.paymentMethod = 'Please select a payment method.'
      break
  }
  return e
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SponsorForm({ event, tiers, userEmail, initialName, userId }: Props) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    companyName: '',
    primaryContact: initialName,
    email: userEmail,
    phone: '',
    selectedTierId: null,
    paymentMethod: null,
    logoFile: null,
    logoUrl: null,
    activationNotes: '',
    marketingRequests: '',
    players: [],
  })

  const selectedTier = tiers.find(t => t.id === form.selectedTierId) ?? null
  const activeSteps = getActiveSteps(selectedTier)
  const currentStep = activeSteps[stepIndex]

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const clearError = (key: string) => {
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const handleTierSelect = (tierId: string) => {
    const tier = tiers.find(t => (t.id ?? t.name) === tierId)
    const spotCount = tier?.includedPlayerSpots ?? 0
    setForm(prev => ({
      ...prev,
      selectedTierId: tierId,
      players: Array.from({ length: spotCount }, () => ({ name: '', email: '' })),
    }))
    clearError('selectedTierId')
  }

  const updatePlayer = (i: number, field: keyof PlayerSlot, value: string) => {
    setForm(prev => ({
      ...prev,
      players: prev.players.map((p, idx) => idx === i ? { ...p, [field]: value } : p),
    }))
  }

  const handleLogoChange = async (file: File) => {
    setField('logoFile', file)
    setUploadingLogo(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${userId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('sponsor-assets').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('sponsor-assets').getPublicUrl(path)
      setField('logoUrl', publicUrl)
    } catch {
      setApiError('Logo upload failed. You can continue and provide it later.')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleNext = () => {
    const errs = validateStep(currentStep, form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setStepIndex(i => i + 1)
  }

  const handleBack = () => {
    setErrors({})
    setStepIndex(i => i - 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setApiError(null)
    try {
      const res = await fetch('/api/stripe/sponsor-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventSlug: event.slug,
          sponsorData: {
            companyName: form.companyName,
            primaryContact: form.primaryContact,
            email: form.email,
            phone: form.phone || undefined,
            sponsorshipLevel: selectedTier?.name ?? selectedTier?.id ?? '',
            sponsorshipLevelPrice: selectedTier?.price ?? 0,
            paymentMethod: form.paymentMethod,
            activationNotes: form.activationNotes || undefined,
            marketingRequests: form.marketingRequests || undefined,
            logoUrl: form.logoUrl || undefined,
            playerAllocation: form.players.length > 0 ? form.players : undefined,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setApiError(data.error || 'Unable to proceed. Please try again.')
        return
      }

      if (data.url) window.location.href = data.url
    } catch {
      setApiError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Step renders ───────────────────────────────────────────────────────────────

  const renderSponsorInfoStep = () => (
    <div className="space-y-4">
      <div>
        <label className={LABEL}>Company Name <span className="text-danger">*</span></label>
        <input
          className={`${INPUT} ${errors.companyName ? 'border-danger' : ''}`}
          value={form.companyName}
          onChange={e => { setField('companyName', e.target.value); clearError('companyName') }}
          placeholder="Acme Golf Co."
        />
        {errors.companyName && <p className={ERR}>{errors.companyName}</p>}
      </div>
      <div>
        <label className={LABEL}>Primary Contact <span className="text-danger">*</span></label>
        <input
          className={`${INPUT} ${errors.primaryContact ? 'border-danger' : ''}`}
          value={form.primaryContact}
          onChange={e => { setField('primaryContact', e.target.value); clearError('primaryContact') }}
          placeholder="Jordan Reed"
        />
        {errors.primaryContact && <p className={ERR}>{errors.primaryContact}</p>}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Email <span className="text-danger">*</span></label>
          <input
            className={`${INPUT} ${errors.email ? 'border-danger' : ''}`}
            type="email"
            value={form.email}
            onChange={e => { setField('email', e.target.value); clearError('email') }}
            placeholder="jordan@company.com"
          />
          {errors.email && <p className={ERR}>{errors.email}</p>}
        </div>
        <div>
          <label className={LABEL}>Phone <span className="text-muted text-xs">(optional)</span></label>
          <input
            className={INPUT}
            type="tel"
            value={form.phone}
            onChange={e => setField('phone', e.target.value)}
            placeholder="(555) 867-5309"
          />
        </div>
      </div>
    </div>
  )

  const renderLevelStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted">Select your sponsorship tier.</p>
      {tiers.length === 0 ? (
        <div className="rounded-xl border border-border p-6 text-center text-sm text-muted">
          No sponsorship tiers have been configured for this event yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {tiers.map(tier => {
            const tierId = tier.id ?? tier.name ?? ''
            const selected = form.selectedTierId === tierId
            return (
              <button
                key={tierId}
                type="button"
                onClick={() => handleTierSelect(tierId)}
                className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-150 ${
                  selected
                    ? 'border-accent bg-accent/5 ring-1 ring-accent'
                    : 'border-border bg-bg hover:border-fg/30 hover:bg-surface/50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${selected ? 'text-accent' : 'text-fg'}`}>
                      {tier.name ?? tierId}
                    </p>
                    {tier.description && (
                      <p className="text-xs text-muted mt-0.5 line-clamp-2">{tier.description}</p>
                    )}
                    {tier.benefits && tier.benefits.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {tier.benefits.map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-muted">
                            <span className={`shrink-0 mt-0.5 ${selected ? 'text-accent' : 'text-muted'}`}>✓</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(tier.includedPlayerSpots ?? 0) > 0 && (
                      <p className="text-xs text-muted mt-2 font-mono">
                        Includes {tier.includedPlayerSpots} player spot{(tier.includedPlayerSpots ?? 0) > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-base font-semibold font-mono ${selected ? 'text-accent' : 'text-fg'}`}>
                      {tier.price != null ? `$${tier.price.toLocaleString()}` : 'TBD'}
                    </p>
                    <span
                      className={`mt-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ml-auto transition-colors ${
                        selected ? 'border-accent bg-accent' : 'border-border'
                      }`}
                    >
                      {selected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
      {errors.selectedTierId && <p className={ERR}>{errors.selectedTierId}</p>}
    </div>
  )

  const renderPlayersStep = () => (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Your sponsorship includes {selectedTier?.includedPlayerSpots ?? 0} player spot{(selectedTier?.includedPlayerSpots ?? 0) !== 1 ? 's' : ''}.
        Enter player details below — they can update profiles after creating accounts.
      </p>
      {form.players.map((p, i) => (
        <div key={i} className="p-4 border border-border rounded-xl space-y-4">
          <p className="text-sm font-semibold text-fg">Player {i + 1}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Name <span className="text-muted text-xs">(optional)</span></label>
              <input
                className={INPUT}
                value={p.name}
                onChange={e => updatePlayer(i, 'name', e.target.value)}
                placeholder="Alex Kim"
              />
            </div>
            <div>
              <label className={LABEL}>Email <span className="text-muted text-xs">(optional)</span></label>
              <input
                className={INPUT}
                type="email"
                value={p.email}
                onChange={e => updatePlayer(i, 'email', e.target.value)}
                placeholder="alex@company.com"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  const renderPaymentStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted">How would you like to pay?</p>
      <div className="grid gap-3">
        {([
          {
            value: 'stripe' as const,
            label: 'Pay Now',
            sub: 'Credit / debit card or ACH bank transfer via Stripe',
          },
          {
            value: 'invoice' as const,
            label: 'Pay Later',
            sub: 'Receive an invoice — pay by check or bank transfer',
          },
        ] as const).map(({ value, label, sub }) => {
          const selected = form.paymentMethod === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => { setField('paymentMethod', value); clearError('paymentMethod') }}
              className={`flex items-center justify-between w-full px-5 py-4 rounded-xl border text-left transition-all duration-150 ${
                selected
                  ? 'border-accent bg-accent/5 ring-1 ring-accent'
                  : 'border-border bg-bg hover:border-fg/30 hover:bg-surface/50'
              }`}
            >
              <div>
                <p className={`text-sm font-semibold ${selected ? 'text-accent' : 'text-fg'}`}>{label}</p>
                <p className="text-xs text-muted mt-0.5">{sub}</p>
              </div>
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selected ? 'border-accent bg-accent' : 'border-border'
                }`}
              >
                {selected && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>
          )
        })}
      </div>
      {errors.paymentMethod && <p className={ERR}>{errors.paymentMethod}</p>}
    </div>
  )

  const renderAssetsStep = () => (
    <div className="space-y-6">
      <div>
        <label className={LABEL}>Company Logo <span className="text-muted text-xs">(optional)</span></label>
        <div className="mt-1">
          <label
            className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              uploadingLogo ? 'border-accent/40 bg-accent/5' : 'border-border hover:border-fg/30 hover:bg-surface/50'
            }`}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingLogo}
              onChange={e => e.target.files?.[0] && handleLogoChange(e.target.files[0])}
            />
            {uploadingLogo ? (
              <span className="flex items-center gap-2 text-sm text-muted">
                <IconLoader className="w-4 h-4" />
                Uploading…
              </span>
            ) : form.logoUrl ? (
              <span className="text-sm text-accent font-medium">✓ Logo uploaded</span>
            ) : (
              <span className="text-sm text-muted">Click to upload (PNG, JPG, SVG)</span>
            )}
          </label>
        </div>
      </div>
      <div>
        <label className={LABEL}>
          Marketing Material Requests <span className="text-muted text-xs">(optional)</span>
        </label>
        <textarea
          className={`${INPUT} min-h-[80px] resize-y`}
          value={form.marketingRequests}
          onChange={e => setField('marketingRequests', e.target.value)}
          placeholder="e.g. Banner placement, table signage, digital assets…"
        />
      </div>
      <div>
        <label className={LABEL}>
          On-Site Activation Notes <span className="text-muted text-xs">(optional)</span>
        </label>
        <textarea
          className={`${INPUT} min-h-[80px] resize-y`}
          value={form.activationNotes}
          onChange={e => setField('activationNotes', e.target.value)}
          placeholder="Special requests, setup notes, activation ideas…"
        />
      </div>
    </div>
  )

  const renderReviewStep = () => (
    <div className="space-y-5">
      <p className="text-sm text-muted">Review your sponsorship details before proceeding.</p>

      <div className="space-y-3">
        <ReviewRow label="Company" value={form.companyName} />
        <ReviewRow label="Contact" value={form.primaryContact} />
        <ReviewRow label="Email" value={form.email} />
        {form.phone && <ReviewRow label="Phone" value={form.phone} />}
      </div>

      {selectedTier && (
        <div className="pt-4 border-t border-border space-y-3">
          <p className="label-mono text-[0.6rem] mb-2">Sponsorship</p>
          <ReviewRow label="Level" value={selectedTier.name ?? selectedTier.id ?? ''} />
          <ReviewRow label="Amount" value={selectedTier.price != null ? `$${selectedTier.price.toLocaleString()} USD` : 'TBD'} />
          {(selectedTier.includedPlayerSpots ?? 0) > 0 && (
            <ReviewRow label="Player Spots" value={String(selectedTier.includedPlayerSpots)} />
          )}
        </div>
      )}

      {form.players.length > 0 && form.players.some(p => p.name || p.email) && (
        <div className="pt-4 border-t border-border space-y-2">
          <p className="label-mono text-[0.6rem] mb-2">Players</p>
          {form.players.map((p, i) => (
            <p key={i} className="text-sm text-fg">
              {p.name || `Player ${i + 1}`}{p.email ? ` — ${p.email}` : ''}
            </p>
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-border space-y-3">
        <p className="label-mono text-[0.6rem] mb-2">Payment</p>
        <ReviewRow
          label="Method"
          value={form.paymentMethod === 'stripe' ? 'Pay Now (Card / ACH)' : 'Pay Later (Invoice)'}
        />
      </div>

      {(form.logoUrl || form.activationNotes || form.marketingRequests) && (
        <div className="pt-4 border-t border-border space-y-3">
          <p className="label-mono text-[0.6rem] mb-2">Activation</p>
          {form.logoUrl && <ReviewRow label="Logo" value="Uploaded" />}
          {form.activationNotes && (
            <div className="flex gap-4 text-sm">
              <span className="text-muted font-mono shrink-0">Notes</span>
              <span className="text-fg text-right line-clamp-2">{form.activationNotes}</span>
            </div>
          )}
        </div>
      )}

      {apiError && (
        <div className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
          {apiError}
        </div>
      )}
    </div>
  )

  // ── Main render ────────────────────────────────────────────────────────────────

  const stepContent: Record<Step, () => React.JSX.Element> = {
    sponsorInfo: renderSponsorInfoStep,
    level: renderLevelStep,
    players: renderPlayersStep,
    payment: renderPaymentStep,
    assets: renderAssetsStep,
    review: renderReviewStep,
  }

  const isLastStep = stepIndex === activeSteps.length - 1

  return (
    <div className="max-w-xl mx-auto">
      {/* Stepper */}
      <div className="flex items-center gap-1.5 mb-8 overflow-x-auto pb-1" role="list" aria-label="Sponsorship steps">
        {activeSteps.map((step, i) => (
          <Fragment key={step}>
            <div className="flex items-center gap-1.5 shrink-0" role="listitem">
              <span
                className={`w-6 h-6 rounded-full text-[0.6rem] font-mono flex items-center justify-center shrink-0 transition-colors ${
                  i < stepIndex
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : i === stepIndex
                      ? 'bg-accent text-white'
                      : 'bg-surface text-muted-2 border border-border'
                }`}
                aria-current={i === stepIndex ? 'step' : undefined}
              >
                {i < stepIndex ? '✓' : i + 1}
              </span>
              <span
                className={`text-xs font-medium whitespace-nowrap transition-colors hidden sm:block ${
                  i === stepIndex ? 'text-fg' : i < stepIndex ? 'text-muted' : 'text-muted-2'
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < activeSteps.length - 1 && (
              <div
                className={`h-px flex-1 min-w-[8px] transition-colors ${i < stepIndex ? 'bg-accent/30' : 'bg-border'}`}
                aria-hidden="true"
              />
            )}
          </Fragment>
        ))}
      </div>

      {/* Step card */}
      <div className="card-base p-6 sm:p-8">
        <h2 className="text-base font-semibold text-fg mb-4">{STEP_LABELS[currentStep]}</h2>
        {stepContent[currentStep]()}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-5">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={handleBack}
            disabled={submitting}
            className="btn-ghost flex-1 justify-center"
          >
            Back
          </button>
        )}
        {isLastStep ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploadingLogo}
            className={`btn-accent flex-1 justify-center ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <IconLoader className="w-4 h-4" />
                <span>Please wait…</span>
              </span>
            ) : form.paymentMethod === 'invoice' ? (
              'Submit & Request Invoice'
            ) : (
              'Proceed to Payment'
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="btn-accent flex-1 justify-center"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted font-mono shrink-0">{label}</span>
      <span className="text-fg font-medium text-right">{value}</span>
    </div>
  )
}

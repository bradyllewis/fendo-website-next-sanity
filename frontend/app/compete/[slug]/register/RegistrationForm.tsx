'use client'

import React, { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconLoader } from '@/app/components/icons'

type RegistrationType = 'individual' | 'duo' | 'team'
type Step = 'type' | 'playerInfo' | 'teammates' | 'teamDetails' | 'addOns' | 'review'

interface Teammate {
  name: string
  email: string
  shirtSize: string
}

interface AddOns {
  longestPutt: boolean
  closestToPin: boolean
  mulligans: boolean
  vipLounge: boolean
  postRoundHospitality: boolean
}

interface FormState {
  registrationType: RegistrationType | null
  name: string
  phone: string
  city: string
  state: string
  shirtSize: string
  ageConfirmed: boolean
  handicap: string
  referral: string
  teammates: Teammate[]
  teamName: string
  walkUpSong: string
  designatedPutter: string
  addOns: AddOns
}

interface Props {
  event: {
    _id: string
    slug: string
    title: string
    entryFee: number | null
    status: string | null
  }
  userEmail: string
  initialName: string
  initialHandicap: number | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] as const

const REFERRAL_OPTIONS = [
  'Social Media',
  'Friend / Family',
  'Google Search',
  'Prior Event',
  'Other',
] as const

const STEP_LABELS: Record<Step, string> = {
  type: 'Type',
  playerInfo: 'Your Info',
  teammates: 'Teammates',
  teamDetails: 'Team',
  addOns: 'Add-Ons',
  review: 'Review',
}

const ADD_ON_LABELS: Record<keyof AddOns, string> = {
  longestPutt: 'Longest Putt Contest',
  closestToPin: 'Closest to the Pin Contest',
  mulligans: 'Mulligans Pack (5)',
  vipLounge: 'VIP Lounge Access',
  postRoundHospitality: 'Post-Round Hospitality Upgrade',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getActiveSteps(type: RegistrationType | null): Step[] {
  if (!type || type === 'individual') return ['type', 'playerInfo', 'addOns', 'review']
  return ['type', 'playerInfo', 'teammates', 'teamDetails', 'addOns', 'review']
}

function validateStep(step: Step, form: FormState): Record<string, string> {
  const e: Record<string, string> = {}
  switch (step) {
    case 'type':
      if (!form.registrationType) e.registrationType = 'Please select a registration type.'
      break
    case 'playerInfo':
      if (!form.name.trim()) e.name = 'Full name is required.'
      if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 7)
        e.phone = 'A valid phone number is required.'
      if (!form.city.trim()) e.city = 'City is required.'
      if (!form.state.trim()) e.state = 'State is required.'
      if (!form.shirtSize) e.shirtSize = 'Shirt size is required.'
      if (!form.ageConfirmed) e.ageConfirmed = 'You must confirm you are 18 or older to register.'
      break
    case 'teammates':
      form.teammates.forEach((t, i) => {
        if (!t.name.trim()) e[`t${i}name`] = 'Name is required.'
        if (!t.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email))
          e[`t${i}email`] = 'Valid email is required.'
        if (!t.shirtSize) e[`t${i}shirtSize`] = 'Shirt size is required.'
      })
      break
    case 'teamDetails':
      if (!form.teamName.trim()) e.teamName = 'Team name is required.'
      break
  }
  return e
}

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT =
  'w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm placeholder:text-muted-2 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors'
const SELECT = `${INPUT} cursor-pointer`
const LABEL = 'block text-sm font-medium text-fg mb-1.5'
const ERR = 'mt-1.5 text-xs text-danger'

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegistrationForm({ event, userEmail, initialName, initialHandicap }: Props) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    registrationType: null,
    name: initialName,
    phone: '',
    city: '',
    state: '',
    shirtSize: '',
    ageConfirmed: false,
    handicap: initialHandicap != null ? String(initialHandicap) : '',
    referral: '',
    teammates: [],
    teamName: '',
    walkUpSong: '',
    designatedPutter: '',
    addOns: {
      longestPutt: false,
      closestToPin: false,
      mulligans: false,
      vipLounge: false,
      postRoundHospitality: false,
    },
  })

  const activeSteps = getActiveSteps(form.registrationType)
  const currentStep = activeSteps[stepIndex]

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const clearError = (key: string) => {
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const handleTypeSelect = (type: RegistrationType) => {
    const count = type === 'duo' ? 1 : type === 'team' ? 3 : 0
    setForm(prev => ({
      ...prev,
      registrationType: type,
      teammates: Array.from({ length: count }, () => ({ name: '', email: '', shirtSize: '' })),
      teamName: '',
      walkUpSong: '',
      designatedPutter: '',
    }))
    setErrors({})
  }

  const updateTeammate = (i: number, field: keyof Teammate, value: string) => {
    setForm(prev => ({
      ...prev,
      teammates: prev.teammates.map((t, idx) => idx === i ? { ...t, [field]: value } : t),
    }))
    clearError(`t${i}${field}`)
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
      const registrationData = {
        registrationType: form.registrationType,
        name: form.name,
        phone: form.phone,
        city: form.city,
        state: form.state,
        shirtSize: form.shirtSize,
        ageConfirmed: form.ageConfirmed,
        handicap: form.handicap || null,
        referral: form.referral || null,
        teammates: form.teammates.length > 0 ? form.teammates : undefined,
        teamName: form.teamName || undefined,
        walkUpSong: form.walkUpSong || undefined,
        designatedPutter: form.designatedPutter || undefined,
        addOns: Object.values(form.addOns).some(Boolean) ? form.addOns : undefined,
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug: event.slug, registrationData }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.alreadyRegistered) { router.push(`/compete/${event.slug}`); return }
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

  // ── Step renders ─────────────────────────────────────────────────────────────

  const renderTypeStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted">Select how you&apos;ll be competing in this event.</p>
      <div className="grid gap-3">
        {(
          [
            { type: 'individual' as const, label: 'Individual', sub: 'Solo entry — just you' },
            { type: 'duo' as const, label: 'Duo', sub: '2-player team entry' },
            { type: 'team' as const, label: 'Team', sub: '4-player team entry' },
          ] as const
        ).map(({ type, label, sub }) => {
          const selected = form.registrationType === type
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeSelect(type)}
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
                    <path
                      d="M1.5 5L4 7.5L8.5 2.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            </button>
          )
        })}
      </div>
      {errors.registrationType && <p className={ERR}>{errors.registrationType}</p>}
    </div>
  )

  const renderPlayerInfoStep = () => (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>
            Full Name <span className="text-danger">*</span>
          </label>
          <input
            className={`${INPUT} ${errors.name ? 'border-danger' : ''}`}
            value={form.name}
            onChange={e => { setField('name', e.target.value); clearError('name') }}
            placeholder="Jordan Reed"
          />
          {errors.name && <p className={ERR}>{errors.name}</p>}
        </div>
        <div>
          <label className={LABEL}>Email</label>
          <input className={`${INPUT} opacity-60 cursor-not-allowed`} value={userEmail} readOnly />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>
            Phone <span className="text-danger">*</span>
          </label>
          <input
            className={`${INPUT} ${errors.phone ? 'border-danger' : ''}`}
            type="tel"
            value={form.phone}
            onChange={e => { setField('phone', e.target.value); clearError('phone') }}
            placeholder="(555) 867-5309"
          />
          {errors.phone && <p className={ERR}>{errors.phone}</p>}
        </div>
        <div>
          <label className={LABEL}>
            Shirt Size <span className="text-danger">*</span>
          </label>
          <select
            className={`${SELECT} ${errors.shirtSize ? 'border-danger' : ''}`}
            value={form.shirtSize}
            onChange={e => { setField('shirtSize', e.target.value); clearError('shirtSize') }}
          >
            <option value="">Select a size</option>
            {SHIRT_SIZES.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.shirtSize && <p className={ERR}>{errors.shirtSize}</p>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>
            City <span className="text-danger">*</span>
          </label>
          <input
            className={`${INPUT} ${errors.city ? 'border-danger' : ''}`}
            value={form.city}
            onChange={e => { setField('city', e.target.value); clearError('city') }}
            placeholder="Chicago"
          />
          {errors.city && <p className={ERR}>{errors.city}</p>}
        </div>
        <div>
          <label className={LABEL}>
            State <span className="text-danger">*</span>
          </label>
          <input
            className={`${INPUT} ${errors.state ? 'border-danger' : ''}`}
            value={form.state}
            onChange={e => { setField('state', e.target.value); clearError('state') }}
            placeholder="IL"
            maxLength={30}
          />
          {errors.state && <p className={ERR}>{errors.state}</p>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>
            Handicap <span className="text-muted text-xs">(optional)</span>
          </label>
          <input
            className={INPUT}
            type="number"
            min="-10"
            max="54"
            step="0.1"
            value={form.handicap}
            onChange={e => setField('handicap', e.target.value)}
            placeholder="e.g. 12.4"
          />
        </div>
        <div>
          <label className={LABEL}>
            How did you hear about us? <span className="text-muted text-xs">(optional)</span>
          </label>
          <select
            className={SELECT}
            value={form.referral}
            onChange={e => setField('referral', e.target.value)}
          >
            <option value="">Select an option</option>
            {REFERRAL_OPTIONS.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 rounded accent-accent shrink-0"
            checked={form.ageConfirmed}
            onChange={e => { setField('ageConfirmed', e.target.checked); clearError('ageConfirmed') }}
          />
          <span className="text-sm text-muted">
            I confirm that I am 18 years of age or older.{' '}
            <span className="text-danger">*</span>
          </span>
        </label>
        {errors.ageConfirmed && <p className={`${ERR} ml-7`}>{errors.ageConfirmed}</p>}
      </div>
    </div>
  )

  const renderTeammatesStep = () => (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Enter details for each teammate. They can update their own profiles after creating accounts.
      </p>
      {form.teammates.map((t, i) => (
        <div key={i} className="p-4 border border-border rounded-xl space-y-4">
          <p className="text-sm font-semibold text-fg">Teammate {i + 1}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>
                Name <span className="text-danger">*</span>
              </label>
              <input
                className={`${INPUT} ${errors[`t${i}name`] ? 'border-danger' : ''}`}
                value={t.name}
                onChange={e => updateTeammate(i, 'name', e.target.value)}
                placeholder="Alex Kim"
              />
              {errors[`t${i}name`] && <p className={ERR}>{errors[`t${i}name`]}</p>}
            </div>
            <div>
              <label className={LABEL}>
                Email <span className="text-danger">*</span>
              </label>
              <input
                className={`${INPUT} ${errors[`t${i}email`] ? 'border-danger' : ''}`}
                type="email"
                value={t.email}
                onChange={e => updateTeammate(i, 'email', e.target.value)}
                placeholder="alex@example.com"
              />
              {errors[`t${i}email`] && <p className={ERR}>{errors[`t${i}email`]}</p>}
            </div>
          </div>
          <div>
            <label className={LABEL}>
              Shirt Size <span className="text-danger">*</span>
            </label>
            <select
              className={`${SELECT} ${errors[`t${i}shirtSize`] ? 'border-danger' : ''}`}
              value={t.shirtSize}
              onChange={e => updateTeammate(i, 'shirtSize', e.target.value)}
            >
              <option value="">Select a size</option>
              {SHIRT_SIZES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {errors[`t${i}shirtSize`] && <p className={ERR}>{errors[`t${i}shirtSize`]}</p>}
          </div>
        </div>
      ))}
    </div>
  )

  const renderTeamDetailsStep = () => {
    const allMembers = [form.name, ...form.teammates.map(t => t.name)].filter(Boolean)
    return (
      <div className="space-y-4">
        <div>
          <label className={LABEL}>
            Team Name <span className="text-danger">*</span>
          </label>
          <input
            className={`${INPUT} ${errors.teamName ? 'border-danger' : ''}`}
            value={form.teamName}
            onChange={e => { setField('teamName', e.target.value); clearError('teamName') }}
            placeholder="The Eagles"
          />
          {errors.teamName && <p className={ERR}>{errors.teamName}</p>}
        </div>
        <div>
          <label className={LABEL}>
            Walk-Up Song <span className="text-muted text-xs">(optional)</span>
          </label>
          <input
            className={INPUT}
            value={form.walkUpSong}
            onChange={e => setField('walkUpSong', e.target.value)}
            placeholder="Song – Artist"
          />
        </div>
        {allMembers.length > 0 && (
          <div>
            <label className={LABEL}>
              Designated Putter <span className="text-muted text-xs">(optional)</span>
            </label>
            <select
              className={SELECT}
              value={form.designatedPutter}
              onChange={e => setField('designatedPutter', e.target.value)}
            >
              <option value="">Select a player</option>
              {allMembers.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    )
  }

  const renderAddOnsStep = () => {
    const checkbox = (key: keyof AddOns, label: string) => (
      <label key={key} className="flex items-center gap-3 cursor-pointer py-3">
        <input
          type="checkbox"
          className="w-4 h-4 rounded accent-accent shrink-0"
          checked={form.addOns[key]}
          onChange={e => setField('addOns', { ...form.addOns, [key]: e.target.checked })}
        />
        <span className="text-sm text-fg">{label}</span>
      </label>
    )

    return (
      <div className="space-y-6">
        <p className="text-sm text-muted">
          Select any optional add-ons. Availability and pricing will be confirmed by the event team
          after registration.
        </p>
        <div>
          <p className="label-mono text-[0.6rem] mb-2">Side Games</p>
          <div className="border border-border rounded-xl px-4 divide-y divide-border/50">
            {checkbox('longestPutt', 'Longest Putt Contest')}
            {checkbox('closestToPin', 'Closest to the Pin Contest')}
          </div>
        </div>
        <div>
          <p className="label-mono text-[0.6rem] mb-2">Game Enhancers</p>
          <div className="border border-border rounded-xl px-4 divide-y divide-border/50">
            {checkbox('mulligans', 'Mulligans Pack (5)')}
          </div>
        </div>
        <div>
          <p className="label-mono text-[0.6rem] mb-2">Premium Experiences</p>
          <div className="border border-border rounded-xl px-4 divide-y divide-border/50">
            {checkbox('vipLounge', 'VIP Lounge Access')}
            {checkbox('postRoundHospitality', 'Post-Round Hospitality Upgrade')}
          </div>
        </div>
      </div>
    )
  }

  const renderReviewStep = () => {
    const typeLabels: Record<RegistrationType, string> = {
      individual: 'Individual',
      duo: 'Duo (2 players)',
      team: 'Team (4 players)',
    }
    const selectedAddOns = (Object.entries(form.addOns) as [keyof AddOns, boolean][])
      .filter(([, v]) => v)
      .map(([k]) => ADD_ON_LABELS[k])

    const entryFeeStr =
      event.entryFee == null || event.entryFee === 0 ? 'Free' : `$${event.entryFee}`

    return (
      <div className="space-y-5">
        <p className="text-sm text-muted">Review your details before proceeding.</p>

        <div className="space-y-3">
          <ReviewRow label="Registration Type" value={typeLabels[form.registrationType!]} />
          <ReviewRow label="Name" value={form.name} />
          <ReviewRow label="Email" value={userEmail} />
          <ReviewRow label="Phone" value={form.phone} />
          <ReviewRow label="Location" value={`${form.city}, ${form.state}`} />
          <ReviewRow label="Shirt Size" value={form.shirtSize} />
          {form.handicap && <ReviewRow label="Handicap" value={form.handicap} />}
          {form.referral && <ReviewRow label="Referred By" value={form.referral} />}
        </div>

        {form.teammates.length > 0 && (
          <div className="pt-4 border-t border-border space-y-2">
            <p className="label-mono text-[0.6rem] mb-2">Teammates</p>
            {form.teammates.map((t, i) => (
              <p key={i} className="text-sm text-fg">
                {t.name} — {t.email} · {t.shirtSize}
              </p>
            ))}
          </div>
        )}

        {form.teamName && (
          <div className="pt-4 border-t border-border space-y-3">
            <p className="label-mono text-[0.6rem] mb-2">Team Details</p>
            <ReviewRow label="Team Name" value={form.teamName} />
            {form.walkUpSong && <ReviewRow label="Walk-Up Song" value={form.walkUpSong} />}
            {form.designatedPutter && (
              <ReviewRow label="Designated Putter" value={form.designatedPutter} />
            )}
          </div>
        )}

        {selectedAddOns.length > 0 && (
          <div className="pt-4 border-t border-border space-y-2">
            <p className="label-mono text-[0.6rem] mb-2">Add-Ons</p>
            {selectedAddOns.map(a => (
              <p key={a} className="text-sm text-fg">
                {a}
              </p>
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <ReviewRow label="Entry Fee" value={entryFeeStr} />
        </div>

        {apiError && (
          <div className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
            {apiError}
          </div>
        )}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const stepContent: Record<Step, () => React.JSX.Element> = {
    type: renderTypeStep,
    playerInfo: renderPlayerInfoStep,
    teammates: renderTeammatesStep,
    teamDetails: renderTeamDetailsStep,
    addOns: renderAddOnsStep,
    review: renderReviewStep,
  }

  const isLastStep = stepIndex === activeSteps.length - 1
  const isFree = !event.entryFee || event.entryFee === 0

  return (
    <div className="max-w-xl mx-auto">
      {/* Stepper */}
      <div className="flex items-center gap-1.5 mb-8 overflow-x-auto pb-1" role="list" aria-label="Registration steps">
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
            disabled={submitting}
            className={`btn-accent flex-1 justify-center ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <IconLoader className="w-4 h-4" />
                <span>Please wait…</span>
              </span>
            ) : isFree ? (
              'Complete Registration'
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

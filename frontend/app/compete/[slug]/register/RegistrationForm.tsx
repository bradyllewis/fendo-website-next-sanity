'use client'

import React, { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconLoader } from '@/app/components/icons'

type RegistrationType = 'individual' | 'duo' | 'team' | 'join'
type Step = 'type' | 'joinCode' | 'playerInfo' | 'teamDetails' | 'addOns' | 'review'

interface AddOns {
  longestPutt: boolean
  closestToPin: boolean
  mulligans: boolean
  vipLounge: boolean
  postRoundHospitality: boolean
}

interface JoinedTeam {
  id: string
  teamName: string
  registrationType: string
  maxMembers: number
  memberCount: number
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
  teamName: string
  walkUpSong: string
  addOns: AddOns
  joinCode: string
  joinedTeam: JoinedTeam | null
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
  joinCode: 'Team Code',
  playerInfo: 'Your Info',
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
  if (type === 'join') return ['type', 'joinCode', 'playerInfo', 'addOns', 'review']
  return ['type', 'playerInfo', 'teamDetails', 'addOns', 'review']
}

function validateStep(step: Step, form: FormState): Record<string, string> {
  const e: Record<string, string> = {}
  switch (step) {
    case 'type':
      if (!form.registrationType) e.registrationType = 'Please select a registration type.'
      break
    case 'joinCode':
      if (!form.joinedTeam) e.joinCode = 'Please find and confirm a valid team first.'
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
  const [lookingUpCode, setLookingUpCode] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

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
    teamName: '',
    walkUpSong: '',
    addOns: {
      longestPutt: false,
      closestToPin: false,
      mulligans: false,
      vipLounge: false,
      postRoundHospitality: false,
    },
    joinCode: '',
    joinedTeam: null,
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
    setForm(prev => ({
      ...prev,
      registrationType: type,
      teamName: '',
      walkUpSong: '',
      joinCode: '',
      joinedTeam: null,
    }))
    setErrors({})
    setCodeError(null)
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

  const handleLookupCode = async () => {
    const code = form.joinCode.trim().toUpperCase()
    if (!code) { setCodeError('Please enter a team code.'); return }

    setLookingUpCode(true)
    setCodeError(null)
    setField('joinedTeam', null)

    try {
      const res = await fetch(
        `/api/teams/lookup?code=${encodeURIComponent(code)}&eventSanityId=${encodeURIComponent(event._id)}`,
      )
      const data = await res.json()
      if (!res.ok) {
        setCodeError(data.error || 'Unable to find team.')
        return
      }
      setForm(prev => ({ ...prev, joinedTeam: data, joinCode: code }))
    } catch {
      setCodeError('Something went wrong. Please try again.')
    } finally {
      setLookingUpCode(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setApiError(null)
    try {
      const registrationData: Record<string, unknown> = {
        registrationType: form.registrationType,
        name: form.name,
        phone: form.phone,
        city: form.city,
        state: form.state,
        shirtSize: form.shirtSize,
        ageConfirmed: form.ageConfirmed,
        handicap: form.handicap || null,
        referral: form.referral || null,
        addOns: Object.values(form.addOns).some(Boolean) ? form.addOns : undefined,
      }

      if (form.registrationType === 'join') {
        registrationData.joinTeamCode = form.joinCode
      } else if (form.registrationType === 'duo' || form.registrationType === 'team') {
        registrationData.teamName = form.teamName || undefined
        registrationData.walkUpSong = form.walkUpSong || undefined
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
            { type: 'duo' as const, label: 'Duo', sub: 'Create a 2-player team' },
            { type: 'team' as const, label: 'Team', sub: 'Create a 4-player team' },
            { type: 'join' as const, label: 'Join Existing Team', sub: 'Enter your team invite code' },
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

  const renderJoinCodeStep = () => (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Enter the 6-character invite code your team captain shared with you.
      </p>
      <div>
        <label className={LABEL}>
          Team Invite Code <span className="text-danger">*</span>
        </label>
        <div className="flex gap-2">
          <input
            className={`${INPUT} flex-1 uppercase tracking-widest font-mono ${errors.joinCode ? 'border-danger' : ''}`}
            value={form.joinCode}
            onChange={e => {
              setField('joinCode', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
              setField('joinedTeam', null)
              setCodeError(null)
              clearError('joinCode')
            }}
            placeholder="GF7K2X"
            maxLength={6}
          />
          <button
            type="button"
            onClick={handleLookupCode}
            disabled={lookingUpCode || form.joinCode.length < 6}
            className="btn-accent shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {lookingUpCode ? <IconLoader className="w-4 h-4" /> : 'Find Team'}
          </button>
        </div>
        {codeError && <p className={ERR}>{codeError}</p>}
        {errors.joinCode && !codeError && <p className={ERR}>{errors.joinCode}</p>}
      </div>

      {form.joinedTeam && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-2">
          <p className="text-xs font-mono text-accent uppercase tracking-wide">Team Found</p>
          <p className="font-semibold text-fg">{form.joinedTeam.teamName}</p>
          <p className="text-sm text-muted">
            {form.joinedTeam.memberCount} of {form.joinedTeam.maxMembers} spots filled
          </p>
        </div>
      )}
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

  const renderTeamDetailsStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Set up your team. Your teammates will join using the invite code shown after registration.
      </p>
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
    </div>
  )

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
      duo: 'Duo Captain (2 players)',
      team: 'Team Captain (4 players)',
      join: `Joining: ${form.joinedTeam?.teamName ?? '—'}`,
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

        {(form.registrationType === 'duo' || form.registrationType === 'team') && form.teamName && (
          <div className="pt-4 border-t border-border space-y-3">
            <p className="label-mono text-[0.6rem] mb-2">Team Details</p>
            <ReviewRow label="Team Name" value={form.teamName} />
            {form.walkUpSong && <ReviewRow label="Walk-Up Song" value={form.walkUpSong} />}
          </div>
        )}

        {form.registrationType === 'join' && form.joinedTeam && (
          <div className="pt-4 border-t border-border space-y-3">
            <p className="label-mono text-[0.6rem] mb-2">Team</p>
            <ReviewRow label="Team Name" value={form.joinedTeam.teamName} />
            <ReviewRow label="Invite Code" value={form.joinCode} />
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
    joinCode: renderJoinCodeStep,
    playerInfo: renderPlayerInfoStep,
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

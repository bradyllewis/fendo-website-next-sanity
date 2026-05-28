import {useState} from 'react'
import {useDocumentOperation} from 'sanity'
import type {DocumentActionProps, DocumentActionComponent} from 'sanity'
import {TrashIcon} from '@sanity/icons'

// These env vars are bundled into the Studio by Sanity's build system.
// Set them in studio/.env.local:
//   SANITY_STUDIO_NEXT_URL=https://your-nextjs-app.com
//   SANITY_STUDIO_ADMIN_SECRET=<matches ADMIN_API_SECRET in Next.js>
const NEXT_URL =
  (typeof process !== 'undefined' && process.env.SANITY_STUDIO_NEXT_URL) ||
  'http://localhost:3000'
const ADMIN_SECRET =
  (typeof process !== 'undefined' && process.env.SANITY_STUDIO_ADMIN_SECRET) || ''

interface CascadeResult {
  success: boolean
  refundsProcessed: number
  refundsFailed: number
  sessionsCancelled: number
  emailsSent: number
  emailsFailed: number
  recordsCancelled: number
  sanityDeleted: boolean
  errors: string[]
}

// ─── EventDeleteAction ────────────────────────────────────────────────────────
// Replaces the built-in delete action for `event` documents. Shows a
// confirmation dialog with options to send emails and issue Stripe refunds
// before performing the cascade cleanup and Sanity deletion.

export const EventDeleteAction: DocumentActionComponent = function EventDeleteAction(
  props: DocumentActionProps,
) {
  const ops = useDocumentOperation(props.id, props.type)
  const [open, setOpen] = useState(false)
  const [sendEmails, setSendEmails] = useState(true)
  const [processRefunds, setProcessRefunds] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CascadeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const doc = props.draft ?? props.published
  const eventTitle = (doc as Record<string, unknown>)?.title as string | undefined
  const eventSlug = ((doc as Record<string, unknown>)?.slug as {current?: string} | undefined)
    ?.current
  const eventDate = (doc as Record<string, unknown>)?.startDate as string | undefined

  async function handleDelete() {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${NEXT_URL}/api/admin/delete-tournament`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET,
        },
        body: JSON.stringify({
          eventSanityId: props.id,
          eventSlug: eventSlug ?? '',
          eventTitle: eventTitle ?? 'Unknown Event',
          eventDate: eventDate ?? null,
          sendEmails,
          processRefunds,
          // Studio handles its own Sanity deletion below
          skipSanityDeletion: true,
        }),
      })

      const data: CascadeResult = await res.json()

      if (!res.ok) {
        setError(
          (data as unknown as {error?: string}).error ??
            `Request failed (${res.status})`,
        )
        setLoading(false)
        return
      }

      setResult(data)

      if (data.success) {
        // Perform the actual Sanity document deletion via Studio's built-in op
        ops.delete.execute()
        // Give Sanity a moment to process, then complete
        setTimeout(() => props.onComplete(), 800)
      } else {
        setLoading(false)
      }
    } catch (err: unknown) {
      const e = err as {message?: string}
      setError(e.message ?? 'Network error — check that SANITY_STUDIO_NEXT_URL is correct.')
      setLoading(false)
    }
  }

  return {
    label: 'Delete Tournament…',
    color: 'danger' as const,
    icon: TrashIcon,
    onHandle: () => {
      setOpen(true)
      setResult(null)
      setError(null)
      setSendEmails(true)
      setProcessRefunds(true)
    },
    dialog: open
      ? {
          type: 'dialog' as const,
          header: 'Delete Tournament',
          onClose: loading ? () => undefined : () => setOpen(false),
          content: (
            <div style={{padding: '24px', maxWidth: '480px', fontFamily: 'inherit'}}>
              {result ? (
                // ── Result view ──────────────────────────────────────────────
                <div>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: result.success ? '#16a34a' : '#dc2626',
                      marginBottom: '12px',
                    }}
                  >
                    {result.success
                      ? '✓ Cascade completed successfully'
                      : '⚠ Completed with warnings'}
                  </p>
                  <div
                    style={{
                      background: '#f8f8f8',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      lineHeight: '1.8',
                      color: '#555',
                    }}
                  >
                    <div>Refunds processed: {result.refundsProcessed}</div>
                    {result.refundsFailed > 0 && (
                      <div style={{color: '#dc2626'}}>Refunds failed: {result.refundsFailed}</div>
                    )}
                    <div>Sessions cancelled: {result.sessionsCancelled}</div>
                    <div>Emails sent: {result.emailsSent}</div>
                    <div>Records cancelled: {result.recordsCancelled}</div>
                  </div>

                  {result.errors.length > 0 && (
                    <div
                      style={{
                        marginTop: '12px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        padding: '12px',
                      }}
                    >
                      <p style={{fontSize: '11px', fontWeight: 600, color: '#dc2626', margin: '0 0 6px'}}>
                        Warnings
                      </p>
                      {result.errors.map((e, i) => (
                        <p key={i} style={{fontSize: '11px', color: '#dc2626', margin: '2px 0', wordBreak: 'break-word'}}>
                          • {e}
                        </p>
                      ))}
                    </div>
                  )}

                  <p style={{fontSize: '12px', color: '#888', marginTop: '12px'}}>
                    The document is being deleted from Sanity…
                  </p>
                </div>
              ) : (
                // ── Confirmation form ────────────────────────────────────────
                <div>
                  {eventTitle && (
                    <div
                      style={{
                        background: '#f8f8f8',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        marginBottom: '20px',
                      }}
                    >
                      <p style={{fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px'}}>
                        Deleting
                      </p>
                      <p style={{fontSize: '14px', fontWeight: 600, color: '#111', margin: 0}}>
                        {eventTitle}
                      </p>
                    </div>
                  )}

                  <p style={{fontSize: '14px', color: '#555', marginBottom: '16px', lineHeight: 1.6}}>
                    This will permanently delete this tournament and cancel all associated registrations. Choose what should happen first:
                  </p>

                  {/* Checkboxes */}
                  <div style={{display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px'}}>
                    <label style={{display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer'}}>
                      <input
                        type="checkbox"
                        checked={sendEmails}
                        onChange={(e) => setSendEmails(e.target.checked)}
                        style={{marginTop: '2px', accentColor: '#BD5846'}}
                      />
                      <div>
                        <p style={{fontSize: '14px', fontWeight: 500, color: '#111', margin: '0 0 3px'}}>
                          Send cancellation emails
                        </p>
                        <p style={{fontSize: '12px', color: '#888', margin: 0}}>
                          Notify all registered players, team members, and sponsors via Resend.
                        </p>
                      </div>
                    </label>

                    <label style={{display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer'}}>
                      <input
                        type="checkbox"
                        checked={processRefunds}
                        onChange={(e) => setProcessRefunds(e.target.checked)}
                        style={{marginTop: '2px', accentColor: '#BD5846'}}
                      />
                      <div>
                        <p style={{fontSize: '14px', fontWeight: 500, color: '#111', margin: '0 0 3px'}}>
                          Issue Stripe refunds
                        </p>
                        <p style={{fontSize: '12px', color: '#888', margin: 0}}>
                          Refund all confirmed Stripe payments (players + sponsors). Invoiced sponsors are marked cancelled only.
                        </p>
                      </div>
                    </label>
                  </div>

                  {error && (
                    <div
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        marginBottom: '16px',
                      }}
                    >
                      <p style={{fontSize: '12px', color: '#dc2626', margin: 0}}>{error}</p>
                    </div>
                  )}

                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      marginBottom: '20px',
                    }}
                  >
                    <p style={{fontSize: '12px', color: '#92400e', margin: 0}}>
                      ⚠ This action is irreversible. All Supabase registrations will be soft-cancelled and Stripe sessions will be expired before the document is deleted.
                    </p>
                  </div>

                  <div style={{display: 'flex', gap: '12px'}}>
                    <button
                      onClick={() => setOpen(false)}
                      disabled={loading}
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#555',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={loading}
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: 'none',
                        borderRadius: '8px',
                        background: loading ? '#f87171' : '#dc2626',
                        color: '#fff',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 600,
                      }}
                    >
                      {loading ? 'Processing…' : 'Delete Tournament'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ),
        }
      : null,
  }
}

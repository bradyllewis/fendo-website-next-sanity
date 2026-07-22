import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { client } from '@/sanity/lib/client'
import { getTournamentRoster, type RosterEntry } from '@/lib/tournamentRoster'

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const adminDb = createAdminClient()
    const { data: profile } = await adminDb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    return profile?.role === 'admin'
  } catch {
    return false
  }
}

// ─── Row flattening (shared by both formats) ──────────────────────────────────

const COLUMNS = [
  'Team Name',
  'Registration Type',
  'Payment Mode',
  'Team Status',
  'First Name',
  'Last Name',
  'Email',
  'Shirt Size',
  'Role',
  'Status',
  'Amount Paid',
] as const

const TYPE_LABELS: Record<string, string> = {
  individual: 'Solo',
  duo: 'Duo',
  team: 'Team',
}

const PAYMENT_LABELS: Record<string, string> = {
  captain_pays_all: 'Captain pays all',
  individual: 'Individual pay',
}

function flattenRoster(roster: RosterEntry[]): (string | number)[][] {
  const rows: (string | number)[][] = []
  for (const entry of roster) {
    for (const m of entry.members) {
      rows.push([
        entry.teamName ?? '',
        TYPE_LABELS[entry.registrationType] ?? entry.registrationType,
        entry.paymentMode ? PAYMENT_LABELS[entry.paymentMode] ?? entry.paymentMode : '',
        entry.teamStatus ?? '',
        m.firstName,
        m.lastName,
        m.email,
        m.shirtSize ?? '',
        m.isCaptain ? 'Captain' : entry.kind === 'solo' ? 'Solo' : 'Member',
        m.status,
        m.amountPaidCents != null ? (m.amountPaidCents / 100).toFixed(2) : '',
      ])
    }
  }
  return rows
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: (string | number)[][]): string {
  const lines = [COLUMNS.join(','), ...rows.map((r) => r.map(csvCell).join(','))]
  // Prepend BOM so Excel opens UTF-8 correctly.
  return '﻿' + lines.join('\r\n')
}

// ─── XLSX ─────────────────────────────────────────────────────────────────────

async function toXlsx(rows: (string | number)[][], eventTitle: string): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Fendo Golf Admin'
  const sheet = workbook.addWorksheet('Roster')

  sheet.columns = COLUMNS.map((header) => ({
    header,
    width: header === 'Email' ? 32 : header === 'Team Name' ? 24 : 16,
  }))

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } }
  headerRow.alignment = { vertical: 'middle' }

  for (const r of rows) sheet.addRow(r)
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  // Title in worksheet metadata for context.
  workbook.title = `${eventTitle} — Roster`

  const buffer = await workbook.xlsx.writeBuffer()
  // exceljs returns its own Buffer type; the underlying value is an ArrayBuffer.
  const bytes = new Uint8Array(buffer as ArrayBuffer)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('eventId')
  const format = (searchParams.get('format') ?? 'csv').toLowerCase()

  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
  }
  if (format !== 'csv' && format !== 'xlsx') {
    return NextResponse.json({ error: 'format must be csv or xlsx' }, { status: 400 })
  }

  const [roster, event] = await Promise.all([
    getTournamentRoster(eventId),
    client.fetch<{ title?: string; slug?: string } | null>(
      `*[_id == $id][0]{title, "slug": slug.current}`,
      { id: eventId },
    ),
  ])

  const rows = flattenRoster(roster)
  const baseName = (event?.slug || event?.title || 'tournament')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const filename = `${baseName}-roster.${format}`

  if (format === 'csv') {
    return new NextResponse(toCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  const xlsx = await toXlsx(rows, event?.title ?? 'Tournament')
  return new NextResponse(xlsx, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

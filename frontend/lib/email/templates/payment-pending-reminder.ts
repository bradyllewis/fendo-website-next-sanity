interface PaymentPendingReminderEmailParams {
  playerFirstName: string
  teamName: string | null
  eventTitle: string
  eventDate: string | null
  amountDue: number
  /** Formatted expiry date (e.g. "August 8, 2026"), or null if the slot doesn't expire. */
  expiresAt: string | null
  payUrl: string
  siteUrl: string
}

export function buildPaymentPendingReminderEmail(p: PaymentPendingReminderEmailParams): string {
  const greetingName = p.playerFirstName?.trim() || 'there'
  const amountStr = `$${(p.amountDue / 100).toFixed(2)}`
  const teamLine = p.teamName
    ? `your spot on <strong style="color:#0C1C23;">${p.teamName}</strong> for `
    : 'your spot for '
  const expiryNotice = p.expiresAt
    ? `<p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:400;line-height:1.6;color:#4D6B59;margin:0 0 28px 0;">
                &#9200; This reservation expires on <strong style="color:#0C1C23;">${p.expiresAt}</strong>. After that, your spot may be released.
              </p>`
    : ''
  const dateLine = p.eventDate
    ? `<p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;line-height:1.6;color:#4D6B59;margin:0;">${p.eventDate}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Payment reminder: ${p.eventTitle} — Fendo Golf</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap');
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; display: block; }
    body { margin: 0; padding: 0; background-color: #F8EDD9; }
    @media only screen and (max-width: 620px) {
      .outer-td { padding: 24px 16px !important; }
      .inner-td { padding: 32px 24px !important; }
      .header-td { padding: 24px !important; }
      .footer-td { padding: 20px 24px !important; }
      .heading { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F8EDD9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8EDD9;">
    <tr>
      <td class="outer-td" align="center" style="padding:48px 20px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td class="header-td" style="background-color:#F8EDD9;padding:28px 36px 24px;border:1px solid #C8B596;border-bottom:none;border-radius:16px 16px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <a href="${p.siteUrl}" style="display:block;text-decoration:none;"><img src="https://ezgimntosyyqevcyarfg.supabase.co/storage/v1/object/public/spin-society/app/Fendo-golf-blue-logo.webp" alt="Fendo Golf" width="116" height="auto" style="display:block;height:28px;width:auto;" /></a>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;color:#6E8880;">PAYMENT REMINDER</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ACCENT DIVIDER -->
          <tr>
            <td style="background-color:#BD5846;height:2px;border-left:1px solid #BD5846;border-right:1px solid #BD5846;"></td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td class="inner-td" style="background-color:#F1E2C5;padding:40px 36px;border:1px solid #C8B596;border-top:none;border-bottom:none;">

              <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;color:#BD5846;margin:0 0 20px 0;">PAYMENT / STILL PENDING</p>

              <h1 class="heading" style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:30px;font-weight:600;letter-spacing:-0.03em;line-height:1.1;color:#0C1C23;margin:0 0 16px 0;">Your spot isn&rsquo;t paid yet</h1>

              <p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px;font-weight:400;line-height:1.65;color:#4D6B59;margin:0 0 28px 0;">
                Hi <strong style="color:#0C1C23;">${greetingName}</strong> — ${teamLine}<strong style="color:#0C1C23;">${p.eventTitle}</strong> is reserved, but payment hasn&rsquo;t come through yet. Complete it now to lock in your place.
              </p>

              <!-- Amount box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8EDD9;border:1px solid #C8B596;border-radius:12px;margin:0 0 28px 0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#6E8880;margin:0 0 8px 0;">AMOUNT DUE</p>
                    <p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:24px;font-weight:600;color:#0C1C23;margin:0 0 6px 0;">${amountStr}</p>
                    <p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:15px;font-weight:600;color:#0C1C23;margin:0 0 2px 0;">${p.eventTitle}</p>
                    ${dateLine}
                  </td>
                </tr>
              </table>

              ${expiryNotice}

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:12px;background-color:#BD5846;">
                    <a href="${p.payUrl}" style="display:inline-block;padding:14px 28px;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:600;letter-spacing:-0.01em;color:#ffffff;text-decoration:none;border-radius:12px;">
                      Pay My Spot &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;">
                <tr><td style="border-top:1px solid #C8B596;"></td></tr>
              </table>

              <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#6E8880;margin:0 0 8px 0;">Or copy this link into your browser</p>
              <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;line-height:1.5;color:#4D6B59;margin:0;word-break:break-all;">${p.payUrl}</p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td class="footer-td" style="background-color:#F8EDD9;padding:22px 36px;border:1px solid #C8B596;border-top:none;border-radius:0 0 16px 16px;">
              <p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;line-height:1.6;color:#6E8880;margin:0 0 6px 0;">
                You received this because a spot was reserved for you at this tournament on Fendo Golf. No account is required to pay your entry.
              </p>
              <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#9D8762;margin:0;">
                &copy; Fendo Golf &nbsp;&middot;&nbsp; <a href="${p.siteUrl}" style="color:#9D8762;text-decoration:none;">spinsociety.fendogolf.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`
}

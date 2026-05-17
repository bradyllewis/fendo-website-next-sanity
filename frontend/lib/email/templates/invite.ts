interface InviteEmailParams {
  playerFirstName: string
  captainName: string
  eventTitle: string
  eventDate: string
  eventLocation: string | null
  teamType: 'Duo' | 'Foursome'
  amountDue: number
  expiresAt: string
  inviteUrl: string
}

export function buildInviteEmail(p: InviteEmailParams): string {
  const amountStr = `$${(p.amountDue / 100).toFixed(2)}`
  const locationLine = p.eventLocation ? `<p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;line-height:1.6;color:#4D6B59;margin:0;">${p.eventLocation}</p>` : ''

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>You've been invited to a tournament team — Fendo Golf</title>
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
                    <a href="https://spinsociety.fendogolf.com" style="display:block;text-decoration:none;"><img src="https://ezgimntosyyqevcyarfg.supabase.co/storage/v1/object/public/spin-society/app/Fendo-golf-blue-logo.webp" alt="Fendo Golf" width="116" height="auto" style="display:block;height:28px;width:auto;" /></a>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;color:#6E8880;">TOURNAMENT INVITE</span>
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

              <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;color:#BD5846;margin:0 0 20px 0;">TEAM REGISTRATION / INVITE</p>

              <h1 class="heading" style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:30px;font-weight:600;letter-spacing:-0.03em;line-height:1.1;color:#0C1C23;margin:0 0 16px 0;">You&rsquo;ve been invited to join a tournament team</h1>

              <p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px;font-weight:400;line-height:1.65;color:#4D6B59;margin:0 0 28px 0;">
                <strong style="color:#0C1C23;font-weight:600;">${p.captainName}</strong> invited you to join their ${p.teamType.toLowerCase()} for <strong style="color:#0C1C23;font-weight:600;">${p.eventTitle}</strong>.
                Your spot is reserved for 7 days — secure it now before it expires.
              </p>

              <!-- Event details box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8EDD9;border:1px solid #C8B596;border-radius:12px;margin:0 0 28px 0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#6E8880;margin:0 0 12px 0;">TOURNAMENT DETAILS</p>
                    <p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px;font-weight:600;color:#0C1C23;margin:0 0 4px 0;">${p.eventTitle}</p>
                    <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;line-height:1.6;color:#4D6B59;margin:0;">${p.eventDate}</p>
                    ${locationLine}
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0;">
                      <tr>
                        <td style="border-top:1px solid #C8B596;"></td>
                      </tr>
                    </table>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0;">
                      <tr>
                        <td style="padding-right:32px;">
                          <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#6E8880;margin:0 0 4px 0;">FORMAT</p>
                          <p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:600;color:#0C1C23;margin:0;">${p.teamType}</p>
                        </td>
                        <td>
                          <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#6E8880;margin:0 0 4px 0;">ENTRY FEE</p>
                          <p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:600;color:#0C1C23;margin:0;">${amountStr}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:400;line-height:1.6;color:#4D6B59;margin:0 0 28px 0;">
                &#9200; This invite expires on <strong style="color:#0C1C23;">${p.expiresAt}</strong>. After that, your spot will be released.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:12px;background-color:#BD5846;">
                    <a href="${p.inviteUrl}" style="display:inline-block;padding:14px 28px;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:600;letter-spacing:-0.01em;color:#ffffff;text-decoration:none;border-radius:12px;">
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
              <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;line-height:1.5;color:#4D6B59;margin:0;word-break:break-all;">${p.inviteUrl}</p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td class="footer-td" style="background-color:#F8EDD9;padding:22px 36px;border:1px solid #C8B596;border-top:none;border-radius:0 0 16px 16px;">
              <p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;line-height:1.6;color:#6E8880;margin:0 0 6px 0;">
                You received this because ${p.captainName} registered for a tournament and listed you as a teammate. No account is required to pay your entry.
              </p>
              <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#9D8762;margin:0;">
                &copy; Fendo Golf &nbsp;&middot;&nbsp; <a href="https://spinsociety.fendogolf.com" style="color:#9D8762;text-decoration:none;">spinsociety.fendogolf.com</a>
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

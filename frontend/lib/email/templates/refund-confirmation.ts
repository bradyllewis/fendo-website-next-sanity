interface RefundConfirmationEmailParams {
  recipientName: string
  eventTitle: string
  amountRefunded: number
  siteUrl: string
}

export function buildRefundConfirmationEmail(p: RefundConfirmationEmailParams): string {
  const amountStr = `$${(p.amountRefunded / 100).toFixed(2)}`

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Refund initiated — Fendo Golf</title>
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
                    <a href="${p.siteUrl}" style="display:block;text-decoration:none;"><img src="${p.siteUrl}/images/Fendo-golf-blue-logo-jpg.png" alt="Fendo Golf" width="116" height="auto" style="display:block;height:28px;width:auto;" /></a>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;color:#6E8880;">REFUND / INITIATED</span>
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

              <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;color:#BD5846;margin:0 0 20px 0;">PAYMENT / REFUND INITIATED</p>

              <h1 class="heading" style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:30px;font-weight:600;letter-spacing:-0.03em;line-height:1.1;color:#0C1C23;margin:0 0 16px 0;">Your refund is on the way, ${p.recipientName.split(' ')[0]}.</h1>

              <p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px;font-weight:400;line-height:1.65;color:#4D6B59;margin:0 0 28px 0;">
                A refund of <strong style="color:#0C1C23;">${amountStr}</strong> for <strong style="color:#0C1C23;">${p.eventTitle}</strong> has been initiated. Funds typically appear on your statement within 5&ndash;10 business days depending on your card issuer.
              </p>

              <!-- Summary box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8EDD9;border:1px solid #C8B596;border-radius:12px;margin:0 0 28px 0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#6E8880;margin:0 0 12px 0;">REFUND SUMMARY</p>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                      <tr>
                        <td><p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:10px;color:#6E8880;margin:0;">Event</p></td>
                        <td align="right"><p style="font-family:'Inter',-apple-system,sans-serif;font-size:13px;font-weight:600;color:#0C1C23;margin:0;">${p.eventTitle}</p></td>
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #C8B596;padding-top:8px;margin-top:4px;">
                      <tr>
                        <td><p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:10px;color:#6E8880;margin:0;">Amount Refunded</p></td>
                        <td align="right"><p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:13px;font-weight:600;color:#0C1C23;margin:0;">${amountStr} USD</p></td>
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
                      <tr>
                        <td><p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:10px;color:#6E8880;margin:0;">Status</p></td>
                        <td align="right"><p style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:12px;font-weight:600;color:#4D6B59;margin:0;">&#8635; Processing (5&ndash;10 business days)</p></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:400;line-height:1.6;color:#4D6B59;margin:0;">
                If you have questions about your refund, reply to this email and we&rsquo;ll be happy to help.
              </p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td class="footer-td" style="background-color:#F8EDD9;padding:22px 36px;border:1px solid #C8B596;border-top:none;border-radius:0 0 16px 16px;">
              <p style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;line-height:1.6;color:#6E8880;margin:0 0 6px 0;">
                Questions? Reply to this email or contact the event organizer.
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

/**
 * Official E-Receipt printer utility for Rupiksha Wallet-to-Wallet fund transfers.
 * Renders an isolated, professional, high-resolution receipt document for printing/PDF export.
 */

function sanitizeCode(code) {
  if (!code || code === 'N/A' || String(code).toLowerCase().includes('wallet transfer')) {
    return '';
  }
  return String(code).trim();
}

function generateReceiptHtml(item) {
  const isSent = item.direction === 'SENT';
  const amountStr = Number(item.amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const dateStr = item.createdAt
    ? new Date(item.createdAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'medium'
      })
    : new Date().toLocaleString('en-IN');

  const senderCode = sanitizeCode(item.senderPartyCode);
  const recipientCode = sanitizeCode(item.recipientPartyCode);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Receipt_${item.transferReference || 'Transfer'}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: #ffffff;
          color: #000000;
          padding: 24px;
          font-size: 13px;
          line-height: 1.45;
        }
        .receipt-container {
          max-width: 620px;
          margin: 0 auto;
          background: #ffffff;
          border: 2px solid #000000;
          border-radius: 12px;
          padding: 24px 28px;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 16px;
          border-bottom: 2px solid #000000;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo-img {
          height: 48px;
          width: auto;
          object-fit: contain;
        }
        .brand-name {
          font-size: 20px;
          font-weight: 900;
          color: #000000;
          line-height: 1.1;
          letter-spacing: -0.3px;
        }
        .brand-name span {
          color: #1d4ed8;
        }
        .brand-sub {
          font-size: 11px;
          font-weight: 800;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 3px;
        }
        .header-right {
          text-align: right;
        }
        .receipt-badge {
          background: #000000;
          color: #ffffff;
          font-size: 10px;
          font-weight: 900;
          padding: 4px 10px;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          display: inline-block;
        }
        .header-date {
          font-size: 11px;
          color: #000000;
          margin-top: 5px;
          font-weight: 800;
        }
        .status-banner {
          margin: 16px 0;
          padding: 14px 18px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f0fdf4;
          border: 2px solid #16a34a;
          color: #14532d;
        }
        .status-title {
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .status-badge-text {
          font-size: 11px;
          font-weight: 800;
          color: #166534;
          margin-top: 2px;
        }
        .status-amount {
          font-size: 24px;
          font-weight: 900;
          color: #000000;
          font-family: monospace;
        }
        .party-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }
        .party-box {
          border: 1.5px solid #000000;
          border-radius: 8px;
          padding: 12px 14px;
          background: #f8fafc;
        }
        .party-tag {
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .party-tag.sender { color: #1d4ed8; }
        .party-tag.receiver { color: #15803d; }
        .party-name {
          font-size: 14px;
          font-weight: 900;
          color: #000000;
          margin-bottom: 4px;
        }
        .party-detail {
          font-size: 11.5px;
          font-weight: 800;
          color: #000000;
          margin-top: 2px;
        }
        .section-title {
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          color: #000000;
          letter-spacing: 0.5px;
          margin: 14px 0 8px 0;
          padding-bottom: 4px;
          border-bottom: 2px solid #000000;
        }
        .details-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        .details-table td {
          padding: 8px 10px;
          border-bottom: 1px solid #cbd5e1;
          font-size: 12px;
        }
        .details-table tr:nth-child(even) {
          background: #f8fafc;
        }
        .details-table .label {
          color: #000000;
          font-weight: 900;
          width: 40%;
          text-transform: uppercase;
          font-size: 11px;
        }
        .details-table .value {
          color: #000000;
          font-weight: 900;
          text-align: right;
        }
        .footer-note {
          background: #f8fafc;
          border: 1.5px solid #000000;
          border-radius: 8px;
          padding: 10px 14px;
          margin-top: 14px;
          font-size: 10.5px;
          font-weight: 700;
          color: #000000;
          line-height: 1.45;
          text-align: center;
        }
        .sign-row {
          display: flex;
          justify-content: space-between;
          margin-top: 36px;
          padding: 0 16px;
        }
        .sign-box {
          text-align: center;
          width: 170px;
          border-top: 1.5px dashed #000000;
          padding-top: 6px;
          font-size: 11px;
          font-weight: 900;
          color: #000000;
        }
        @media print {
          body { background: #ffffff; padding: 0; }
          .receipt-container { border: 1.5px solid #000000; box-shadow: none; padding: 12px 18px; max-width: 100%; }
          @page { margin: 8mm 10mm; }
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="header">
          <div class="header-left">
            <img src="/logo rupiksha.png" alt="Rupiksha" class="logo-img" onerror="this.style.display='none'" />
            <div>
              <div class="brand-name">Rupiksha Services <span>Private Limited</span></div>
              <div class="brand-sub">Inter-Wallet Fund Transfer</div>
            </div>
          </div>
          <div class="header-right">
            <div class="receipt-badge">OFFICIAL RECEIPT</div>
            <div class="header-date">${dateStr}</div>
          </div>
        </div>

        <div class="status-banner">
          <div>
            <div class="status-title">${isSent ? 'Outgoing Fund Transfer' : 'Incoming Fund Transfer'}</div>
            <div class="status-badge-text">&#10003; TRANSACTION SUCCESSFUL</div>
          </div>
          <div class="status-amount">&#8377;${amountStr}</div>
        </div>

        <div class="party-grid">
          <div class="party-box">
            <div class="party-tag sender">Sender (Debited)</div>
            <div class="party-name">${item.senderName || 'Sender'}</div>
            ${senderCode ? `<div class="party-detail">Code: ${senderCode}</div>` : ''}
            ${item.senderMobile ? `<div class="party-detail">Mobile: ${item.senderMobile}</div>` : ''}
          </div>
          <div class="party-box">
            <div class="party-tag receiver">Receiver (Credited)</div>
            <div class="party-name">${item.recipientName || 'Recipient'}</div>
            ${recipientCode ? `<div class="party-detail">Code: ${recipientCode}</div>` : ''}
            ${item.recipientMobile ? `<div class="party-detail">Mobile: ${item.recipientMobile}</div>` : ''}
          </div>
        </div>

        <div class="section-title">Transaction Information</div>
        <table class="details-table">
          <tr>
            <td class="label">Reference ID</td>
            <td class="value" style="font-family: monospace;">${item.transferReference || 'N/A'}</td>
          </tr>
          <tr>
            <td class="label">Transfer Type</td>
            <td class="value">${isSent ? 'Outgoing Fund Transfer' : 'Incoming Fund Transfer'}</td>
          </tr>
          <tr>
            <td class="label">Amount</td>
            <td class="value" style="font-family: monospace;">&#8377;${amountStr}</td>
          </tr>
          <tr>
            <td class="label">Platform Fee</td>
            <td class="value">&#8377;0.00</td>
          </tr>
          <tr>
            <td class="label">Status</td>
            <td class="value" style="color: #15803d; text-transform: uppercase;">${item.status || 'SUCCESS'}</td>
          </tr>
          ${item.remarks ? `
          <tr>
            <td class="label">Remarks / Narration</td>
            <td class="value">${item.remarks}</td>
          </tr>` : ''}
          <tr>
            <td class="label">Transaction Date & Time</td>
            <td class="value">${dateStr}</td>
          </tr>
        </table>

        <div class="footer-note">
          This is an official computer-generated electronic receipt for inter-wallet fund transfers and does not require a physical signature.<br/>
          Rupiksha Digital Banking Network &bull; support@rupiksha.in
        </div>

        <div class="sign-row">
          <div class="sign-box">Sender / Customer</div>
          <div class="sign-box">Authorized Retailer Seal / Sign</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;
}

export function printWalletTransferReceipt(item) {
  if (!item) return;

  const html = generateReceiptHtml(item);

  // 1. Attempt standard popup print window
  try {
    const printWindow = window.open('', '_blank', 'width=800,height=880');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    }
  } catch (e) {
    console.warn('[printReceipt] Popup window failed, using hidden iframe:', e);
  }

  // 2. Fallback to hidden iframe (bypasses browser popup blockers entirely)
  try {
    let printFrame = document.getElementById('receipt-print-iframe');
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'receipt-print-iframe';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
    }

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
    setTimeout(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    }, 350);
  } catch (err) {
    console.error('[printReceipt] Failed to print via iframe, falling back to window.print():', err);
    window.print();
  }
}

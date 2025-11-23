interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface InvoiceData {
  orderId: string;
  orderDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  deliveryAddress: string;
  items: InvoiceItem[];
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
}

/**
 * Generate and download an invoice as PDF
 * Uses HTML-to-PDF conversion via browser print API
 */
export async function generateInvoice(data: InvoiceData): Promise<void> {
  // Create invoice HTML
  const invoiceHTML = createInvoiceHTML(data);

  // Create a new window for printing
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Popup blocked. Please allow popups to download invoice.");
  }

  printWindow.document.write(invoiceHTML);
  printWindow.document.close();

  // Wait for content to load, then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      // Close window after print dialog
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 250);
  };
}

/**
 * Create invoice HTML content
 */
function createInvoiceHTML(data: InvoiceData): string {
  const formattedDate = new Date(data.orderDate).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedTime = new Date(data.orderDate).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
  const tax = 0; // Add tax calculation if needed
  const total = data.totalAmount;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice - ${data.orderId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      padding: 40px;
      color: #333;
      background: white;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
    }
    .company-info h1 {
      font-size: 28px;
      color: #667eea;
      margin-bottom: 5px;
    }
    .company-info p {
      color: #666;
      font-size: 14px;
    }
    .invoice-meta {
      text-align: right;
    }
    .invoice-meta h2 {
      font-size: 24px;
      color: #333;
      margin-bottom: 10px;
    }
    .invoice-meta p {
      color: #666;
      font-size: 14px;
      margin: 3px 0;
    }
    .invoice-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 40px;
    }
    .detail-section h3 {
      font-size: 16px;
      color: #333;
      margin-bottom: 10px;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 5px;
    }
    .detail-section p {
      color: #666;
      font-size: 14px;
      margin: 5px 0;
      line-height: 1.6;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .items-table thead {
      background: #f5f5f5;
    }
    .items-table th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #333;
      border-bottom: 2px solid #e0e0e0;
    }
    .items-table td {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      color: #666;
    }
    .items-table tbody tr:hover {
      background: #f9f9f9;
    }
    .text-right {
      text-align: right;
    }
    .invoice-summary {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }
    .summary-table {
      width: 300px;
    }
    .summary-table tr {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
    }
    .summary-table td {
      font-size: 14px;
      color: #666;
    }
    .summary-table .total-row {
      border-top: 2px solid #333;
      padding-top: 10px;
      margin-top: 10px;
    }
    .summary-table .total-row td {
      font-size: 18px;
      font-weight: bold;
      color: #333;
    }
    .payment-info {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .payment-info h3 {
      font-size: 16px;
      color: #333;
      margin-bottom: 10px;
    }
    .payment-info p {
      color: #666;
      font-size: 14px;
      margin: 5px 0;
    }
    .invoice-footer {
      text-align: center;
      padding-top: 30px;
      border-top: 1px solid #e0e0e0;
      color: #999;
      font-size: 12px;
    }
    @media print {
      body {
        padding: 20px;
      }
      .invoice-container {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="invoice-header">
      <div class="company-info">
        <h1>LiveMart Connect</h1>
        <p>Your Trusted Shopping Partner</p>
        <p style="margin-top: 10px;">support@livemart.com</p>
      </div>
      <div class="invoice-meta">
        <h2>INVOICE</h2>
        <p><strong>Order ID:</strong> ${data.orderId}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formattedTime}</p>
      </div>
    </div>

    <div class="invoice-details">
      <div class="detail-section">
        <h3>Bill To</h3>
        <p><strong>${data.customerName}</strong></p>
        <p>${data.customerEmail}</p>
        ${data.customerPhone ? `<p>${data.customerPhone}</p>` : ""}
      </div>
      <div class="detail-section">
        <h3>Delivery Address</h3>
        <p>${data.deliveryAddress.replace(/\n/g, "<br>")}</p>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Item</th>
          <th class="text-right">Quantity</th>
          <th class="text-right">Price</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.items
          .map(
            (item) => `
          <tr>
            <td>${item.name}</td>
            <td class="text-right">${item.quantity}</td>
            <td class="text-right">₹${item.price.toFixed(2)}</td>
            <td class="text-right">₹${item.total.toFixed(2)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <div class="invoice-summary">
      <table class="summary-table">
        <tr>
          <td>Subtotal:</td>
          <td class="text-right">₹${subtotal.toFixed(2)}</td>
        </tr>
        ${tax > 0 ? `
        <tr>
          <td>Tax:</td>
          <td class="text-right">₹${tax.toFixed(2)}</td>
        </tr>
        ` : ""}
        <tr class="total-row">
          <td>Total:</td>
          <td class="text-right">₹${total.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div class="payment-info">
      <h3>Payment Information</h3>
      <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
      <p><strong>Payment Status:</strong> <span style="color: ${
        data.paymentStatus === "paid" || data.paymentStatus === "completed"
          ? "#22c55e"
          : "#f59e0b"
      };">${data.paymentStatus.toUpperCase()}</span></p>
    </div>

    <div class="invoice-footer">
      <p>Thank you for your business!</p>
      <p style="margin-top: 5px;">This is a computer-generated invoice and does not require a signature.</p>
    </div>
  </div>
</body>
</html>
  `;
}


const moment = require("moment");
const today = moment().format("DD-MM-YYYY");
const generateInvoiceHTML = (invoiceData) => {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Invoice</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f9f9f9; /* Light gray background */
        margin: 0;
        padding: 20px;
      }

      h2 {
        font-weight: 800;
      }

      .invoice {
        width: 90%;
        max-width: 900px;
        margin: 50px auto;
        padding: 20px;
        box-shadow: 3px 1px 20px 0px #80808047;
      }

      /* Header Styling */
      .invoice-header {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid #348f34;
        padding-bottom: 15px;
        margin-bottom: 20px;
      }

      .invoice-header-left {
        flex: 1;
      }

      .invoice-header-right {
        flex: 1;
        text-align: right;
      }

      /* Invoice Table */
      .invoice-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }

      .invoice-table th,
      .invoice-table td {
        border: 1px solid #000;
        padding: 12px;
        text-align: center;
        font-size: 16px;
      }

      .invoice-table th {
        background-color: #348f34;
        color: #fff;
        font-weight: bold;
      }

      .invoice-table tbody tr:nth-child(even) {
        background-color: #f2f2f2; /* Alternating row colors */
      }

      /* Invoice Total */
      .invoice-total {
        text-align: right;
        font-size: 18px;
        font-weight: bold;
        margin-top: 20px;
      }

      /* Footer Styling */
      .invoice-footer {
        text-align: center;
        margin-top: 20px;
        font-size: 14px;
        color: #555;
      }

      /* ----- */

      .logo_wrp {
        width: 200px;
        margin: 0 auto;
      }

      .logo_wrp a img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .invoice_details {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
      }
    </style>
  </head>
  <body>
    <div class="invoice">
      <div class="invoice-header">
        <div class="logo_wrp">
          <a href="https://imgbb.com/"
            ><img src="https://i.ibb.co/99LYhZ64/logo.png" alt="logo"
          /></a>
        </div>
        <div class="invoice_details">
          <div class="invoice-header-left">
            <h2>Amafhh Food</h2>
            <p>123 Main Street, Cityville</p>
            <p>Email: amafhhfoodsinfo@gmail.com</p>
            <p>Phone: +91 79235-78945</p>
          </div>
          <div class="invoice-header-right">
            <h2>Invoice</h2>
            <p>Invoice Number: 10524652</p>
            <p>Date: ${today}</p>
          </div>
        </div>
      </div>

      <table class="invoice-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
                  ${invoiceData.items
                    .map(
                      (item) => `
                      <tr>
                          <td>${item.name}</td>
                          <td>${item.quantity}</td>
                          <td>₹${item.price.toFixed(2)}</td>
                          <td>₹${(item.quantity * item.price).toFixed(2)}</td>
                      </tr>
                  `
                    )
                    .join("")}
              </tbody>
          </table>

          <div class="invoice-total">
              <p>Subtotal: ₹${invoiceData.subtotal.toFixed(2)}</p>
              <p>Tax (0%): ₹${invoiceData.tax.toFixed(2)}</p>
              <p>Total: ₹${invoiceData.total.toFixed(2)}</p>
          </div>

      <div class="invoice-footer">
        <div class="text-center mt-3">
          <p>Thank you for your support</p>
        </div>
      </div>
    </div>
  </body>
</html>
  `;
};

module.exports = generateInvoiceHTML;

const puppeteer = require("puppeteer");
const fs = require("fs");
const generateInvoiceHTML = require("./invoiceTemplate");

const generateInvoicePDF = async (invoiceData, filePath) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const htmlContent = generateInvoiceHTML(invoiceData);
  await page.setContent(htmlContent);

  await page.pdf({
    path: filePath,
    format: "A4",
    printBackground: true,
  });

  await browser.close();
};

module.exports = generateInvoicePDF;

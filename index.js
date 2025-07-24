const http = require("http");
const express = require("express");
const socketService = require("./src/services/socket/socket.service.js");
const socketIo = require('socket.io');
// import the express module
const cors = require("cors");
const mongoose = require("mongoose");
const schedule = require("node-schedule");
const logger = require("morgan");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");
const path = require("path");
const AppRoutes = require("./src/routes/index.js");
const { MONGO_URI } = require("./src/config/config.js");
const {
  paypalGenerateAccessToken,
} = require("./src/services/paypal/paypal.js");
const { fetchPayments } = require("./src/services/razorpay/razorpay.js");
const sendMail = require("./src/utils/mailer.js");
const generateInvoice = require("./src/common/invoice.js");
const generateInvoicePDF = require("./src/common/invoice.js");
const webPush = require("web-push");
const generateRandomString = require("./src/common/randomString.js");
const port = process.env.PORT || 8888;

const app = express();
const server = http.createServer(app);



const io = socketService.init(server);



app.use(cors());
app.use(express.json());

app.use(logger("dev"));

/**
 * Enable serving static files from the `public` directory
 */
app.use("/public", express.static("public"));
app.use("/assets", express.static("assets"));

app.use("/api", AppRoutes);

const billsDirectory = path.join(__dirname, "/src/bills");

app.get("/mail", (req, res) => {
  try {
    const invoiceData = {
      invoiceNumber: "Amafhh-1234",
      date: new Date().toLocaleDateString(),
      items: [
        { name: "Thal", quantity: 1, price: 550 },
        { name: "Burger", quantity: 1, price: 100 },
      ],
      subtotal: 650,
      tax: 50, // 8% tax
      total: 700,
    };

    const filePath = `${billsDirectory}/bill-${generateRandomString()}.pdf`;
    const customerEmail = "kishan9101@gmail.com";

    // Generate PDF and Send Email
    generateInvoicePDF(invoiceData, filePath)
      .then(() =>
        sendMail({
          filename: "Bill Details.pdf",
          email: customerEmail,
          filePath: filePath,
        })
      )
      .catch((error) => console.error("Error:", error));

    // sendMail({});

    res.send("message Send successfully");
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "internal server error " });
  }
});

/**
 * Mount the Swagger UI onto the Express app
 * This function is used to mount the Swagger UI onto the `/api-docs` path
 * @function
 * @param {string} path The path to mount the Swagger UI on
 * @param {object} swaggerDocument The Swagger document to use
 */

const CSS_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui.min.css";

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, { customCssUrl: CSS_URL })
);
// Socket connection handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    server.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((err) => console.log(err));

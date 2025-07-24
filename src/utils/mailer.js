const nodemailer = require("nodemailer");
const sendMail = async (option) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 587,
      secure: false,
      //   requireTLS: true,
      auth: {
        user: "info@amafhhfoods.in",
        pass: "Amafhh@5253",
      },
    });

    let mailOption;
    if (!option.filename) {
      mailOption = {
        from: "info@amafhhfoods.in",
        to: option.email,
        subject: option.subject,
        html: option.message,
      };
    } else {
      mailOption = {
        from: "info@amafhhfoods.in",
        to: option.email,
        subject: "Your Invoice",
        text: "Please find the attached invoice.",
        attachments: [
          {
            filename: option.filename,
            path: option.filePath,
          },
        ],
      };
    }
    const result = await transporter.sendMail(mailOption);

    transporter.verify(function (error, success) {
      if (error) {
        console.log(error);
      } else {
        console.log("Server is ready to take our messages");
      }
    });
  } catch (error) {
    console.log(error);
  }
};

module.exports = sendMail;

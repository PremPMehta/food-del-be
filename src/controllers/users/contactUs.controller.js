const ContactUsModel = require("../../models/contactUs.model");

const ContactUs = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    const newMessages = new ContactUsModel({ name, email, message });

    let = await newMessages.save();

    return res.status(200).json({ message: "Feedback Added successfully...!" });
  } catch (error) {
    return res.status(500).json({ message: "Please fill Correct value" });
  }
};

module.exports = { ContactUs };

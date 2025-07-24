const ContactUsModel = require("../../models/contactUs.model");

const getAllMessages = async (req, res) => {
  try {
    let foundMessage = await ContactUsModel.find();
    if (!foundMessage) {
      return res.status(400).json({ message: "no message founded" });
    }
    return res
      .status(200)
      .json({ message: "Fetch all messages successfully", foundMessage });
  } catch (error) {
    return res
      .status(error.status ?? 500)
      .json({ message: error?.message ?? "Internal server error", error });
  }
};

const updateMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const findMessages = await ContactUsModel.findOne({ _id: id });
    if (!findMessages) {
      return res.status(400).json({ message: "you found invalid message" });
    }
    let upadtedMessage = await ContactUsModel.findByIdAndUpdate(
      { _id: findMessages._id },
      { message },
      { new: true }
    );
    return res
      .status(200)
      .json({ message: "update messages successfully", upadtedMessage });
  } catch (error) {
    return res
      .status(error.status ?? 500)
      .json({ message: error?.message ?? "Internal server error", error });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const findMessages = await ContactUsModel.findOne({ _id: id });
    if (!findMessages) {
      return res.status(400).json({ message: "you found invalid message" });
    }
    await ContactUsModel.findByIdAndDelete({ _id: findMessages._id });
    return res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    return res
      .status(error.status ?? 500)
      .json({ message: error?.message ?? "Internal server error", error });
  }
};

module.exports = { updateMessage, deleteMessage, getAllMessages };

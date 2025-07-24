const { BACKEND_URL } = require("../../config/config");

const uploadAssetFile = (req, res) => {
  try {
    if (!req.file) {
      throw new Error({
        status: 400,
        message: "No file uploaded",
      });
    }

    const file_url = BACKEND_URL + "/" + req.file.path?.replace("\\", "/");

    // If everything is good, proceed with the request
    res.status(200).json({ message: "File uploaded successfully!", file_url });
  } catch (error) {
    return res.status(error.status ?? 500).json({
      message: error?.code ?? error?.message ?? "Internal server error",
      error,
    });
  }
};

module.exports = {
  uploadAssetFile,
};

const jwt = require("jsonwebtoken");
const { verifyPassword, signJwtToken, encrypt } = require("../../utils/common");
const AdminUserModel = require("../../models/users-admin.model");
const yup = require("yup");
const mongoose = require("mongoose");
const { USER_STATUS, USER_ROLE } = require("../../utils/constants");

// Define login schema for admin
const loginSchema = yup.object().shape({
  email: yup.string().email().required("Email is required"),
  password: yup
    .string()
    .min(6, "Password must be at least 6 characters long")
    .required("Password is required"),
  remember: yup.boolean().optional().default(false),
});
// Define login API for admin
const loginAdminUser = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction(); // Start the transaction immediately after creating the session
  try {
    // Validate request body
    await loginSchema.validate(req.body);

    const { email, password, remember } = req.body;

    // Find user by email
    const user = await AdminUserModel.findOne({
      email,
      role: { $in: [USER_ROLE.ADMIN, USER_ROLE.SUPERADMIN] },
    }).session(session);

    // If user not found
    if (!user) {
      throw new Error({
        status: 400,
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isValid = await verifyPassword(user.password, password);
    console.log(isValid);
    // If password is not valid
    if (!isValid) {
      return res.status(400).json({
        status: 400,
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = signJwtToken(
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        kitchen: user.kitchen,
      },
      remember ? "7d" : "1h"
    );

    const data = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      kitchen: user.kitchen,
      expires_at: new Date(jwt.decode(token).exp * 1000),
    };

    await session.commitTransaction();
    session.endSession();
    res.status(200).json({ data, token });
  } catch (error) {
    console.log(error);
    await session.abortTransaction();
    session.endSession();
    res
      .status(error.status ?? 500)
      .json({ message: error?.message ?? "Internal server error", error });
  }
};

const createAdminSchema = yup.object().shape({
  name: yup
    .string()
    .required("Name cannot be left blank.")
    .nullable()
    .test("notEmpty", "Name is required.", (value) => value?.trim().length > 0),
  email: yup
    .string()
    .email("Email must be a valid email address.")
    .required("Email cannot be left blank."),
  password: yup
    .string()
    .required("Password cannot be left blank.")
    .test(
      "notEmpty",
      "Password is required.",
      (value) => value?.trim().length > 0
    ),
  phone: yup
    .string()
    .required("Phone cannot be left blank.")
    .test(
      "notEmpty",
      "Phone is required.",
      (value) => value?.trim().length > 0
    ),
  role: yup
    .string()
    .oneOf(
      Object.values(USER_ROLE),
      `Role must be one of [${Object.values(USER_ROLE).join(", ")}].`
    )
    .default(USER_ROLE.ADMIN),
  status: yup
    .string()
    .oneOf(
      Object.values(USER_STATUS),
      `Status must be one of [${Object.values(USER_STATUS).join(", ")}].`
    )
    .default(USER_STATUS.PENDING),
  kitchen: yup
    .array()
    .of(
      yup
        .string()
        .matches(
          /^[0-9a-fA-F]{24}$/,
          "Each kitchen ID must be a valid MongoDB ObjectId."
        )
    ),
});

const createAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();
  try {
    await createAdminSchema.validate(req.body);
    const { name, email, password, phone, role, status, kitchen } = req.body;

    const user = await AdminUserModel.findOne({
      email,
      role: USER_ROLE.ADMIN || USER_ROLE.SUPERADMIN,
    }).session(session);

    // If user not found
    if (user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Email Already Registered " });
    }

    const hasedPassword = await encrypt(password);

    const admin = new AdminUserModel({
      name,
      email,
      password: hasedPassword,
      phone,
      role,
      status,
      kitchen,
    });

    let newAdmin = await admin.save({ session });
    /**
     * Commit the transaction
     */
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "new admin created successfully",
      data: newAdmin,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.log(error);
    res
      .status(error.status ?? 500)
      .json({ message: error?.message ?? "Internal server error", error });
  }
};

const updateAdminSchema = yup.object().shape({
  name: yup.string().nullable(), // Optional string field
  email: yup.string().email("Email must be a valid email address.").nullable(), // Optional email field
  password: yup.string().nullable(),
  phone: yup.string().nullable(), // Optional string field
  role: yup
    .string()
    .oneOf(
      Object.values(USER_ROLE),
      `Role must be one of [${Object.values(USER_ROLE).join(", ")}].`
    )
    .default(USER_ROLE.ADMIN),
  status: yup
    .string()
    .oneOf(
      Object.values(USER_STATUS),
      `Status must be one of [${Object.values(USER_STATUS).join(", ")}].`
    )
    .default(USER_STATUS.PENDING),
  kitchen: yup
    .array()
    .of(
      yup
        .string()
        .matches(
          /^[0-9a-fA-F]{24}$/,
          "Each kitchen ID must be a valid MongoDB ObjectId."
        )
    )
    .nullable(), // Optional array field
});

const updateAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();
  try {
    await updateAdminSchema.validate(req.body);
    const { id } = req.params;

    const { name, email, phone, role, status, kitchen } = req.body;

    const user = await AdminUserModel.findOne({ _id: id }).session(session);

    // If user not found
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Please Create Admin first " });
    }

    if (req.body.password && req.body.password !== "") {
      const hasedPassword = await encrypt(req.body.password);

      const updateAdmin = await AdminUserModel.findByIdAndUpdate(
        { _id: user._id },
        { name, email, password: hasedPassword, phone, role, status, kitchen },
        { new: true }
      ).session(session);
    } else {
      const updateAdmin = await AdminUserModel.findByIdAndUpdate(
        { _id: user._id },
        { name, email, phone, role, status, kitchen },
        { new: true }
      ).session(session);
    }

    /**
     * Commit the transaction
     */
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "admin updated successfully",
      // data: updateAdmin,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.log(error);
    res
      .status(error.status ?? 500)
      .json({ message: error?.message ?? "Internal server error", error });
  }
};

const removeAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    console.log(id);
    const findAdmin = await AdminUserModel.findOne({ _id: id });
    if (!findAdmin) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "no admin are found" });
    }
    findAdmin.deleted = true;
    findAdmin.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "admin deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res
      .status(error.status ?? 500)
      .json({ message: error?.message ?? "Internal server error", error });
  }
};

const querySchema = yup.object().shape({
  page: yup.number().integer().min(1).default(1),
  limit: yup.number().integer().min(1).max(100).default(10),
  sortBy: yup
    .string()
    .oneOf(["name", "role", "createdAt"], "Invalid sort field")
    .default("createdAt"),
  sortOrder: yup
    .string()
    .oneOf(["asc", "desc"], "Invalid sort order")
    .default("desc"),
  search: yup.string().optional(),
});

const getAdmins = async (req, res) => {
  try {
    // Validate query parameters
    const validatedQuery = await querySchema.validate(req.query, {
      abortEarly: false,
    });

    const { page, limit, sortBy, sortOrder, search } = validatedQuery;

    // Build the query
    const query = {
      deleted: false, // Exclude soft-deleted items
    };

    // If a search term is provided , include it in the query
    if (search) {
      // Add search condition for title, description, categories, and options
      query.$or = [
        { name: { $regex: search, $options: "i" } }, // Case insensitive search in title
        { role: { $regex: search, $options: "i" } }, // Case insensitive search in description
      ];
    }

    // Fetch the total count of kitchens matching the query
    const totalAdmin = await AdminUserModel.countDocuments(query);

    // Fetch the paginated and sorted kitchens
    const admins = await AdminUserModel.aggregate([
      {
        $match: query,
      },
      { $sort: { [sortBy]: sortOrder === "asc" ? 1 : -1, _id: 1 } }, // Sort by sortBy and a secondary field like _id
      { $skip: (page - 1) * limit }, // Skip the number of documents based on the page
      { $limit: limit }, // Limit the number of documents returned
    ]);

    let adminsData = admins.map((item) => ({
      _id: item._id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      role: item.role,
      status: item.role,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      kitchen: item.kitchen,
    }));
    // return the response
    return res.status(200).json({
      success: true,
      data: adminsData,
      pagination: {
        total: totalAdmin,
        page,
        limit,
        totalPages: Math.ceil(totalAdmin / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching getAdmins:", error);
    res.status(400).json({
      success: false,
      message: error.errors || "Error fetching getAdmins",
    });
  }
};

const getAdminById = async (req, res) => {
  const { id } = req.params;

  try {
    /** Find the combo by Id */
    const adminsData = await AdminUserModel.findOne(
      { _id: id, deleted: false },
      { password: 0, deleted: 0 } // Exclude password and deleted fields
    );
    if (!adminsData) {
      return res.status(404).json({
        message: "Admin not found on this id.",
      });
    }

    res.status(200).json({
      message: "Admin fetched successfully.",
      admins: adminsData,
      success: true,
    });
  } catch (error) {
    /**
     * Log the error
     */
    console.error("Error getting admins:", error);

    /**
     * Return an error response
     */
    res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error getting admins", error });
  }
};

module.exports = {
  loginAdminUser,
  createAdmin,
  updateAdmin,
  removeAdmin,
  getAdmins,
  getAdminById,
};

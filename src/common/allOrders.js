const yup = require("yup");
const querySchema = yup.object().shape({
  page: yup.number().integer().min(1).default(1),
  limit: yup.number().integer().min(1).max(100).default(10),
  sortBy: yup
    .string()
    .oneOf(["title", "createdAt", "updatedAt"], "Invalid sort field")
    .default("createdAt"),
  sortOrder: yup
    .string()
    .oneOf(["asc", "desc"], "Invalid sort order")
    .default("desc"),
  search: yup.string().optional(),
});

const getOrders = async (req, res, model, orderType) => {
  try {
    const userId = req.user._id;

    const validatedQuery = await querySchema.validate(req.query, {
      abortEarly: false,
    });

    const { page, limit, sortBy, sortOrder, search } = validatedQuery;

    // Build the query
    const query = {
      orderType: orderType, // Ensure we only fetch specific order type
      user: userId,
    };

    // If a search term is provided, include it in the query
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Fetch the total count of orders matching the query
    const totalOrders = await model.countDocuments(query);

    // Paginate the query
    const orders = await model
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ [sortBy]: sortOrder });

    return res.status(200).json({
      success: true,
      orders: orders,
      pagination: {
        total: totalOrders,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalOrders / limit),
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

const getOrderById = async (req, res, model) => {
  try {
    const getOrder = await model.findById(req.params.id);

    if (!getOrder) {
      return res.status(404).json({
        success: false,
        error: "Thal order not found",
      });
    }

    return res.status(200).json({
      success: true,
      order: getOrder,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = { getOrders, getOrderById };

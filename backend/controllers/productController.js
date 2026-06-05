const prisma = require("../config/db");


// CREATE PRODUCT
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      price,
      stock,
      imageUrl,
      category,
    } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        price,
        stock,
        imageUrl,
        category,
      },
    });

    res.status(201).json(product);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Failed to create product",
    });
  }
};


// GET ALL PRODUCTS
exports.getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(products);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Failed to fetch products",
    });
  }
};


// GET SINGLE PRODUCT
exports.getSingleProduct = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await prisma.product.findUnique({
      where: {
        slug,
      },
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.json(product);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Failed to fetch product",
    });
  }
};
const express = require("express");

const router = express.Router();

const {
  createProduct,
  getProducts,
  getSingleProduct,
} = require("../controllers/productController");


// CREATE PRODUCT
router.post("/", createProduct);


// GET ALL PRODUCTS
router.get("/", getProducts);


// GET SINGLE PRODUCT
router.get("/:slug", getSingleProduct);

module.exports = router;
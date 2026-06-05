const express = require("express");

const router = express.Router();

const {
  addToCart,
  getCart,
  updateCartQuantity,
  removeCartItem,
} = require("../controllers/cartController");


// ADD TO CART
router.post("/", addToCart);


// GET CART
router.get("/", getCart);


// UPDATE QUANTITY
router.put("/:id", updateCartQuantity);


// REMOVE ITEM
router.delete("/:id", removeCartItem);

module.exports = router;
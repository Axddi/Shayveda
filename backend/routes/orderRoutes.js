const express = require("express");

const router = express.Router();

const {
  createOrder,
  getOrders,
  trackOrder,
} = require("../controllers/orderController");


// CREATE ORDER
router.post("/", createOrder);


// GET ORDERS
router.get("/", getOrders);


// TRACK ORDER
router.get("/track/:identifier", trackOrder);

module.exports = router;

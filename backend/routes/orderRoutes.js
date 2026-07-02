const express = require("express");

const router = express.Router();

const {
  createOrder,
  getShiprocketSetup,
  getOrders,
  resyncOrderToShiprocket,
  trackOrder,
} = require("../controllers/orderController");


// CREATE ORDER
router.post("/", createOrder);


// GET ORDERS
router.get("/", getOrders);

// SHIPROCKET SETUP
router.get("/shiprocket/setup", getShiprocketSetup);


// TRACK ORDER
router.get("/track/:identifier", trackOrder);

// RETRY SHIPROCKET SYNC
router.post("/:id/shiprocket-sync", resyncOrderToShiprocket);

module.exports = router;

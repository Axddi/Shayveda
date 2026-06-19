const express = require("express");

const router = express.Router();

const {
  createRazorpayOrder,
  verifyPayment,
} = require("../controllers/paymentController");


router.post(
  "/create-order",
  createRazorpayOrder
);
router.post(
  "/verify",
  verifyPayment
);
router.post(
  "/verify-payment",
  verifyPayment
);


module.exports = router;

const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: (process.env.RAZORPAY_KEY_ID || "").trim(),
  key_secret: (process.env.RAZORPAY_KEY_SECRET || "").trim(),
});

module.exports = razorpay;

const razorpay = require("../config/razorpay");
const prisma = require("../config/db");
const {
  calculateOrderPricing,
  normalizePaymentMethod,
} = require("../services/pricingService");
const {
  createOrderRecord,
} = require("./orderController");

const crypto = require("crypto");

function envValue(name) {
  return (process.env[name] || "").trim();
}

function statusError(error) {
  return error.statusCode || 500;
}

// CREATE RAZORPAY ORDER
exports.createRazorpayOrder = async (req, res) => {

  try {

    const {
      items,
      paymentMethod,
    } = req.body;


    const pricing = await calculateOrderPricing(
      items,
      paymentMethod
    );


    // CREATE RAZORPAY ORDER
    const options = {
      amount: Math.round(pricing.finalAmount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };


    const razorpayOrder =
      await razorpay.orders.create(options);


    res.status(200).json({

      message:
        "Razorpay order created",

      razorpayOrder,

      pricing: {
        subtotal: pricing.subtotal,
        discountAmount: pricing.discountAmount,
        delivery: pricing.deliveryCharge,
        finalAmount: pricing.finalAmount,
      },

      keyId: envValue("RAZORPAY_KEY_ID"),
    });

  } catch (error) {

    console.log(error);

    res.status(statusError(error)).json({
      message:
        "Failed to create Razorpay order",
      error: error.message,
    });

  }
};
// VERIFY PAYMENT
exports.verifyPayment = async (req, res) => {

  try {

    const {

      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,

      customerName,
      phone,
      email,
      addressLine,
      city,
      state,
      pincode,

      paymentMethod,
      items,

    } = req.body;

    const existingOrder =
      await prisma.order.findFirst({
        where: {
          razorpayPaymentId:
            razorpay_payment_id,
        },
      });

    if (existingOrder) {
      return res.status(200).json({
        message:
          "Payment already verified",
        order: existingOrder,
      });
    }

    // GENERATE SIGNATURE
    const body =
      razorpay_order_id +
      "|" +
      razorpay_payment_id;


    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          envValue("RAZORPAY_KEY_SECRET")
        )
        .update(body.toString())
        .digest("hex");


    // VERIFY SIGNATURE
    if (
      expectedSignature !==
      razorpay_signature
    ) {

      return res.status(400).json({
        message:
          "Invalid payment signature",
      });
    }

    // CREATE FINAL ORDER (persist razorpay ids)
    const order = await createOrderRecord(
      {
        customerName,
        phone,
        email,
        addressLine,
        city,
        state,
        pincode,
        paymentMethod:
          normalizePaymentMethod(paymentMethod),
        items,
      },
      "PAID",
      {
        razorpayOrderId:
          razorpay_order_id,
        razorpayPaymentId:
          razorpay_payment_id,
        razorpaySignature:
          razorpay_signature,
      }
    );


    res.status(200).json({

      message:
        "Payment verified successfully",

      order,
    });

  } catch (error) {

    console.log(error);

    res.status(statusError(error)).json({
      message:
        "Payment verification failed",
      error: error.message,
    });

  }
};

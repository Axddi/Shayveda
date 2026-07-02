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

function razorpayStatus(error) {
  if (error.statusCode === 401) {
    return 401;
  }

  return statusError(error);
}

function publicErrorMessage(error, fallback) {
  const message = error.message || "";

  if (
    message.includes("Can't reach database server") &&
    message.includes("localhost")
  ) {
    return (
      "Database is not reachable from Vercel. " +
      "Set DATABASE_URL in Vercel to a hosted MySQL database, not localhost."
    );
  }

  return message || fallback;
}

// CREATE RAZORPAY ORDER
exports.createRazorpayOrder = async (req, res) => {

  try {

    const {
      items,
      paymentMethod,
    } = req.body;

    if (!envValue("RAZORPAY_KEY_ID") || !envValue("RAZORPAY_KEY_SECRET")) {
      return res.status(500).json({
        message:
          "Razorpay credentials are not configured",
      });
    }


    const pricing = await calculateOrderPricing(
      items,
      paymentMethod
    );

    const amount = Math.round(pricing.finalAmount * 100);

    if (amount < 100) {
      return res.status(400).json({
        message:
          "Razorpay amount must be at least 100 paise",
      });
    }


    // CREATE RAZORPAY ORDER
    const options = {
      amount,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };


    const razorpayOrder =
      await razorpay.orders.create(options);


    res.status(200).json({

      message:
        "Razorpay order created",

      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
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

    res.status(razorpayStatus(error)).json({
      message:
        "Failed to create Razorpay order",
      error: publicErrorMessage(
        error,
        "Unable to create Razorpay order"
      ),
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

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        message:
          "Missing Razorpay payment verification fields",
      });
    }

    if (!envValue("RAZORPAY_KEY_SECRET")) {
      return res.status(500).json({
        message:
          "Razorpay key secret is not configured",
      });
    }

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
        success: true,
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
        success: false,
      });
    }

    if (
      !customerName ||
      !phone ||
      !addressLine ||
      !city ||
      !state ||
      !pincode ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        message:
          "Missing order details after payment verification",
        success: false,
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

      success: true,
      order,
    });

  } catch (error) {

    console.log(error);

    res.status(statusError(error)).json({
      message:
        "Payment verification failed",
      error: publicErrorMessage(
        error,
        "Unable to verify payment"
      ),
    });

  }
};

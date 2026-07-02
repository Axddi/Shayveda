const prisma = require("../config/db");
const {
  calculateOrderPricing,
  normalizePaymentMethod,
} = require("../services/pricingService");
const {
  createShiprocketOrder,
  envValue,
  getPickupLocations,
  isShiprocketConfigured,
  trackByAwb,
  trackByOrder,
} = require("../services/shiprocketService");
const {
  sendOrderConfirmationEmail,
} = require("../services/emailService");

function createOrderNumber() {
  const stamp = new Date()
    .toISOString()
    .slice(2, 10)
    .replace(/-/g, "");

  const random =
    Math.floor(1000 + Math.random() * 9000);

  return `SHY-${stamp}-${random}`;
}

function statusError(error) {
  return error.statusCode || 500;
}

function requireAdminToken(req, res) {
  const expectedToken =
    process.env.ADMIN_API_TOKEN || "";

  if (
    !expectedToken &&
    process.env.NODE_ENV !== "production"
  ) {
    return true;
  }

  const actualToken =
    req.headers["x-admin-token"] ||
    req.query.adminToken;

  if (expectedToken && actualToken === expectedToken) {
    return true;
  }

  res.status(401).json({
    message: "Admin token is required",
  });

  return false;
}

async function syncOrderToShiprocket(orderId) {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  try {
    const shipping = await createShiprocketOrder(order);

    if (shipping.skipped) {
      return prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          shiprocketStatus: shipping.message,
        },
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
        },
      });
    }

    return prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        shiprocketOrderId:
          shipping.shiprocketOrderId
            ? String(shipping.shiprocketOrderId)
            : undefined,
        shiprocketShipmentId:
          shipping.shiprocketShipmentId
            ? String(shipping.shiprocketShipmentId)
            : undefined,
        shiprocketAwbCode:
          shipping.shiprocketAwbCode
            ? String(shipping.shiprocketAwbCode)
            : undefined,
        shiprocketCourierName:
          shipping.shiprocketCourierName
            ? String(shipping.shiprocketCourierName)
            : undefined,
        shiprocketStatus: (() => {
          if (shipping.createResponse) {
            if (shipping.createResponse.error) return String(shipping.createResponse.error).slice(0, 190);
            if (shipping.createResponse.message) return String(shipping.createResponse.message).slice(0, 190);
            if (shipping.createResponse.response) {
              try {
                return JSON.stringify(shipping.createResponse.response).slice(0, 190);
              } catch {
                return String(shipping.createResponse.response).slice(0, 190);
              }
            }
            return JSON.stringify(shipping.createResponse).slice(0, 190);
          }

          if (shipping.assignResponse && shipping.assignResponse.error) return String(shipping.assignResponse.error).slice(0, 190);

          return "SHIPROCKET_ORDER_CREATED";
        })(),
        shiprocketTrackingUrl:
          shipping.shiprocketAwbCode
            ? `https://shiprocket.co/tracking/${shipping.shiprocketAwbCode}`
            : undefined,
      },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });
  } catch (error) {
    console.log(error);

    return prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        shiprocketStatus:
          `SHIPROCKET_FAILED: ${error.message}`.slice(0, 190),
      },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });
  }
}

async function createOrderRecord(payload, paymentStatus, paymentData = {}) {
  const pricing = await calculateOrderPricing(
    payload.items,
    payload.paymentMethod
  );

  const order = await prisma.order.create({
    data: {

      orderNumber: createOrderNumber(),

      customerName: payload.customerName,
      phone: payload.phone,
      email: payload.email,
      addressLine: payload.addressLine,
      city: payload.city,
      state: payload.state,
      pincode: payload.pincode,

      totalAmount: pricing.subtotal,
      discountAmount: pricing.discountAmount,
      deliveryCharge: pricing.deliveryCharge,
      finalAmount: pricing.finalAmount,

      paymentMethod: pricing.paymentMethod,
      paymentStatus,

      orderStatus: "PLACED",

      ...paymentData,

      orderItems: {
        create: pricing.orderItemsData,
      },
    },

    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
    },
  });

  const syncedOrder =
    await syncOrderToShiprocket(order.id);

  sendOrderConfirmationEmail(syncedOrder)
    .then((result) => {
      if (!result?.skipped) {
        console.log(
          `Order email sent for ${syncedOrder.orderNumber || syncedOrder.id}`
        );
      }
    })
    .catch((error) => {
      console.error(
        `Order email failed for ${syncedOrder.orderNumber || syncedOrder.id}: ${error.message}`
      );
    });

  return syncedOrder;
}


// CREATE ORDER
exports.createOrder = async (req, res) => {
  try {

    const {
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

    const normalizedPaymentMethod =
      normalizePaymentMethod(paymentMethod);

    const order = await createOrderRecord(
      {
        customerName,
        phone,
        email,
        addressLine,
        city,
        state,
        pincode,
        paymentMethod: normalizedPaymentMethod,
        items,
      },
      normalizedPaymentMethod === "COD"
        ? "PENDING"
        : "PAID"
    );


    res.status(201).json({
      message: "Order placed successfully",
      order,
    });

  } catch (error) {

    console.log(error);

    res.status(statusError(error)).json({
      message: "Failed to create order",
      error: error.message,
    });

  }
};



// GET ALL ORDERS
exports.getOrders = async (req, res) => {
  try {

    const orders = await prisma.order.findMany({

      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });


    res.json(orders);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Failed to fetch orders",
    });

  }
};


// TRACK ORDER
exports.trackOrder = async (req, res) => {
  try {
    const identifier =
      req.params.identifier?.trim();

    if (!identifier) {
      return res.status(400).json({
        message: "Order ID or AWB is required",
      });
    }

    const numericId = Number(identifier);

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          {
            orderNumber: identifier,
          },
          Number.isInteger(numericId)
            ? {
                id: numericId,
              }
            : undefined,
          {
            shiprocketAwbCode: identifier,
          },
          {
            shiprocketOrderId: identifier,
          },
          {
            shiprocketShipmentId: identifier,
          },
        ].filter(Boolean),
      },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    let tracking = null;
    let trackingError = null;

    if (isShiprocketConfigured()) {
      try {
        if (order?.shiprocketAwbCode) {
          tracking = await trackByAwb(order.shiprocketAwbCode);
        } else if (!order) {
          tracking = await trackByAwb(identifier);
        } else if (order.shiprocketOrderId) {
          tracking = await trackByOrder(
            order.shiprocketOrderId,
            envValue("SHIPROCKET_CHANNEL_ID")
          );
        }
      } catch (error) {
        trackingError = error.message;
      }
    }

    if (!order && !tracking) {
      return res.status(404).json({
        message: trackingError || "Order not found",
      });
    }

    res.json({
      order,
      tracking,
      trackingError,
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Failed to track order",
      error: error.message,
    });
  }
};

exports.createOrderRecord = createOrderRecord;
exports.syncOrderToShiprocket = syncOrderToShiprocket;

exports.getShiprocketSetup = async (req, res) => {
  try {
    if (!requireAdminToken(req, res)) {
      return;
    }

    if (!isShiprocketConfigured()) {
      return res.json({
        configured: false,
        message: "Shiprocket credentials are not configured",
      });
    }

    const pickupInfo = await getPickupLocations();

    res.json({
      configured: true,
      pickupLocationCount:
        pickupInfo.locations.length,
      pickupLocations:
        pickupInfo.locations,
      raw: pickupInfo.raw,
    });
  } catch (error) {
    res.status(statusError(error)).json({
      message: "Failed to check Shiprocket setup",
      error: error.message,
      response: error.response,
    });
  }
};

exports.resyncOrderToShiprocket = async (req, res) => {
  try {
    if (!requireAdminToken(req, res)) {
      return;
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Valid order id is required",
      });
    }

    const order =
      await syncOrderToShiprocket(id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    res.json({
      message: "Shiprocket sync attempted",
      order,
    });
  } catch (error) {
    res.status(statusError(error)).json({
      message: "Failed to sync Shiprocket order",
      error: error.message,
    });
  }
};

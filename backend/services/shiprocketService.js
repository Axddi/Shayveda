const SHIPROCKET_TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function envValue(name) {
  return (process.env[name] || "").trim();
}

function shiprocketBaseUrl() {
  return (
    envValue("SHIPROCKET_API_BASE") ||
    "https://apiv2.shiprocket.in/v1/external"
  ).replace(/\/$/, "");
}

function isShiprocketConfigured() {
  return Boolean(
    envValue("SHIPROCKET_EMAIL") &&
      envValue("SHIPROCKET_PASSWORD")
  );
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text,
    };
  }
}

async function shiprocketFetch(path, options = {}) {
  const response = await fetch(`${shiprocketBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const message =
      data.message ||
      data.error ||
      `Shiprocket request failed with status ${response.status}`;

    const error = new Error(message);
    error.statusCode = response.status;
    error.response = data;
    throw error;
  }

  return data;
}

async function getShiprocketToken() {
  if (
    cachedToken &&
    Date.now() < cachedTokenExpiresAt
  ) {
    return cachedToken;
  }

  if (!isShiprocketConfigured()) {
    const error = new Error("Shiprocket credentials are not configured");
    error.statusCode = 500;
    throw error;
  }

  const data = await shiprocketFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: envValue("SHIPROCKET_EMAIL"),
      password: envValue("SHIPROCKET_PASSWORD"),
    }),
  });

  if (!data.token) {
    const error = new Error("Shiprocket login did not return a token");
    error.response = data;
    throw error;
  }

  cachedToken = data.token;
  cachedTokenExpiresAt =
    Date.now() + SHIPROCKET_TOKEN_TTL_MS;

  return cachedToken;
}

async function authorizedShiprocketFetch(path, options = {}) {
  const token = await getShiprocketToken();

  return shiprocketFetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

function toShiprocketPaymentMethod(paymentMethod) {
  return paymentMethod === "COD"
    ? "COD"
    : "Prepaid";
}

function pickupLocationName() {
  return (
    envValue("SHIPROCKET_PICKUP_LOCATION") ||
    envValue("SHIPROCKET_PICKUP_NAME") ||
    "Home"
  );
}

function readPickupLocations(data) {
  const candidates = [
    data?.data?.shipping_address,
    data?.data?.recent_addresses,
    data?.shipping_address,
    data?.recent_addresses,
  ];

  return candidates.flatMap((candidate) => {
    if (!candidate) {
      return [];
    }

    return Array.isArray(candidate)
      ? candidate
      : [candidate];
  });
}

async function getPickupLocations() {
  const data = await authorizedShiprocketFetch(
    "/settings/company/pickup"
  );

  return {
    raw: data,
    locations: readPickupLocations(data),
  };
}

function pickupPayloadFromEnv() {
  const location = pickupLocationName();

  return {
    pickup_location: location,
    name:
      envValue("SHIPROCKET_PICKUP_CONTACT_NAME") ||
      envValue("SHIPROCKET_PICKUP_NAME") ||
      location,
    email:
      envValue("SHIPROCKET_PICKUP_EMAIL") ||
      envValue("SHIPROCKET_EMAIL"),
    phone: normalizePhone(
      envValue("SHIPROCKET_PICKUP_PHONE")
    ),
    address:
      envValue("SHIPROCKET_PICKUP_ADDRESS"),
    address_2:
      envValue("SHIPROCKET_PICKUP_ADDRESS_2"),
    city:
      envValue("SHIPROCKET_PICKUP_CITY"),
    state:
      envValue("SHIPROCKET_PICKUP_STATE"),
    country: "India",
    pin_code:
      envValue("SHIPROCKET_PICKUP_PINCODE"),
  };
}

function hasPickupPayload(payload) {
  return Boolean(
    payload.pickup_location &&
      payload.name &&
      payload.email &&
      payload.phone &&
      payload.address &&
      payload.city &&
      payload.state &&
      payload.pin_code
  );
}

async function createPickupLocationFromEnv() {
  const payload = pickupPayloadFromEnv();

  if (!hasPickupPayload(payload)) {
    const error = new Error(
      "Shiprocket pickup address is missing. Add one in Shiprocket Settings > Pickup Address, or set SHIPROCKET_PICKUP_* env vars."
    );
    error.statusCode = 422;
    error.response = {
      requiredEnv: [
        "SHIPROCKET_PICKUP_LOCATION",
        "SHIPROCKET_PICKUP_CONTACT_NAME",
        "SHIPROCKET_PICKUP_PHONE",
        "SHIPROCKET_PICKUP_ADDRESS",
        "SHIPROCKET_PICKUP_CITY",
        "SHIPROCKET_PICKUP_STATE",
        "SHIPROCKET_PICKUP_PINCODE",
      ],
    };
    throw error;
  }

  return authorizedShiprocketFetch(
    "/settings/company/addpickup",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

async function ensurePickupLocation() {
  const pickupInfo = await getPickupLocations();

  if (pickupInfo.locations.length > 0) {
    return pickupInfo;
  }

  if (envValue("SHIPROCKET_AUTO_CREATE_PICKUP") === "true") {
    await createPickupLocationFromEnv();
    return getPickupLocations();
  }

  const error = new Error(
    "Shiprocket pickup address is not configured. Add a pickup address in Shiprocket Settings > Pickup Address."
  );
  error.statusCode = 422;
  error.response = pickupInfo.raw;
  throw error;
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/);

  if (parts.length <= 1) {
    return {
      firstName: parts[0] || "Customer",
      lastName: "",
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1),
  };
}

function orderNumberForShiprocket(order) {
  return order.orderNumber || `SHY-${order.id}`;
}

function buildShiprocketOrderPayload(order) {
  const { firstName, lastName } = splitName(order.customerName);
  const pickupLocation = pickupLocationName();
  const length = Number(envValue("SHIPROCKET_PACKAGE_LENGTH_CM")) || 10;
  const breadth = Number(envValue("SHIPROCKET_PACKAGE_BREADTH_CM")) || 10;
  const height = Number(envValue("SHIPROCKET_PACKAGE_HEIGHT_CM")) || 10;
  const weight = Number(envValue("SHIPROCKET_PACKAGE_WEIGHT_KG")) || 0.5;

  const payload = {
    order_id: orderNumberForShiprocket(order),
    order_date: new Date(order.createdAt).toISOString().slice(0, 10),
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: order.addressLine,
    billing_city: order.city,
    billing_pincode: order.pincode,
    billing_state: order.state,
    billing_country: "India",
    billing_email: order.email || "support@shayveda.com",
    billing_phone: normalizePhone(order.phone),
    billing_address_2: "",
    shipping_is_billing: true,
    shipping_customer_name: firstName,
    shipping_last_name: lastName,
    shipping_address: order.addressLine,
    shipping_address_2: "",
    shipping_city: order.city,
    shipping_pincode: order.pincode,
    shipping_state: order.state,
    shipping_country: "India",
    shipping_email: order.email || "support@shayveda.com",
    shipping_phone: normalizePhone(order.phone),
    order_items: order.orderItems.map((item) => ({
      name: item.product.name,
      sku: item.product.slug || `SKU-${item.productId}`,
      units: item.quantity,
      selling_price: String(item.price),
      discount: "0",
      tax: "0",
    })),
    payment_method: toShiprocketPaymentMethod(order.paymentMethod),
    shipping_charges: order.deliveryCharge || 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: order.discountAmount || 0,
    sub_total: order.totalAmount,
    length,
    breadth,
    height,
    weight,
  };

  payload.pickup_location = pickupLocation;

  const channelId = envValue("SHIPROCKET_CHANNEL_ID");
  if (channelId) {
    // Shiprocket expects numeric channel id in some endpoints
    payload.channel_id = Number(channelId);
  }

  return payload;
}

function readNestedValue(source, paths) {
  for (const path of paths) {
    const value = path
      .split(".")
      .reduce((current, key) => current?.[key], source);

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function extractShiprocketIds(data) {
  return {
    shiprocketOrderId: readNestedValue(data, [
      "order_id",
      "data.order_id",
      "response.order_id",
    ]),
    shiprocketShipmentId: readNestedValue(data, [
      "shipment_id",
      "data.shipment_id",
      "response.shipment_id",
    ]),
    shiprocketAwbCode: readNestedValue(data, [
      "awb_code",
      "data.awb_code",
      "response.data.awb_code",
      "response.awb_code",
    ]),
    shiprocketCourierName: readNestedValue(data, [
      "courier_name",
      "data.courier_name",
      "response.data.courier_name",
      "response.courier_name",
    ]),
  };
}

async function assignAwb(shipmentId) {
  if (!shipmentId) {
    return null;
  }

  const courierId = envValue("SHIPROCKET_COURIER_ID");
  const payload = {
    shipment_id: Number(shipmentId),
  };

  if (courierId) {
    payload.courier_id = Number(courierId);
  }

  return authorizedShiprocketFetch("/courier/assign/awb", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function createShiprocketOrder(order) {
  if (!isShiprocketConfigured()) {
    return {
      skipped: true,
      message: "Shiprocket credentials are not configured",
    };
  }

  let createResponse;
  try {
    await ensurePickupLocation();

    const payload = buildShiprocketOrderPayload(order);
    // Log the payload for debugging Shiprocket failures (trim large fields)
    try {
      console.log("Shiprocket create payload:", JSON.stringify(payload, null, 2));
    } catch {}

    createResponse = await authorizedShiprocketFetch(
      "/orders/create/adhoc",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  } catch (error) {
    // Return structured error information instead of throwing so callers
    // can persist API error details for debugging.
    createResponse = {
      error: error.message,
      response: error.response || null,
    };
    // Log the API error response for debugging
    try {
      console.error("Shiprocket create error response:", JSON.stringify(error.response));
    } catch (e) {}
    // Continue - assignResponse will be empty and the caller will record the error
  }

  const createIds = extractShiprocketIds(createResponse);
  let assignResponse = null;
  let assignIds = {};

  try {
    assignResponse = await assignAwb(createIds.shiprocketShipmentId);
    assignIds = assignResponse
      ? extractShiprocketIds(assignResponse)
      : {};
  } catch (error) {
    assignResponse = {
      error: error.message,
      response: error.response,
    };
  }

  return {
    skipped: false,
    createResponse,
    assignResponse,
    ...createIds,
    ...Object.fromEntries(
      Object.entries(assignIds).filter(([, value]) => value)
    ),
  };
}

async function trackByAwb(awbCode) {
  return authorizedShiprocketFetch(
    `/courier/track/awb/${encodeURIComponent(awbCode)}`
  );
}

async function trackByOrder(orderId, channelId) {
  const params = new URLSearchParams({
    order_id: String(orderId),
  });

  if (channelId) {
    params.set("channel_id", String(channelId));
  }

  return authorizedShiprocketFetch(`/courier/track?${params.toString()}`);
}

module.exports = {
  createPickupLocationFromEnv,
  createShiprocketOrder,
  envValue,
  ensurePickupLocation,
  getPickupLocations,
  isShiprocketConfigured,
  trackByAwb,
  trackByOrder,
};

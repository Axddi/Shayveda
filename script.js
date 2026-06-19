const products = {
  aloe: {
    name: "99% Aloe Vera Soothing Gel",
    price: 110,
    visual: "aloe-product",
    image: "alo.png",
    alt: "Shayveda 99% Aloe Vera Soothing Gel",
    color: "green",
  },

  beetroot: {
    name: "Beetroot Superfood Powder",
    price: 399,
    visual: "beetroot-product",
    image: "beetroot.png",
    alt: "Shayveda Beetroot Superfood Powder",
    color: "beet",
  },
};

if (typeof window !== "undefined") {
  window.products = products;
}

document.querySelectorAll("[data-tilt]").forEach((card) => {

  card.addEventListener("pointermove", (event) => {

    const rect = card.getBoundingClientRect();

    const x =
      (event.clientX - rect.left) /
      rect.width - 0.5;

    const y =
      (event.clientY - rect.top) /
      rect.height - 0.5;

    card.style.transform =
      `rotateX(${y * -7}deg)
       rotateY(${x * 9}deg)
       translateY(-3px)`;
  });

  card.addEventListener("pointerleave", () => {
    card.style.transform = "";
  });
});

const subtotal =
  document.querySelector("#subtotal");

const discountLabel =
  document.querySelector("#discountLabel");

const discountAmount =
  document.querySelector("#discountAmount");

const total =
  document.querySelector("#total");

const checkoutForm =
  document.querySelector("#checkoutForm");

const checkoutStatus =
  document.querySelector("#checkoutStatus");

const nextOrderId =
  document.querySelector("#nextOrderId");

const paymentMethod =
  document.querySelector("#paymentMethod");

const checkoutSubmit =
  document.querySelector("#checkoutSubmit");

const checkoutItemsContainer =
  document.querySelector("#checkoutItems");

const PAYU_PAYMENT_LINK =
  "https://dashboard-staging.payu.in/pay/67ED088B41FA4AD8505EEB8167255C5B";

const SHIPPING_CHARGE = 0;

const ORDERS_STORAGE_KEY =
  "shayvedaOrders";

const CART_STORAGE_KEY =
  "shayvedaCart";

const DISCOUNTS = {

  payu: {
    label: "Prepaid discount",
    rate: 0.20,
  },

  cod: {
    label: "COD discount",
    rate: 0.10,
  },
};

function money(amount) {

  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

function getCart() {

  return JSON.parse(
    localStorage.getItem(CART_STORAGE_KEY)
  ) || [];
}

function saveCart(cart) {

  localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify(cart)
  );
}

function updateCartCount() {

  const cart = getCart();

  const totalItems = cart.reduce(
    (sum, item) => {
      return sum + item.quantity;
    },
    0
  );

  const countElement =
    document.querySelector("#cartCount");

  if (countElement) {

    countElement.textContent =
      totalItems;
  }
}

function addToCart(productId) {

  const cart = getCart();

  const existing =
    cart.find(item => item.id === productId);

  if (existing) {

    existing.quantity += 1;

  } else {

    cart.push({
      id: productId,
      quantity: 1,
    });
  }

  saveCart(cart);

  updateCartCount();

  alert("Added to cart");
}

// Expose functions needed by inline handlers in HTML
if (typeof window !== "undefined") {
  window.addToCart = addToCart;
  window.updateCartCount = updateCartCount;
}

function getStoredOrders() {

  try {

    return JSON.parse(
      localStorage.getItem(
        ORDERS_STORAGE_KEY
      )
    ) || [];

  } catch {

    return [];
  }
}

function saveStoredOrder(order) {

  const orders = getStoredOrders();

  orders.unshift(order);

  localStorage.setItem(
    ORDERS_STORAGE_KEY,
    JSON.stringify(orders)
  );
}

function createOrderId() {

  const date = new Date();

  const stamp = date
    .toISOString()
    .slice(2, 10)
    .replaceAll("-", "");

  const random =
    Math.floor(
      1000 + Math.random() * 9000
    );

  return `SHY-${stamp}-${random}`;
}

function refreshNextOrderId() {

  if (
    nextOrderId &&
    !nextOrderId.dataset.orderId
  ) {

    nextOrderId.dataset.orderId =
      createOrderId();
  }

  if (nextOrderId) {

    nextOrderId.textContent =
      nextOrderId.dataset.orderId;
  }
}

function getCartTotals() {

  const cart = getCart();

  let aloeQty = 0;
  let beetQty = 0;

  cart.forEach(item => {

    if (item.id === "aloe") {
      aloeQty += item.quantity;
    }

    if (item.id === "beetroot") {
      beetQty += item.quantity;
    }
  });

  // Number of possible combos
  const comboCount =
    Math.min(aloeQty, beetQty);

  // Remaining quantities after combos
  const remainingAloe =
    aloeQty - comboCount;

  const remainingBeet =
    beetQty - comboCount;

  // Combo pricing
  const comboTotal =
    comboCount * 499;

  // Remaining individual pricing
  const aloeTotal =
    remainingAloe *
    products.aloe.price;

  const beetTotal =
    remainingBeet *
    products.beetroot.price;

  const subtotalValue =
    comboTotal +
    aloeTotal +
    beetTotal;

  const method =
    paymentMethod?.value || "payu";

  const discountRate =
    method === "cod"
      ? 0.10
      : 0.20;

  const discount =
    Math.round(
      subtotalValue * discountRate
    );

  const shipping = 55;

  const finalTotal =
    subtotalValue -
    discount +
    shipping;

  return {

    subtotalValue,

    discount,

    discountRate,

    shipping,

    finalTotal,

    comboCount,

    comboTotal,

    aloeTotal,

    beetTotal,

    remainingAloe,

    remainingBeet,

    method
  };
}

function renderCheckoutItems() {

  if (!checkoutItemsContainer)
    return;

  const cart = getCart();

  if (cart.length === 0) {

    checkoutItemsContainer.innerHTML = `
      <p>Your cart is empty.</p>
    `;

    return;
  }

  let html = "";

  cart.forEach(item => {

    const product =
      products[item.id];

    const itemTotal =
      product.price *
      item.quantity;

    html += `
      <div class="summary-line">

        <span>
          ${product.name}
          ×
          ${item.quantity}
        </span>

        <strong>
          ${money(itemTotal)}
        </strong>

      </div>
    `;
  });

const {

  subtotalValue,

  discount,

  discountRate,

  finalTotal,

  comboCount,

  comboTotal,

  method

} = getCartTotals();

  if (comboCount > 0) {

    html += `
      <div class="summary-line">

        <span>
          Combo Pack × ${comboCount}
        </span>

        <strong>
          ${money(comboTotal)}
        </strong>

      </div>
    `;
  }

  checkoutItemsContainer.innerHTML =
    html;

  subtotal.textContent =
    money(subtotalValue);

  if (discountLabel) {

    discountLabel.textContent =
      `${DISCOUNTS[method].label}
      (${Math.round(discountRate * 100)}%)`;
  }

  if (discountAmount) {

    discountAmount.textContent =
      `- ${money(discount)}`;
  }

  total.textContent =
    money(finalTotal);

  if (checkoutSubmit) {

    // Only change button text for legacy PayU checkout form (which uses fields like address1).
    if (checkoutForm && checkoutForm.querySelector('[name="address1"]')) {
      checkoutSubmit.textContent =
        method === "payu"
          ? "Save order and pay with PayU"
          : "Place COD order";
    }
  }

  refreshNextOrderId();
}

paymentMethod?.addEventListener(
  "change",
  renderCheckoutItems
);

renderCheckoutItems();

updateCartCount();

// Attach legacy PayU submit handler only if form matches legacy field names
if (checkoutForm && checkoutForm.querySelector('[name="address1"]')) {

  checkoutForm.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();

      const formData =
        new FormData(checkoutForm);

      const cart =
        getCart();

      const {
        subtotalValue,
        discount,
        discountRate,
        finalTotal,
        comboCount,
        comboTotal,
        method
      } = getCartTotals();

      const orderId =
        nextOrderId?.dataset.orderId ||
        createOrderId();

      const isPrepaid =
        method === "payu";

      const order = {

        orderId,

        createdAt:
          new Date().toISOString(),

        status:
          isPrepaid
            ? "payment_pending"
            : "cod_confirmed",

        paymentMethod:
          isPrepaid
            ? "prepaid"
            : "cod",

        paymentGateway:
          isPrepaid
            ? "PayU staging"
            : "Cash on delivery",

        paymentLink:
          isPrepaid
            ? PAYU_PAYMENT_LINK
            : "",

        comboPack:
          comboApplied,

        products:

          cart.map(item => ({

            id:
              item.id,

            name:
              products[item.id].name,

            unitPrice:
              products[item.id].price,

            quantity:
              item.quantity
          })),

        customer: {

          name:
            formData.get("name"),

          email:
            formData.get("email"),

          phone:
            formData.get("phone"),

          alternatePhone:
            formData.get("alternatePhone") || ""
        },

        shippingAddress: {

          address1:
            formData.get("address1"),

          address2:
            formData.get("address2") || "",

          pincode:
            formData.get("pincode"),

          city:
            formData.get("city"),

          state:
            formData.get("state"),
        },

        notes:
          formData.get("notes") || "",

        totals: {

          subtotal:
            subtotalValue,

          discountRate,

          discount,

          shipping,

          total:
            finalTotal,
        },
      };

      saveStoredOrder(order);

      sessionStorage.setItem(
        "shayvedaLatestOrderId",
        orderId
      );

      if (checkoutStatus) {

        checkoutStatus.textContent =

          isPrepaid

            ? `Order ${orderId}
               saved with 20%
               prepaid discount.
               Opening PayU payment...`

            : `COD order ${orderId}
               saved with 10%
               discount.
               Redirecting to tracking...`;
      }

      // Clear Cart After Order
      localStorage.removeItem(
        CART_STORAGE_KEY
      );

      updateCartCount();

      window.setTimeout(() => {

        window.location.href =

          isPrepaid

            ? PAYU_PAYMENT_LINK

            : `tracking.html?order=${orderId}`;

      }, 650);
    }
  );
}

const trackingForm =
  document.querySelector(
    "#trackingForm"
  );

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getShipmentTrack(tracking) {
  return (
    tracking?.tracking_data?.shipment_track?.[0] ||
    tracking?.shipment_track?.[0] ||
    tracking?.data?.shipment_track?.[0] ||
    {}
  );
}

function getTrackingActivities(tracking) {
  return (
    tracking?.tracking_data?.shipment_track_activities ||
    tracking?.shipment_track_activities ||
    tracking?.data?.shipment_track_activities ||
    []
  );
}

function renderTrackingResult(data) {
  const timeline =
    document.querySelector("#timeline");

  if (!timeline) {
    return;
  }

  const order = data.order || {};
  const track = getShipmentTrack(data.tracking);
  const activities =
    getTrackingActivities(data.tracking);

  const awb =
    track.awb_code ||
    order.shiprocketAwbCode ||
    "AWB pending";

  const courier =
    track.courier_name ||
    order.shiprocketCourierName ||
    "Courier assignment pending";

  const currentStatus =
    track.current_status ||
    track.shipment_status ||
    order.shiprocketStatus ||
    order.orderStatus ||
    "Order placed";

  let html = `
    <article class="timeline-step active">
      <span></span>
      <div>
        <strong>${escapeHtml(currentStatus)}</strong>
        <small>
          Order ${escapeHtml(order.orderNumber || order.id || "")}
          ${order.finalAmount ? `| Rs. ${escapeHtml(order.finalAmount)}` : ""}
        </small>
      </div>
    </article>

    <article class="timeline-step active">
      <span></span>
      <div>
        <strong>${escapeHtml(courier)}</strong>
        <small>AWB: ${escapeHtml(awb)}</small>
      </div>
    </article>
  `;

  if (activities.length > 0) {
    html += activities
      .slice(0, 8)
      .map((activity) => {
        return `
          <article class="timeline-step active">
            <span></span>
            <div>
              <strong>
                ${escapeHtml(activity.activity || activity.status || currentStatus)}
              </strong>
              <small>
                ${escapeHtml(activity.date || activity.datetime || "")}
                ${activity.location ? ` | ${escapeHtml(activity.location)}` : ""}
              </small>
            </div>
          </article>
        `;
      })
      .join("");
  } else {
    html += `
      <article class="timeline-step ${order.shiprocketAwbCode ? "active" : ""}">
        <span></span>
        <div>
          <strong>Picked by Shiprocket courier</strong>
          <small>${escapeHtml(data.trackingError || "Live courier updates will appear after AWB assignment")}</small>
        </div>
      </article>

      <article class="timeline-step">
        <span></span>
        <div>
          <strong>Out for delivery</strong>
          <small>SMS update to customer</small>
        </div>
      </article>
    `;
  }

  timeline.innerHTML = html;
}

async function trackOrder(identifier) {
  const timeline =
    document.querySelector("#timeline");

  if (timeline) {
    timeline.innerHTML = `
      <article class="timeline-step active">
        <span></span>
        <div>
          <strong>Checking order status</strong>
          <small>Please wait</small>
        </div>
      </article>
    `;
  }

  const explicitApiBase =
    (window.__API_BASE__ || "").replace(/\/$/, "");

  const localFrontend =
    ["localhost", "127.0.0.1", ""].includes(window.location.hostname);

  const apiBase =
    explicitApiBase ||
    (localFrontend
      ? `${window.location.origin}/api`
      : `${window.location.origin}/api`);

  const normalizeApiBase = (base) => {
    const trimmed =
      String(base || "").replace(/\/$/, "");

    if (!trimmed) {
      return "";
    }

    return trimmed.endsWith("/api")
      ? trimmed
      : `${trimmed}/api`;
  };

  const apiBases =
    [
      normalizeApiBase(apiBase),
      !explicitApiBase && localFrontend
        ? "http://localhost:5000/api"
        : "",
    ].filter(Boolean);

  let lastError = null;

  for (const base of [...new Set(apiBases)]) {
    const url =
      `${base}/orders/track/${encodeURIComponent(identifier)}`;

    try {
      const response = await fetch(url);

      const contentType =
        response.headers.get("content-type") || "";

      const data = contentType.includes("application/json")
        ? await response.json()
        : {
            message:
              (await response.text()) ||
              "Server returned a non-JSON response",
          };

      if (response.ok) {
        renderTrackingResult(data);
        return;
      }

      lastError =
        new Error(data.message || "Unable to track order");

      const missingApiRoute =
        response.status === 404 &&
        !contentType.includes("application/json");

      if (!missingApiRoute) {
        lastError.stopRetry = true;
        throw lastError;
      }
    } catch (error) {
      if (error.stopRetry) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError ||
    new Error("Unable to track order");
}

if (trackingForm) {

  trackingForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      const input =
        document.querySelector("#trackingInput");

      try {
        await trackOrder(input.value.trim());
      } catch (error) {
        const timeline =
          document.querySelector("#timeline");

        if (timeline) {
          timeline.innerHTML = `
            <article class="timeline-step active">
              <span></span>
              <div>
                <strong>Tracking unavailable</strong>
                <small>${escapeHtml(error.message)}</small>
              </div>
            </article>
          `;
        }
      }
    }
  );

  const params =
    new URLSearchParams(window.location.search);

  const initialIdentifier =
    params.get("order") ||
    sessionStorage.getItem("shayvedaLatestOrderId");

  if (initialIdentifier) {
    const input =
      document.querySelector("#trackingInput");

    if (input) {
      input.value = initialIdentifier;
    }

    trackOrder(initialIdentifier).catch(() => {});
  }
}

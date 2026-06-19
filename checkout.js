(function () {
  try {
// Use runtime-provided API base when hosting the API separately.
// Locally, the static frontend runs on a different port from Express.
const explicitApiBase =
  (window.__API_BASE__ || "").replace(/\/$/, "");

const localFrontend =
  ["localhost", "127.0.0.1", ""].includes(window.location.hostname);

const API_BASE =
  explicitApiBase ||
  (localFrontend
    ? `${window.location.origin}/api`
    : `${window.location.origin}/api`);

function normalizeApiBase(base) {
  const trimmed = String(base || "").replace(/\/$/, "");

  if (!trimmed) {
    return "";
  }

  return trimmed.endsWith("/api")
    ? trimmed
    : `${trimmed}/api`;
}

const apiBaseCandidates = [
  normalizeApiBase(API_BASE),
  !explicitApiBase && localFrontend
    ? "http://localhost:5000/api"
    : "",
].filter(Boolean);

const API_BASES =
  [...new Set(apiBaseCandidates)];
const CART_STORAGE_KEYS = ["shayvedaCart", "cart"];
const DELIVERY_CHARGE = 55;

const checkoutForm =
  document.getElementById("checkoutForm");

const checkoutItems =
  document.getElementById("checkoutItems");

const subtotalEl =
  document.getElementById("subtotal");

const discountAmountEl =
  document.getElementById("discountAmount");

const discountLabelEl =
  document.getElementById("discountLabel");

const totalEl =
  document.getElementById("total");

const checkoutStatusEl =
  document.getElementById("checkoutStatus");

const checkoutButton =
  document.getElementById("checkoutSubmit");

function readStoredCart() {
  for (const key of CART_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);

    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      localStorage.removeItem(key);
    }
  }

  return [];
}

function writePrimaryCart(cart) {
  localStorage.setItem(
    CART_STORAGE_KEYS[0],
    JSON.stringify(cart)
  );
}

function clearStoredCart() {
  CART_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
  });
}

function getProductDetails(item) {
  const localProduct =
    typeof products !== "undefined"
      ? products[item.id]
      : null;

  return {
    id: item.id,
    name: item.name || localProduct?.name || item.id,
    price: Number(item.price ?? localProduct?.price ?? 0),
    quantity: Number(item.quantity || 1),
  };
}

function getCheckoutCart() {
  const cart = readStoredCart();
  const params = new URLSearchParams(window.location.search);
  const productFromUrl = params.get("product");

  if (
    cart.length === 0 &&
    productFromUrl &&
    typeof products !== "undefined" &&
    products[productFromUrl]
  ) {
    const directCart = [
      {
        id: productFromUrl,
        quantity: 1,
      },
    ];

    writePrimaryCart(directCart);
    return directCart;
  }

  return cart;
}

let cart = getCheckoutCart();

function calculateTotals() {
  const subtotal = cart.reduce((sum, item) => {
    const product = getProductDetails(item);

    return sum + product.price * product.quantity;
  }, 0);

  const paymentMethod =
    document.querySelector('input[name="payment"]:checked')?.value ||
    "PREPAID";

  const discountRate =
    paymentMethod === "COD"
      ? 0.1
      : 0.2;

  const discount = Math.round(subtotal * discountRate * 100) / 100;
  const total =
    Math.round((subtotal - discount + DELIVERY_CHARGE) * 100) / 100;

  return {
    subtotal,
    paymentMethod,
    discount,
    total,
  };
}

function money(amount) {
  return `Rs. ${Number(amount).toFixed(2)}`;
}

function setStatus(message) {
  if (checkoutStatusEl) {
    checkoutStatusEl.textContent = message || "";
  }
}

function setSubmitting(isSubmitting) {
  if (checkoutButton) {
    checkoutButton.disabled = isSubmitting;
    checkoutButton.textContent = isSubmitting
      ? "Processing..."
      : "Place Order";
  }
}

function renderCheckout() {
  checkoutItems.innerHTML = "";

  if (cart.length === 0) {
    checkoutItems.innerHTML = "<p>Your cart is empty.</p>";
  }

  cart.forEach((item) => {
    const product = getProductDetails(item);
    const div = document.createElement("div");

    div.classList.add("summary-line");

    div.innerHTML = `
      <span>
        ${product.name}
        x ${product.quantity}
      </span>

      <strong>
        ${money(product.price * product.quantity)}
      </strong>
    `;

    checkoutItems.appendChild(div);
  });

  const totals = calculateTotals();

  discountLabelEl.innerText =
    totals.paymentMethod === "COD"
      ? "COD Discount"
      : "Prepaid Discount";

  subtotalEl.innerText = money(totals.subtotal);
  discountAmountEl.innerText = `- ${money(totals.discount)}`;
  totalEl.innerText = money(totals.total);
}

function orderIdentifier(order) {
  return (
    order?.shiprocketAwbCode ||
    order?.orderNumber ||
    order?.id ||
    ""
  );
}

function goToTracking(order) {
  const identifier = orderIdentifier(order);

  if (identifier) {
    sessionStorage.setItem(
      "shayvedaLatestOrderId",
      identifier
    );

    window.location.href =
      `tracking.html?order=${encodeURIComponent(identifier)}`;

    return;
  }

  window.location.href = "tracking.html";
}

function apiUrl(base, path) {
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function postJson(path, payload) {
  let lastError = null;

  for (const base of API_BASES) {
    try {
      const response = await fetch(apiUrl(base, path), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

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
        return data;
      }

      lastError =
        new Error(data.message || "Request failed");

      lastError.status = response.status;

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

  throw new Error(
    lastError?.message ||
      "Unable to reach checkout server. Please start the backend or configure the API URL."
  );
}

function customerPayload() {
  return {
    customerName: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    email: document.getElementById("email").value.trim(),
    addressLine: document.getElementById("address").value.trim(),
    city: document.getElementById("city").value.trim(),
    state: document.getElementById("state").value.trim(),
    pincode: document.getElementById("pincode").value.trim(),
  };
}

function cartPayload() {
  return cart.map((item) => {
    const product = getProductDetails(item);

    return {
      productId: product.id,
      quantity: product.quantity,
    };
  });
}

renderCheckout();

document
  .querySelectorAll('input[name="payment"]')
  .forEach((radio) => {
    radio.addEventListener("change", renderCheckout);
  });

checkoutForm.addEventListener(
  "submit",
  async function (event) {
    event.preventDefault();

    cart = getCheckoutCart();

    if (cart.length === 0) {
      setStatus("Your cart is empty.");
      return;
    }

    const paymentMethod =
      document.querySelector('input[name="payment"]:checked')?.value ||
      "PREPAID";

    const payload = {
      ...customerPayload(),
      paymentMethod,
      items: cartPayload(),
    };

    try {
      setSubmitting(true);
      setStatus("Creating your order...");

      if (paymentMethod === "COD") {
        const data = await postJson(
          "/orders",
          payload
        );

        clearStoredCart();
        alert("Order placed successfully!");
        goToTracking(data.order);
        return;
      }

      const orderData = await postJson(
        "/create-order",
        {
          paymentMethod,
          items: payload.items,
        }
      );

      if (typeof Razorpay === "undefined") {
        throw new Error(
          "Razorpay checkout could not be loaded. Please check your internet connection and try again."
        );
      }

      const razorpayOrderId =
        orderData.order_id ||
        orderData.razorpayOrder?.id;

      if (!razorpayOrderId) {
        throw new Error(
          "Razorpay order could not be created. Please try again."
        );
      }

      const options = {
        key: orderData.keyId,
        amount:
          orderData.amount ||
          orderData.razorpayOrder?.amount,
        currency:
          orderData.currency ||
          orderData.razorpayOrder?.currency ||
          "INR",
        name: "Shayveda",
        description: "Order Payment",
        order_id: razorpayOrderId,
        prefill: {
          name: payload.customerName,
          email: payload.email,
          contact: payload.phone,
        },
        handler: async function (response) {
          try {
            setStatus("Verifying payment...");

            const verifyData = await postJson(
              "/verify-payment",
              {
                razorpay_order_id:
                  response.razorpay_order_id,
                razorpay_payment_id:
                  response.razorpay_payment_id,
                razorpay_signature:
                  response.razorpay_signature,
                ...payload,
              }
            );

            clearStoredCart();
            alert("Payment successful!");
            goToTracking(verifyData.order);
          } catch (error) {
            setStatus(error.message);
            alert(error.message);
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
            setStatus("");
          },
        },
        theme: {
          color: "#000000",
        },
      };

      const razorpay = new Razorpay(options);

      razorpay.on("payment.failed", function (response) {
        const message =
          response?.error?.description ||
          response?.error?.reason ||
          "Payment failed. Please try again.";

        setStatus(message);
        alert(message);
        setSubmitting(false);
      });

      razorpay.open();
    } catch (error) {
      setStatus(error.message);
      alert(error.message);
      setSubmitting(false);
    }
  }
);
  } catch (err) {
    console.error("Checkout script error:", err);
  }
})();

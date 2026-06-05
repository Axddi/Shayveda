(function () {
const API_BASE = "http://localhost:5000/api";
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

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
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
          `${API_BASE}/orders`,
          payload
        );

        clearStoredCart();
        alert("Order placed successfully!");
        goToTracking(data.order);
        return;
      }

      const orderData = await postJson(
        `${API_BASE}/payment/create-order`,
        {
          paymentMethod,
          items: payload.items,
        }
      );

      const options = {
        key: orderData.keyId,
        amount: orderData.razorpayOrder.amount,
        currency: "INR",
        name: "Shayveda",
        description: "Order Payment",
        order_id: orderData.razorpayOrder.id,
        prefill: {
          name: payload.customerName,
          email: payload.email,
          contact: payload.phone,
        },
        handler: async function (response) {
          try {
            setStatus("Verifying payment...");

            const verifyData = await postJson(
              `${API_BASE}/payment/verify`,
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
      razorpay.open();
    } catch (error) {
      setStatus(error.message);
      alert(error.message);
      setSubmitting(false);
    }
  }
);
})();

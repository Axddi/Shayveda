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
    alt: "Sadhna Herbs Beetroot Powder",
    color: "beet",
  },
};

document.querySelectorAll("[data-tilt]").forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `rotateX(${y * -7}deg) rotateY(${x * 9}deg) translateY(-3px)`;
  });

  card.addEventListener("pointerleave", () => {
    card.style.transform = "";
  });
});

const productSelect = document.querySelector("#productSelect");
const quantityInput = document.querySelector("#quantityInput");
const subtotal = document.querySelector("#subtotal");
const discountLabel = document.querySelector("#discountLabel");
const discountAmount = document.querySelector("#discountAmount");
const total = document.querySelector("#total");
const summaryProduct = document.querySelector("#summaryProduct");
const checkoutForm = document.querySelector("#checkoutForm");
const checkoutStatus = document.querySelector("#checkoutStatus");
const nextOrderId = document.querySelector("#nextOrderId");
const paymentMethod = document.querySelector("#paymentMethod");
const checkoutSubmit = document.querySelector("#checkoutSubmit");

const PAYU_PAYMENT_LINK = "https://dashboard-staging.payu.in/pay/67ED088B41FA4AD8505EEB8167255C5B";
const SHIPPING_CHARGE = 55;
const ORDERS_STORAGE_KEY = "shayvedaOrders";
const DISCOUNTS = {
  payu: {
    label: "Prepaid discount",
    rate: 0.2,
  },
  cod: {
    label: "COD discount",
    rate: 0.1,
  },
};

function money(amount) {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

function getStoredOrders() {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveStoredOrder(order) {
  const orders = getStoredOrders();
  orders.unshift(order);
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

function createOrderId() {
  const date = new Date();
  const stamp = date
    .toISOString()
    .slice(2, 10)
    .replaceAll("-", "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `SHY-${stamp}-${random}`;
}

function getCheckoutTotals() {
  const selected = products[productSelect.value];
  const quantity = Number(quantityInput.value || 1);
  const itemSubtotal = selected.price * quantity;
  const method = paymentMethod?.value || "payu";
  const discountRate = DISCOUNTS[method]?.rate || 0;
  const discount = Math.round(itemSubtotal * discountRate);

  return {
    selected,
    quantity,
    method,
    itemSubtotal,
    discountRate,
    discount,
    shipping: SHIPPING_CHARGE,
    total: itemSubtotal - discount + SHIPPING_CHARGE,
  };
}

function refreshNextOrderId() {
  if (nextOrderId && !nextOrderId.dataset.orderId) {
    nextOrderId.dataset.orderId = createOrderId();
  }

  if (nextOrderId) {
    nextOrderId.textContent = nextOrderId.dataset.orderId;
  }
}

function setCheckoutProduct() {
  if (!productSelect) return;

  const { selected, method, itemSubtotal, discountRate, discount, total: orderTotal } = getCheckoutTotals();
  subtotal.textContent = money(itemSubtotal);
  if (discountLabel) {
    discountLabel.textContent = `${DISCOUNTS[method].label} (${Math.round(discountRate * 100)}%)`;
  }
  if (discountAmount) {
    discountAmount.textContent = `- ${money(discount)}`;
  }
  total.textContent = money(orderTotal);

  if (checkoutSubmit) {
    checkoutSubmit.textContent =
      method === "payu" ? "Save order and pay with PayU" : "Place COD order";
  }

  if (summaryProduct) {
    summaryProduct.className = `product-3d image-product ${selected.visual}`;
    summaryProduct.innerHTML = `<img src="${selected.image}" alt="${selected.alt}">`;
  }

  refreshNextOrderId();
}

if (productSelect) {
  const params = new URLSearchParams(window.location.search);
  const productParam = params.get("product");
  if (productParam && products[productParam]) {
    productSelect.value = productParam;
  }

  productSelect.addEventListener("change", setCheckoutProduct);
  quantityInput.addEventListener("input", setCheckoutProduct);
  paymentMethod?.addEventListener("change", setCheckoutProduct);
  setCheckoutProduct();
}

if (checkoutForm) {
  checkoutForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(checkoutForm);
    const {
      selected,
      quantity,
      method,
      itemSubtotal,
      discountRate,
      discount,
      shipping,
      total: orderTotal,
    } = getCheckoutTotals();
    const orderId = nextOrderId?.dataset.orderId || createOrderId();
    const isPrepaid = method === "payu";

    const order = {
      orderId,
      createdAt: new Date().toISOString(),
      status: isPrepaid ? "payment_pending" : "cod_confirmed",
      paymentMethod: isPrepaid ? "prepaid" : "cod",
      paymentGateway: isPrepaid ? "PayU staging" : "Cash on delivery",
      paymentLink: isPrepaid ? PAYU_PAYMENT_LINK : "",
      product: {
        id: productSelect.value,
        name: selected.name,
        unitPrice: selected.price,
        quantity,
      },
      customer: {
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        alternatePhone: formData.get("alternatePhone") || "",
      },
      shippingAddress: {
        address1: formData.get("address1"),
        address2: formData.get("address2") || "",
        pincode: formData.get("pincode"),
        city: formData.get("city"),
        state: formData.get("state"),
      },
      notes: formData.get("notes") || "",
      totals: {
        subtotal: itemSubtotal,
        discountRate,
        discount,
        shipping,
        total: orderTotal,
      },
    };

    saveStoredOrder(order);
    sessionStorage.setItem("shayvedaLatestOrderId", orderId);

    if (checkoutStatus) {
      checkoutStatus.textContent = isPrepaid
        ? `Order ${orderId} saved with 20% prepaid discount. Opening PayU payment...`
        : `COD order ${orderId} saved with 10% discount. Redirecting to tracking...`;
    }

    window.setTimeout(() => {
      window.location.href = isPrepaid ? PAYU_PAYMENT_LINK : `tracking.html?order=${orderId}`;
    }, 650);
  });
}

const trackingForm = document.querySelector("#trackingForm");
if (trackingForm) {
  trackingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    document.querySelectorAll(".timeline-step").forEach((step, index) => {
      if (index < 3) step.classList.add("active");
    });
  });
}

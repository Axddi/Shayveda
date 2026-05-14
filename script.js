const products = {
  aloe: {
    name: "99% Aloe Vera Soothing Gel",
    price: 249,
    visual: "aloe-product",
    image: "alo.png",
    alt: "Shayveda 99% Aloe Vera Soothing Gel",
    color: "green",
  },
  beetroot: {
    name: "Beetroot Superfood Powder",
    price: 299,
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
const total = document.querySelector("#total");
const summaryProduct = document.querySelector("#summaryProduct");
const checkoutForm = document.querySelector("#checkoutForm");
const checkoutStatus = document.querySelector("#checkoutStatus");
const nextOrderId = document.querySelector("#nextOrderId");

const PAYU_PAYMENT_LINK = "https://dashboard-staging.payu.in/pay/67ED088B41FA4AD8505EEB8167255C5B";
const SHIPPING_CHARGE = 55;
const ORDERS_STORAGE_KEY = "shayvedaOrders";

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

  return {
    selected,
    quantity,
    itemSubtotal,
    shipping: SHIPPING_CHARGE,
    total: itemSubtotal + SHIPPING_CHARGE,
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

  const { selected, itemSubtotal, shipping, total: orderTotal } = getCheckoutTotals();
  subtotal.textContent = money(itemSubtotal);
  total.textContent = money(orderTotal);

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
  setCheckoutProduct();
}

if (checkoutForm) {
  checkoutForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(checkoutForm);
    const { selected, quantity, itemSubtotal, shipping, total: orderTotal } = getCheckoutTotals();
    const orderId = nextOrderId?.dataset.orderId || createOrderId();

    const order = {
      orderId,
      createdAt: new Date().toISOString(),
      status: "payment_pending",
      paymentGateway: "PayU staging",
      paymentLink: PAYU_PAYMENT_LINK,
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
        shipping,
        total: orderTotal,
      },
    };

    saveStoredOrder(order);
    sessionStorage.setItem("shayvedaLatestOrderId", orderId);

    if (checkoutStatus) {
      checkoutStatus.textContent = `Order ${orderId} saved. Opening PayU payment...`;
    }

    window.setTimeout(() => {
      window.location.href = PAYU_PAYMENT_LINK;
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

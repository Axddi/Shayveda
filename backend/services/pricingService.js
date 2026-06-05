const prisma = require("../config/db");

const DELIVERY_CHARGE = 55;
const PREPAID_DISCOUNT_RATE = 0.2;
const COD_DISCOUNT_RATE = 0.1;

function normalizePaymentMethod(paymentMethod) {
  return String(paymentMethod || "").toUpperCase() === "COD"
    ? "COD"
    : "PREPAID";
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("No items provided");
    error.statusCode = 400;
    throw error;
  }

  return items.map((item) => {
    const productRef =
      item.productId ?? item.id ?? item.slug;

    const quantity = Number(item.quantity);

    if (!productRef || !Number.isInteger(quantity) || quantity <= 0) {
      const error = new Error("Invalid cart item");
      error.statusCode = 400;
      throw error;
    }

    return {
      productRef,
      quantity,
    };
  });
}

async function getProductsForItems(items) {
  const numericIds = [];
  const slugs = [];

  items.forEach((item) => {
    const value = String(item.productRef);
    const numericValue = Number(value);

    if (Number.isInteger(numericValue) && value.trim() !== "") {
      numericIds.push(numericValue);
    } else {
      slugs.push(value);
    }
  });

  const filters = [];

  if (numericIds.length > 0) {
    filters.push({
      id: {
        in: [...new Set(numericIds)],
      },
    });
  }

  if (slugs.length > 0) {
    filters.push({
      slug: {
        in: [...new Set(slugs)],
      },
    });
  }

  return prisma.product.findMany({
    where:
      filters.length === 1
        ? filters[0]
        : {
            OR: filters,
          },
  });
}

async function calculateOrderPricing(items, paymentMethod) {
  const normalizedItems = normalizeItems(items);
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
  const products = await getProductsForItems(normalizedItems);

  let subtotal = 0;
  const orderItemsData = [];
  const pricedItems = [];

  normalizedItems.forEach((item) => {
    const product = products.find((candidate) => {
      return (
        String(candidate.id) === String(item.productRef) ||
        candidate.slug === String(item.productRef)
      );
    });

    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }

    const itemTotal = product.price * item.quantity;
    subtotal += itemTotal;

    orderItemsData.push({
      productId: product.id,
      quantity: item.quantity,
      price: product.price,
    });

    pricedItems.push({
      product,
      quantity: item.quantity,
      itemTotal,
    });
  });

  const discountRate =
    normalizedPaymentMethod === "COD"
      ? COD_DISCOUNT_RATE
      : PREPAID_DISCOUNT_RATE;

  const discountAmount = Math.round(subtotal * discountRate * 100) / 100;
  const deliveryCharge = DELIVERY_CHARGE;
  const finalAmount =
    Math.round((subtotal - discountAmount + deliveryCharge) * 100) / 100;

  return {
    subtotal,
    discountAmount,
    deliveryCharge,
    finalAmount,
    paymentMethod: normalizedPaymentMethod,
    orderItemsData,
    pricedItems,
  };
}

module.exports = {
  DELIVERY_CHARGE,
  calculateOrderPricing,
  normalizePaymentMethod,
};

const {
  SESClient,
  SendEmailCommand,
} = require("@aws-sdk/client-ses");

function envValue(name) {
  return (process.env[name] || "").trim();
}

function isEmailConfigured() {
  return Boolean(
    envValue("AWS_SES_REGION") &&
      envValue("ORDER_EMAIL_FROM")
  );
}

function orderItemsText(order) {
  return (order.orderItems || [])
    .map((item) => {
      const name =
        item.product?.name ||
        `Product ${item.productId}`;

      return `${name} x ${item.quantity}`;
    })
    .join(", ");
}

function orderConfirmationSubject(order) {
  return `Shayveda order ${order.orderNumber || order.id} confirmed`;
}

function orderConfirmationText(order) {
  return [
    `Hi ${order.customerName},`,
    "",
    `Thank you for your Shayveda order ${order.orderNumber || order.id}.`,
    `Order total: Rs. ${order.finalAmount}`,
    `Payment method: ${order.paymentMethod}`,
    `Items: ${orderItemsText(order)}`,
    "",
    "Delivery address:",
    order.addressLine,
    `${order.city}, ${order.state} - ${order.pincode}`,
    "",
    "We will send tracking updates once your shipment is assigned.",
    "",
    "Shayveda Naturals",
  ].join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function orderConfirmationHtml(order) {
  const items = (order.orderItems || [])
    .map((item) => {
      const name =
        item.product?.name ||
        `Product ${item.productId}`;

      return `<li>${escapeHtml(name)} x ${escapeHtml(item.quantity)}</li>`;
    })
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #17211b;">
      <h2>Order confirmed</h2>
      <p>Hi ${escapeHtml(order.customerName)},</p>
      <p>Thank you for your Shayveda order <strong>${escapeHtml(order.orderNumber || order.id)}</strong>.</p>
      <p><strong>Total:</strong> Rs. ${escapeHtml(order.finalAmount)}</p>
      <p><strong>Payment:</strong> ${escapeHtml(order.paymentMethod)}</p>
      <h3>Items</h3>
      <ul>${items}</ul>
      <h3>Delivery address</h3>
      <p>
        ${escapeHtml(order.addressLine)}<br>
        ${escapeHtml(order.city)}, ${escapeHtml(order.state)} - ${escapeHtml(order.pincode)}
      </p>
      <p>We will send tracking updates once your shipment is assigned.</p>
      <p>Shayveda Naturals</p>
    </div>
  `;
}

function sesClient() {
  return new SESClient({
    region: envValue("AWS_SES_REGION"),
    credentials:
      envValue("AWS_ACCESS_KEY_ID") &&
      envValue("AWS_SECRET_ACCESS_KEY")
        ? {
            accessKeyId:
              envValue("AWS_ACCESS_KEY_ID"),
            secretAccessKey:
              envValue("AWS_SECRET_ACCESS_KEY"),
          }
        : undefined,
  });
}

async function sendOrderConfirmationEmail(order) {
  if (!order.email) {
    return {
      skipped: true,
      message: "Customer email is missing",
    };
  }

  if (!isEmailConfigured()) {
    return {
      skipped: true,
      message: "Email provider is not configured",
    };
  }

  const command = new SendEmailCommand({
    Source: envValue("ORDER_EMAIL_FROM"),
    Destination: {
      ToAddresses: [order.email],
    },
    ReplyToAddresses:
      envValue("ORDER_EMAIL_REPLY_TO")
        ? [envValue("ORDER_EMAIL_REPLY_TO")]
        : undefined,
    Message: {
      Subject: {
        Charset: "UTF-8",
        Data: orderConfirmationSubject(order),
      },
      Body: {
        Text: {
          Charset: "UTF-8",
          Data: orderConfirmationText(order),
        },
        Html: {
          Charset: "UTF-8",
          Data: orderConfirmationHtml(order),
        },
      },
    },
  });

  return sesClient().send(command);
}

module.exports = {
  isEmailConfigured,
  sendOrderConfirmationEmail,
};

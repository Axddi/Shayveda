const express = require("express");
const cors = require("cors");
require("dotenv").config();

const prisma = require("./config/db");

const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

app.use(cors());
app.use(express.json());


// TEST ROUTE
app.get("/", async (req, res) => {
  try {
    await prisma.$connect();

    res.send("Shayveda Backend + Database Connected");
  } catch (error) {
    console.log(error);

    res.status(500).send("Database connection failed");
  }
});


// PRODUCT ROUTES
app.use("/api/products", productRoutes);
app.use("/products", productRoutes);


// CART ROUTES
app.use("/api/cart", cartRoutes);
app.use("/cart", cartRoutes);

app.use("/api/orders", orderRoutes);
app.use("/orders", orderRoutes);
app.use(
  "/api/payment",
  paymentRoutes
);
app.use(
  "/payment",
  paymentRoutes
);
app.use(
  "/api",
  paymentRoutes
);
app.use(
  "/",
  paymentRoutes
);


const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

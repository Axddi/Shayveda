const prisma = require("../config/db");


// ADD TO CART
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    const userId = 1;

    // CHECK IF ITEM ALREADY EXISTS
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        userId,
        productId,
      },
    });

    // UPDATE QUANTITY
    if (existingItem) {
      const updatedItem = await prisma.cartItem.update({
        where: {
          id: existingItem.id,
        },
        data: {
          quantity: existingItem.quantity + quantity,
        },
      });

      return res.json(updatedItem);
    }

    // CREATE NEW ITEM
    const cartItem = await prisma.cartItem.create({
      data: {
        userId,
        productId,
        quantity,
      },
    });

    res.status(201).json(cartItem);

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Failed to add to cart",
    });
  }
};



// GET CART
exports.getCart = async (req, res) => {
  try {
    const userId = 1;

    const cartItems = await prisma.cartItem.findMany({
      where: {
        userId,
      },

      include: {
        product: true,
      },
    });


    // TOTALS
    let subtotal = 0;

    cartItems.forEach((item) => {
      subtotal += item.product.price * item.quantity;
    });


    // PREPAID DISCOUNT
    let prepaidDiscount = 0;

    if (subtotal >= 999) {
      prepaidDiscount = subtotal * 0.2;
    } else {
      prepaidDiscount = subtotal * 0.1;
    }


    const finalTotal = subtotal - prepaidDiscount;


    res.json({
      cartItems,
      subtotal,
      prepaidDiscount,
      finalTotal,
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Failed to fetch cart",
    });
  }
};



// UPDATE QUANTITY
exports.updateCartQuantity = async (req, res) => {
  try {
    const { id } = req.params;

    const { quantity } = req.body;

    const updatedItem = await prisma.cartItem.update({
      where: {
        id: Number(id),
      },

      data: {
        quantity,
      },
    });

    res.json(updatedItem);

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Failed to update quantity",
    });
  }
};



// REMOVE ITEM
exports.removeCartItem = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.cartItem.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      message: "Item removed",
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Failed to remove item",
    });
  }
};
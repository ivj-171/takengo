const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_KEY);
const PDFDocument = require('pdfkit');
const Product = require('../models/product');
const Order = require('../models/order');
const User = require('../models/user');

const ITEMS_PER_PAGE = 2;

exports.getProducts = async (req, res, next) => {
  try{
  const page = +req.query.page || 1;
  const numProducts = await Product.find().countDocuments()
  let totalItems = numProducts;
  const products = await Product.find().skip((page - 1) * ITEMS_PER_PAGE).limit(ITEMS_PER_PAGE);
    res.render('shop/product-list', {
        prods: products,
        pageTitle: 'Products',
        path: '/products',
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
      });
  }
    catch(err){
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.getProduct = async (req, res, next) => {
  try{
  const prodId = req.params.productId;
  const product = await Product.findById(prodId)
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products'
      });
  }
    catch(err){
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.getIndex = async (req, res, next) => {
  try{
  const page = +req.query.page || 1;
  const numProducts = await Product.find().countDocuments()
    let totalItems = numProducts;
  const products = await Product.find().skip((page - 1) * ITEMS_PER_PAGE).limit(ITEMS_PER_PAGE);
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
      });
    }
    catch(err) {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.getCart = async (req, res, next) => {
  try{
 const user = await User.findById(req.session.user._id).populate('cart.items.productId').exec()
 const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products
      });
  }
    catch(err){
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.postCart = async (req, res, next) => {
  try{
  const prodId = req.body.productId;
  const product = await Product.findById(prodId)
  await req.user.addToCart(product);
      res.redirect('/cart');
    }
    catch(err) {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.postCartDeleteProduct = async (req, res, next) => {
  try{
  const prodId = req.body.productId;
  await req.user.removeFromCart(prodId)
    res.redirect('/cart');
    }
    catch(err){
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.getCheckout = async (req, res, next) => {
  try{
  let total = 0;
  const user = await User.findById(req.session.user._id).populate('cart.items.productId').exec()
  let products = user.cart.items;
      products.forEach(p => {
        total += p.quantity * p.productId.price;
      });
  const session = await stripe.checkout.sessions.create({
             line_items: products.map(p => {
             return  {
              price_data: {
              currency: "INR",
              unit_amount: parseInt(Math.ceil(p.productId.price * 100)),
              product_data: {
              name: p.productId.title,
              description: p.productId.description,
                },
              },
              quantity: p.quantity,
             }
           }),
             mode: "payment",
             success_url: req.protocol + "://" + req.get("host") + "/checkout/success",
             cancel_url: req.protocol + "://" + req.get("host") + "/checkout/cancel",
          });
      res.render('shop/checkout', {
             path: '/checkout',
             pageTitle: 'Checkout',
             products: products,
             totalSum: total,
             sessionId: session.id
      });
    }
    catch(err) {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};
    
exports.getCheckoutSuccess = async (req, res, next) => {
  try{
  const user = await User.findById(req.session.user._id).populate('cart.items.productId').exec();
  const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
    await order.save();
    await req.user.clearCart();
      res.redirect('/orders');
    }
    catch(err) {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.postOrder = async (req, res, next) => {
  try{
  const user = await User.findById(req.session.user._id).populate('cart.items.productId').exec();
  const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
    await order.save();
    await req.user.clearCart();
    res.redirect('/orders');
    }
    catch(err){
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.getOrders = async (req, res, next) => {
  try{
  const orders = await Order.find({ 'user.userId': req.user._id });
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    }
    catch(err){
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.getInvoice = async (req, res, next) => {
  try{
  const orderId = req.params.orderId;
  const order = await Order.findById(orderId)
      if (!order) {
        return next(new Error('No order found.'));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('Unauthorized'));
      }
      const invoiceName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('data', 'invoices', invoiceName);

      const pdfDoc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + invoiceName + '"'
      );
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);

      pdfDoc.fontSize(26).text('Invoice', {
        underline: true
      });
      pdfDoc.text('-----------------------');
      let totalPrice = 0;
      order.products.forEach(prod => {
        totalPrice += prod.quantity * prod.product.price;
        pdfDoc
          .fontSize(14)
          .text(
            prod.product.title +
              ' - ' +
              prod.quantity +
              ' x ' +
              '$' +
              prod.product.price
          );
      });
      pdfDoc.text('---');
      pdfDoc.fontSize(20).text('Total Price: $' + totalPrice);

      pdfDoc.end();
      
    }
    catch(err){ next(err)};
};

const mongoose = require('mongoose');
const admin = require('firebase-admin');

require('dotenv').config();
const { validationResult } = require('express-validator');
const Product = require('../models/product');
const serviceAccount = require(process.env.FIREBASE_ADMIN_SDK_CONFIG);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'ivj171-b9f4c.appspot.com',
});

const storage = admin.storage();

const bucket = storage.bucket();




exports.getAddProduct = (req, res, next) => {
  res.render('admin/edit-product', {
    pageTitle: 'Add Product',
    path: '/admin/add-product',
    editing: false,
    hasError: false,
    errorMessage: null,
    validationErrors: []
  });
};

exports.postAddProduct = async (req, res, next) => {
  try {
    const { title, price, description } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(422).render('admin/edit-product', {
        pageTitle: 'Add Product',
        path: '/admin/add-product',
        editing: false,
        hasError: true,
        product: {
          title: title,
          price: price,
          description: description
        },
        errorMessage: 'Attached file is not an image.',
        validationErrors: []
      });
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      console.log(errors.array());
      return res.status(422).render('admin/edit-product', {
        pageTitle: 'Add Product',
        path: '/admin/add-product',
        editing: false,
        hasError: true,
        product: {
          title: title,
          price: price,
          description: description
        },
        errorMessage: errors.array()[0].msg,
        validationErrors: errors.array()
      });
    }

    // Upload the file to Firebase Cloud Storage
   
    const firebaseFileName = Date.now() + '-' + file.originalname;
    const firebaseFile = bucket.file(firebaseFileName);

    const stream = firebaseFile.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    });

    const imageUrlPromise = new Promise((resolve, reject) => {
      stream.on('error', (err) => {
        console.error(err);
        reject(new Error('Failed to upload image'));
      });

      stream.on('finish', () => {
        // File was uploaded successfully, resolve the promise with the Firebase Cloud Storage URL
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(firebaseFileName)}?alt=media`;
        resolve(imageUrl);
      });
    });

    stream.end(file.buffer);

    // Wait for the imageUrlPromise to resolve before proceeding to create and save the product
    const imageUrl = await imageUrlPromise;

    const product = new Product({
      title: title,
      price: price,
      description: description,
      imageUrl: imageUrl,
      userId: req.user
    });

    await product.save();

    res.redirect('/admin/products');
  } catch (err) {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  }
};


exports.getEditProduct = async (req, res, next) => {
  try{
  const editMode = req.query.edit;
  if (!editMode) {
    return res.redirect('/');
  }
  const prodId = req.params.productId;
  const product = await Product.findById(prodId);
      if (!product) {
      return res.redirect('/');
      }
      res.render('admin/edit-product', {
        pageTitle: 'Edit Product',
        path: '/admin/edit-product',
        editing: editMode,
        product: product,
        hasError: false,
        errorMessage: null,
        validationErrors: []
      });
    }
    
    catch(err) {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.postEditProduct = async (req, res, next) => {
  try{
  const prodId = req.body.productId;
  const updatedTitle = req.body.title;
  const updatedPrice = req.body.price;
  const image = req.file;
  const updatedDesc = req.body.description;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Edit Product',
      path: '/admin/edit-product',
      editing: true,
      hasError: true,
      product: {
        title: updatedTitle,
        price: updatedPrice,
        description: updatedDesc,
        _id: prodId
      },
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array()
    });
  }

  const product = await Product.findById(prodId)
      if (product.userId.toString() !== req.user._id.toString())
       {
        return res.redirect('/');
      }
      product.title = updatedTitle;
      product.price = updatedPrice;
      product.description = updatedDesc;
      if (image) {
        fileHelper.deleteFile(product.imageUrl);
        product.imageUrl = image.path;
      }
      await product.save()
        res.redirect('/admin/products');
    }    
    
    catch(err) {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.getProducts = async (req, res, next) => {
  try{
  const products = await Product.find({ userId: req.user._id })
  res.render('admin/products', {
        prods: products,
        pageTitle: 'Admin Products',
        path: '/admin/products'
     });
    }
  catch(err){
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
    };
};


exports.deleteProduct = async (req, res, next) => {
  try {
    const prodId = req.params.productId;
    const product = await Product.findById(prodId);
    if (!product) {
      return next(new Error('Product not found.'));
    }

    function getFileNameFromUrl(imageUrl) {
      const parts = imageUrl.split('/');
      let fileNameWithParams = parts[parts.length - 1];
      // If the URL contains query parameters, remove them
      if (fileNameWithParams.includes('?')) {
        fileNameWithParams = fileNameWithParams.split('?')[0];
      }
      // Decode the URL to handle any URL-encoded characters
      const fileName = decodeURIComponent(fileNameWithParams);
      return fileName;
    }
    
    const fileName = getFileNameFromUrl(product.imageUrl);
    console.log(fileName)
    

    const fileRef = bucket.file(fileName);

    try {
      await fileRef.delete();
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    await Product.deleteOne({ _id: prodId, userId: req.user._id });
    res.status(200).json({ message: 'Success!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Deleting product failed.' });
  }
};

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { validationResult } = require('express-validator');
const User = require('../models/user');

exports.getLogin = (req, res, next) => {
  let message = req.flash('error');
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/login', {
    path: '/login',
    pageTitle: 'Login',
    errorMessage: message,
    oldInput: {
      email: '',
      password: ''
    },
    validationErrors: []
  });
};

exports.getSignup = (req, res, next) => {
  let message = req.flash('error');
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/signup', {
    path: '/signup',
    pageTitle: 'Signup',
    errorMessage: message,
    oldInput: {
      email: '',
      password: '',
      confirmPassword: ''
    },
    validationErrors: []
  });
};

exports.postLogin = async (req, res, next) => {
  try{
  const email = req.body.email;
  const password = req.body.password;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render('auth/login', {
      path: '/login',
      pageTitle: 'Login',
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password
      },
      validationErrors: errors.array()
    });
  }

  const user = await User.findOne({ email: email })
    if (!user) {
        return res.status(422).render('auth/login', {
          path: '/login',
          pageTitle: 'Login',
          errorMessage: 'Invalid email or password.',
          oldInput: {
            email: email,
            password: password
          },
          validationErrors: []
        });
      }
      try{
     const doMatch = await bcrypt.compare(password, user.password)
        if (doMatch) {
            req.session.isLoggedIn = true;
            req.session.user = user;
            return req.session.save(err => {
              console.log(err);
              res.redirect('/');
            });
          }
          return res.status(422).render('auth/login', {
            path: '/login',
            pageTitle: 'Login',
            errorMessage: 'Invalid email or password.',
            oldInput: {
              email: email,
              password: password
            },
            validationErrors: []
          });
        }
        catch(err){
          console.log(err);
          res.redirect('/login');
        };
    }
    catch(err){
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.postSignup = async (req, res, next) => {
  try{
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render('auth/signup', {
      path: '/signup',
      pageTitle: 'Signup',
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password,
        confirmPassword: req.body.confirmPassword
      },
      validationErrors: errors.array()
    });
  }

  const hashedPassword = await bcrypt.hash(password, 12)
    const user = new User({
        email: email,
        password: hashedPassword,
        cart: { items: [] }
      });
      await user.save();
      res.redirect('/login');
  }
    catch(err){
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.postLogout = (req, res, next) => {
  req.session.destroy(err => {
    console.log(err);
    res.redirect('/');
  });
};

exports.getReset = (req, res, next) => {
  let message = req.flash('error');
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/reset', {
    path: '/reset',
    pageTitle: 'Reset Password',
    errorMessage: message
  });
};

exports.postReset = async (req, res, next) => {
  try{
  crypto.randomBytes(32,async (err, buffer) => {
    if (err) {
      console.log(err);
      return res.redirect('/reset');
    }
    const token = buffer.toString('hex');
    const user= await User.findOne({ email: req.body.email })
     if (!user) {
          req.flash('error', 'No account with that email found.');
          return res.redirect('/reset');
        }
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        await user.save();
        res.redirect('/');
    const testAccount=await nodemailer.createTestAccount()
    console.log('Ethereal SMTP Account:');
    console.log(`  Email: ${testAccount.user}`);
    console.log(`  Password: ${testAccount.pass}`);
    const transporter = nodemailer.createTransport({
           host: 'smtp.ethereal.email',
           port: 587,
           auth: {
           user: testAccount.user,
           pass: testAccount.pass
          
  }
})
        await transporter.sendMail({
        to: req.body.email,
        from: 'vijaykrishna6767@gmail.com',
        subject: 'Password reset',
        html: `
          <p>You requested a password reset</p>
          <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password.</p>
        `
    })
  })
}
        catch(err ) {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      }
  };

exports.getNewPassword = async (req, res, next) => {
  try{
  const token = req.params.token;
  const user = await User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } })
      let message = req.flash('error');
      if (message.length > 0) {
        message = message[0];
      } else {
        message = null;
      }
      res.render('auth/new-password', {
        path: '/new-password',
        pageTitle: 'New Password',
        errorMessage: message,
        userId: user._id.toString(),
        passwordToken: token
      });
    }
    catch(err) {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

exports.postNewPassword = async (req, res, next) => {
  try{
  const newPassword = req.body.password;
  const userId = req.body.userId;
  const passwordToken = req.body.passwordToken;

  const user = await User.findOne({
    resetToken: passwordToken,
    resetTokenExpiration: { $gt: Date.now() },
    _id: userId
  })
    let resetUser = user;
  const hashedPassword = await bcrypt.hash(newPassword, 12);
    resetUser.password = hashedPassword;
    resetUser.resetToken = undefined;
    resetUser.resetTokenExpiration = undefined;
    await resetUser.save();
    res.redirect('/login');
  }
    catch(err){
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    };
};

const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');
const multer = require('multer');
require('dotenv').config();
const errorController = require('./controllers/error');
const shopController = require('./controllers/shop');
const isAuth = require('./middleware/is-auth');
const User = require('./models/user');
const helmet=require('helmet');
const compression=require('compression');



const MONGODB_URI =
`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.dlp0bqu.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}`;

const app = express();
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: 'sessions'
});

const csrfProtection = csrf();



const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'frame-src': ["'self'", "https://js.stripe.com/"],
      'script-src': ["'self'", "https://js.stripe.com/v3/"],
      'img-src': ["https://firebasestorage.googleapis.com"],
      'object-src': ["'none'"],
    },
  })
);

app.use(compression());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(multer({ storage: multer.memoryStorage(), fileFilter: fileFilter }).single('image'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'my secret',
    resave: false,
    saveUninitialized: false,
    store: store
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  next();
});

app.use( async (req, res, next) => {
  try{
  if (!req.session.user) {
    return next();
  }
  const user = await User.findById(req.session.user._id)
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    }
  
    catch(err){
      next(new Error(err));
    };
});

app.post('/create-order', isAuth, shopController.postOrder);

app.use(csrfProtection);
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get('/500', errorController.get500);

app.use((error, req, res, next) => {
  console.trace(error)
  res.status(500).render('500', {
    pageTitle: 'Error!',
    path: '/500',
    isAuthenticated: req.session.isLoggedIn
  });
});

app.use(errorController.get404);
async function connectdb(){
  try{
 await mongoose.connect(MONGODB_URI)
 app.listen(process.env.PORT||3000);
  }
  catch(err){
    console.log(err);
  }
};
connectdb();

  
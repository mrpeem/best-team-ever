// node modules
const express = require("express");
const exphbs  = require('express-handlebars');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');
const path = require('path');
const morgan = require('morgan');
const methodOverride = require('method-override');
const multer = require('multer');


// use this library to interface with SQLite databases
const db = new sqlite3.Database('rest_api/database/users.db');
const app = express();


//register a Handlebars - Seo
// views/layouts/main.handlebars will be default Layout
// all partial layouts will be at views/partials
// in order to use partial layout in main.Handlebars
// use {{>partial_layout_file_name_here}}
// app.engine('handlebars', exphbs({defaultLayout: 'main'}));
// app.set('view engine', 'handlebars');


// all environments
app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');
app.use(morgan('dev'));
app.use(methodOverride());
app.use(express.static('static_files'));

// parse application/json
app.use(bodyParser.json());

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// parse multipart/form-data
//app.use(multer());


// Variables for linking to database
const accountsRoutes = require('./rest_api/routes/accounts');
const profilesRoutes = require('./rest_api/routes/profiles');
const medicineRoutes = require('./rest_api/routes/medicine');
const historyRoutes  = require('./rest_api/routes/history');
const checkAuth      = require('./rest_api/middleware/check-auth');


// Varaibles for linking to routes
const profiles = require('./routes/profiles');
const accounts = require('./routes/accounts');
const medicine = require('./routes/medicine');
const history  = require('./routes/history' );
const extra    = require('./routes/extra'   );


// Header (don't worry about this)
app.use((req, res, next) =>
{
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "PUT, POST, PATCH, DELETE, GET");
    return res.status(200).json({});
  }
  next();
});


//-----------------------------------------
//-----------ROUTES FOR MAIN APP-----------
//-----------------------------------------


// --------- Account related routes ---------

// Add new router for login page
app.get('/', accounts.login);

// Sign up page
app.get('/signup', accounts.signup);


// Add new router for Change Password page
app.get('/changePassword', accounts.changePassword);

// Add new router for settings page
app.use('/settings', accounts.settings);




// --------- Profile related routes ----------

// Add new router for Home page
app.use('/home', profiles.home);

// For viewing profile page
app.use('/viewProfiles', profiles.view);

// For viewing specific profile
app.use('/viewProfile/:profile_id', profiles.viewProfile);

// Add new router for Add a new profile page
app.post('/addNewProfile', profiles.addNewProfile);




// --------- Medicine related routes ---------

// Add new router for View All med page
app.use('/viewAllMed/:profile_id', medicine.viewAllMed);

// Add new router for Add New page
// Add a flag value so that it tells whether it should generate '<-' button in navigation or not'
app.post('/addNewMed/:profile_id', medicine.addNewMed);

// Add new router for View pill detail page
app.use('/viewPillDetail/:medicine_id', medicine.viewPillDetail);

// Add new router for editing medicine
app.use('/editMedicine/:medicine_id', medicine.editMedicine);



// --------- History related routes ---------

// Add new router for View History page
app.use('/viewHistory', history.viewHistory);

app.use('/viewProfileHistory/:profile_id', history.viewProfileHistory);

// Add new router for View History Date page
app.get('/viewHistoryDate', history.viewHistoryDate);

// Add new router for View History Date Detail page
app.get('/viewHistoryDateDetail', history.viewHistoryDateDetail);

// Add new router for View specific history
app.use('/viewHistoryDetail/:history_id', history.viewHistoryDetail);

// Add new router for View Pill History page
app.use('/viewPillHistory/:profile_id/:medicine_id', history.viewPillHistory);



// --------- Extra routes ---------
// Add new router for help page
app.get('/help', extra.help);

// For viewign preview (link from login page)
app.get('/viewPreview', extra.viewPreview);




//-----------------------------------------
//-----------ROUTES FOR DATABASE-----------
//-----------------------------------------
app.use('/api/accounts', accountsRoutes); // handle all requests for /api/accounts
app.use('/api/profiles', profilesRoutes); // handle all requests for /api/profiles
app.use('/api/medicine', medicineRoutes); // handle all requests for /api/medicine
app.use('/api/history',  historyRoutes);  // handle all requests for /api/history
app.use('/testauth', checkAuth, (req, res) => // check if token is valid
{
  res.send(req.userData);
});


// For error handling (don't worry about this)
app.use((req, res, next) =>
{
  const error = new Error("Not found");
  error.status = 404;
  next(error);
});

// For error handling (don't worry about this)
app.use((error, req, res, next) =>
{
  res.status(error.status || 500);
  res.json({
    error: {
      message: error.message
    }
  });
});


// To learn more about server routing:
// Express - Hello world: http://expressjs.com/en/starter/hello-world.html
// Express - basic routing: http://expressjs.com/en/starter/basic-routing.html
// Express - routing: https://expressjs.com/en/guide/routing.html

module.exports = app;

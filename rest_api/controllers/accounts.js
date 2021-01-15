/*
 * REST API controller for dealing witha all requests related to account.
 * Functions:
 * - getToken - generates JWT token 
 * - getAllAccounts - returns list of all accounts
 * - signup - check valid info and create new user
 * - login - check credentials and logs users in
 * - getAccountInfo - account information (email, password)
 * - editAccount - edit account info from db
 * - deleteAccount - delete account from db
 */

const jwt = require("jsonwebtoken");
const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');     

// use this library to interface with SQLite databases: https://github.com/mapbox/node-sqlite3
const db = new sqlite3.Database('rest_api/database/users.db');


/**
 * Helper function for generating JWT token based on useranme
 *
 * @param {username} username to put in token; used for authentication; REQUIRED
 * @param {account_id} id to put in token; used for finding account; REQUIRED
 * @param {profile_id} used for finding profile; OPTIONAL
 * @param {password} used for resetting password; OPTIONAL
 *
 * @return JWT token
 */
function getToken(username, account_id, profile_id, password)
{
  const token = { username: username, account_id: account_id };
  
  // add profile_id and/or password to token if not undefined
  (profile_id == undefined)? {} : token.profile_id = profile_id;
  (password == undefined)? {} : token.password = password;


  return jwt.sign(token, "secret key lel", { expiresIn: "1h" } );
}

/**
 * GET a list of all accounts. Only show usernames of user and nothing
 * else. Obviously only used for debugging (would be a breach if you show
 * everyone all accounts in database). Don't need to be signed in.
 *
 * @return array of usernames of all users
 */
 /**
 * GET list of all accounts. Only show usernames of user and nothing
 * else. Obviously only used for debugging (would be a breach if you show
 * everyone all accounts in database). Don't need to be signed in.
 *
 * Route signature: GET /accounts
 * Example call: localhost:3000/profiles
 * Expected: none
 *
 * @return 1) error 500 if error occured while searching for accounts. Otherwise
 *            -> {keys -> error}
 *         2) array of all accounts
 *            -> [ list of all accounts ]
 */
exports.getAllAccounts = (req, res) => 
{
  console.log('---')
  console.log('GET ALL ACCOUNTS');

  db.all(`SELECT username FROM accounts`, (err, rows) => 
  {
    if (err)
    {
      console.log(err);
      res.status(500).json( {error: err} );
    }
    else
    {
      const allUsernames = rows.map(e => e.username);
      console.log(allUsernames);
      res.status(200).json(allUsernames);
    }
    
  });

} // end of getAllAccounts()


 /**
 * Creates an account. If the inputted username and email doesn't exist,
 * create new account with the information and generate JWT token with
 * username.
 *
 * Route signature: POST /accounts/signup
 * Example call: localhost:3000/accounts/signup
 * Expected: body {username, email, password}
 *
 * @return 1) error 500 if error occured while creating account or hashing password
 *            -> {keys -> error}
 *         2) new token if valid username and/or email
 *            -> {keys -> message, token}
 *         3) error 409 (Conflict) if username and/or email already taken
 *            -> {keys -> error}
 */
exports.signup = (req, res) =>
{
  console.log('---');
  console.log('SIGNUP');

  const username = req.body.username;
  const email = req.body.email;
  
  db.all(
    `SELECT * FROM accounts WHERE username=$username OR email=$email`,
    {
      $username: username,
      $email: email
    },
    // callback function to run when the query finishes:
    (err, rows) => 
    {
      if (err)
      {
        console.log(err);
        res.status(500).json( {error: err} );
      }
      else
      {
        console.log('Username and/or email already exists: ',rows.length != 0);
        if (rows.length == 0) //valid username and email
        {
          //attempt to hash password
          bcrypt.hash(req.body.password, 10, (err, hash) =>
          {
            if (!err) //successful hash; store hashed password
            {
              const password = hash;
              db.run(
                `INSERT INTO accounts (username, password, email) 
                 VALUES ($username, $password, $email)`,
                {
                  $username: username,
                  $password: password,
                  $email: email,
                },
                // callback function to run when the query finishes:
                (err, rows) => 
                {
                  if (err) 
                  {
                    console.log(err);
                    res.status(500).json( {error: err} );
                  } 
                  else 
                  {
                    // find id of the newly created account
                    const query = "SELECT * FROM accounts WHERE username=?";
                    db.get(query, username, (err, account) =>
                    {
                      console.log('created account: ',account);
                      const token = getToken(username, account.id);
                      res.status(201).json( {account_id: account_id, token: token} );
                    });
                  }
                }
              );  

            } //end of !err
            else
            {
              return res.status(500).json( {error: err} );
            }
          }); //end of hash
        }
        else //username or email taken
        {
          res.status(409).json( {error: 'username and/or email already exists'} );
        }
      }
    }
  ); // end of db.all(...)

} // end of signup()


/**
 * Logs user in. First checks if user with the requested username
 * exists. If so, check if the password (after hashing it) is correct.
 * If so, create token with username.
 *
 * Route signature: POST /accounts/login
 * Example call: localhost:3000/accounts/login
 * Expected: body {username, password}
 *
 * @return 1) error 500 if error occured while searching for account. Otherwise
 *            -> {keys -> error}
 *         2) token if correct username and password, or 
 *            -> {keys -> message, token}
 *         3) error error 401 (Unauthorized) if incorrect password, or
 *            -> {keys -> error}
 *         3) error 404 (Not Found) if account with that username doesn't exist
 *            -> {keys -> error}
 */
exports.login = (req, res) =>
{
  console.log('---');
  console.log('LOGIN');

  const username = req.body.username;
  const password = req.body.password;

  db.all(
    `SELECT * FROM accounts WHERE username=$username`,
    {
      $username: username
    },
    // callback function to run when the query finishes:
    (err, rows) => 
    {
      if (err)
      {
        console.log(err);
        res.status(500).json( {error: err} );
      }
      else
      {
        if (rows.length != 0) //found user
        {
          //check if password is correct
          bcrypt.compare(password, rows[0].password, (err, result) =>
          {
            if (err || !result)
            {
              console.log("Incorrect password")
              res.status(401).json( {error: "incorrect password"} );
            }
            if (result)
            {
              console.log("Log in successful");
              const token = getToken(username, rows[0].id );
              res.status(200).json( {account_id: rows[0].id, token: token} );
            }

          });
        }
        else //user not found; doesn't exist or incorrect username
        {
          res.status(404).json( {error: '\"'+username+'\" does not exist'} );
        }
      }
    } // end of (err, row) =>
  ); // end of db.all(..)

} // end of login()


/**
 * Gets account's info (username, email, password). Must be logged in
 * If logged in, find the account info. 
 *
 * Route signature: GET /accounts/info
 * Example call: localhost:3000/accounts/info
 * Expected: token
 *
 * @return 1) error 500 if error occured while searching for account. Otherwise
 *            -> {keys -> error}
 *         2) account info if found, or
 *            -> {keys -> id, username, password, email}
 *         3) error 404 (Not Found) if account does not exist
 *            -> {keys -> error}
 * @return user's info if requested user exists, error message otherwise
 */
exports.getAccountInfo = (req, res) =>
{
  console.log('---');
  console.log("GET ACCOUNT INFO");
  const id = req.userData.account_id;
  const username = req.userData.username;

  const query = `SELECT id, username, email FROM accounts WHERE id=?`;
  db.all(query, [id], (err, rows) =>
  {
    if (rows.length > 0) 
    {
      console.log(rows[0]);
      res.status(200).json(rows[0]);
    } 
    else 
    {
      res.status(404).json( {error: '\"'+username+'\" does not exist'} );
    }
  }); // end of db.all(..)
} // end of getAccountInfo()



/**
 * Helper function for editing account.
 *
 * To update, need to do `UPDATE profiles SET column='value', col2='value'`
 * 'str' iterates through all of the requested columns to be edited and
 * makes string for the `column='value', column2='value'`
 *
 * This process could take a while, so need to do a callback.
 */
function substringForEdit(body, callback)
{
  let str = ``;
  for (const e in body)
  {
    str += e+`='`+body[[e]]+`', `;
  }
  str = str.substring(0, str.length-2); // remove the final comma from string
  callback(str);
}

/**
 * PATCH request for editing account. Must be logged in.
 * Edits the account with the requested id.
 * Front end will pass only the columns that user want edited and
 * this function will replace all of thost columns with new value.
 * 
 * The passed in body can contain all of the columns within profiles.
 * All are optional since users don't have to change all of them.
 *
 * Route signature: /accounts/edit
 * Example call: localhost:3000/accounts/edit
 * Expected: token, body { optional }
 *
 * @return 1) error 500 if error occured while editing profile. Otherwise
 *            -> {keys -> error}
 *         2) success message and profile id
 *            -> {keys -> message, id}
 */
exports.editAccount = (req, res) => 
{
  console.log('---');
  console.log('EDIT ACCOUNT');

  const account_id = req.userData.account_id;

  if (req.body.newPassword) // editing password
  {
    const currentPassword = req.body.currentPassword;

    db.get(`SELECT * FROM accounts WHERE id=?`, [account_id], (err, row) => 
    {
      if (err)
      {
        console.log(err);
        res.status(500).json( {error: err} );
      } 
      else // no error fetching account
      {
        //check if password is correct
        bcrypt.compare(currentPassword, row.password, (err, result) =>
        {
          if (err || !result)  // incorrect password
          {
            console.log("Incorrect password")
            res.status(401).json( {error: "incorrect password"} );
          }
          if (result) // correct password
          {
            console.log("Correct password");

            //attempt to hash password
            bcrypt.hash(req.body.newPassword, 10, (err, hash) =>
            {
              if (!err) // no error hashing passsword
              {
                let query = `UPDATE accounts SET password='`+hash+`' WHERE id=?`;
                db.all(query, [account_id], (err) =>
                {
                  console.log('err = '+err);
                  (err)?
                    res.status(500).json( {error: err} ) :
                    res.status(200).json( {account_id: row.id, 
                                           token: getToken(row.username, row.id)} ); 
                });

              }
              else // error hashing password
              {
                console.log(err);
                return res.status(500).json( {error: err} );
              }
            }); // end of hashing password
          }

        }); // end of bcrypt comparing password
      } // end of else for no error fetching account
    }); // end of db.get(..)

  }
  else  // editing username and/or email
  {
    const username = req.body.username;
    const email = req.body.email;

    // check if username and/or email is taken; doesn't matter if user didn't
    // input anything since it'll be 'undefined', which will make it
    // unique anyway
    db.all(
      `SELECT * FROM accounts WHERE username=? OR email=?`, [username, email], 
      (err, rows) => 
      {
        if (err)
        {
          console.log(err);
          res.status(500).json( {error: err} );
        }
        else
        {
          // valid username and email; continue with editing process
          if (rows.length == 0) 
          {
            console.log('replace current info with: \n',req.body);
            substringForEdit(req.body, (str) => // get substring for query
            {
              let query = `UPDATE accounts SET `+str+` WHERE id=?`;
              db.all(query, [account_id], (err) =>
              {
                if (err) // error editing account
                {
                  console.log('err = '+err);
                  res.status(500).json( {error: err} );
                }
                else
                {
                  // create new token; check if username has been changed
                  let username;
                  if (req.body.username)
                    username = req.body.username;
                  else
                    username = req.userData.username;

                  const token = getToken(username, req.userData.account_id);
                  res.status(200).json( {message: 'Account edited', token: token} )
                }
              }); // end of db.all(..) for editing account
            });  // end of substringForEdit callback
          } // end of check for valid username and email
          else
          {
            console.log('username and/or email already exists')
            res.status(409).json( {error: 'username and/or email already exists'} );
          }
        }
      }); // end of db.all(..)
  } // end of else for editing username and/or email

} // end of editAccount()



/**
 * DELETE request for deleting profile. Must be logged in.
 * If the account_id and profile_id of the requested profile are correct, 
 * delete the profile and all medicine belonging to the profile.
 *
 * Route signature: /profiles/delete/:profile_id
 * Example call: localhost:3000/profiles/delete/5
 * Expected: token
 *
 * @return 1) error 500 if error occured while deleting profile. Otherwise
 *            -> {keys -> error}
 *         2) success message
 *            -> {keys -> message}
 */
exports.deleteAccount = (req, res) => 
{

  console.log('DELETE ACCOUNT');

  const account_id = req.userData.account_id;

  let query = `DELETE FROM medicine WHERE account_id=?`;
  db.all(query, [account_id], (err) =>
  {
    console.log('delete medicine; err = '+err);
    if (err)
    {
      res.status(500).json( {error: err} );
    }
    else // no error deleting medicine
    {
      query = `DELETE FROM profiles WHERE account_id=?`;
      db.all(query, [account_id], (err) =>
      {
        console.log('delete profile; err = '+err);
        if (err)
        {
          res.status(500).json( {error: err} );
        }
        else
        {
          query = `DELETE FROM accounts WHERE id=?`;
          db.all(query, [account_id], (err) =>
          {
            console.log('delete account; err = '+err);
            (err)? 
              res.status(500).json( {error: err} ) : 
              res.status(200).json( {message: 'Account deleted'} )
          }); // end of db.all(..) deleting accounts

        } // end of deleting profiles
      }); // end of db.all(..) deleting profiles

    } // end of deleting medicine
  }); //end of db.all(..) deleting medicine

} // end of deleteProfile()
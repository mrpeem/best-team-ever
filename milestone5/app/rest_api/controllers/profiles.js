const jwt = require("jsonwebtoken");
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');     

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
 * GET list of all of user's profile. Must be logged in.
 * If logged in, find the with requested name. 
 *
 * Route signature: GET /profiles
 * Example call: localhost:3000/profiles
 * Expected: token
 *
 * @return 1) error 500 if error occured while searching for profile. Otherwise
 *            -> {keys -> error}
 *         2) array of profiles if found or 
 *            -> [ {keys -> id, firstName, lastName}, {..}, {..} ]
 *         3) error 404 (Not Found) if no profiles
 *            -> {keys -> error}
 */
exports.getAllProfiles = (req, res) =>
{
  console.log('---');
  console.log("GET ALL PROFILES");
  const username = req.userData.username;
  const account_id = req.userData.account_id;


  db.all(
    'SELECT * FROM profiles WHERE profiles.account_id = $account_id',
    {
      $account_id: account_id
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
        let allProfiles = rows.map(e => 
        { 
          return { id: e.id, 
                   firstName: e.firstName, 
                   lastName: e.lastName, 
                   default: e.isDefault } 
        });
        console.log(allProfiles);

        (rows.length > 0)?
          res.status(200).json(allProfiles) :
          res.status(404).json( {error: '\"'+username+'\" doesn\'t have any profiles'} );
      } 
    } // end of (err, rows) => {}
  ); // end of db.all(..)

} // end of getAllProfiles()




/**
 * Creates new profile for the requested account. Must be logged in.
 * 
 * Route signature: POST /profiles/new
 * Example call: localhost:3000/profiles/new
 * Expected: token, body {username, firstName, lastName, gender, dob}
 *
 * @return 1) error 500 if error occured while creating profile. Otherwise
 *            -> {keys -> error}
 *         2) created profile's id (so user can look it up) and new token 
 *            -> {keys -> id, token}
 */
exports.newProfile = (req, res) => 
{
  console.log('---');
  console.log("CREATE NEW PROFILE");
  console.log('profile to create:\n', req.body, '\n');

  const username = req.userData.username;
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const dob = req.body.dob;
  const gender = req.body.gender;
  const account_id = req.userData.account_id;

  db.all('SELECT * FROM profiles WHERE profiles.account_id = ?', [account_id],
    (err, rows) => 
    {
      if (err)
      {
        console.log(err);
        res.status(500).json( {error: err} );
      }
      else
      {
        // make profile default if this will be first profile in account
        const isDefault = (rows.length == 0)? 1 : 0;
        
        db.run(
          `INSERT INTO profiles
           VALUES ($id, $firstName, $lastName, $dob, $gender, 
                   $isDefault, $isCurrent, $account_id)`,
          {
            $id : null,
            $firstName: firstName,
            $lastName: lastName,
            $dob: dob,
            $gender: gender,
            $isDefault: isDefault,
            $isCurrent: isDefault,
            $account_id: account_id
          },
          // callback function to run when the query finishes:
          (err) => 
          {
            if (err) 
            {
              console.log(err);
              res.status(500).json( {error: err} );
            } 
            else 
            {
              // find ID of the newly created profile to create token from it
              const query = 'SELECT * FROM profiles WHERE account_id=?';
              db.all(query, [account_id], (err, rows) =>
              {
                const allId = rows.map(e => e.id);

                // if multiple profiles w/ same name, new one will have highest id
                const max = Math.max(...allId);

                console.log('found '+allId.length+' profile(s) within this account');
                console.log('IDs found: ', JSON.stringify(allId));
                console.log('ID of the new profile = ' + max);

                const token = getToken(username, account_id, max);
                res.status(201).json( {id: max, token: token} );
              }); // end of db.all(..) for new profile id
            }
          } // end of (err) =>
        ); // end of db.run(`INSERT..`) for creating profile 
      } 
    } // end of (err, rows) => {}
  ); // end of db.all(..)

} // end of newProfile()


exports.getDefault = (req, res, next) =>
{
  console.log('---');
  console.log('GET DEFAULT PROFILE');
  const username = req.userData.username;
  const account_id = req.userData.account_id;


  const query = `SELECT * FROM profiles WHERE account_id=? AND isDefault=?`;
  db.get(query, [account_id, 1], (err, row) =>
  {
    console.log(row);
    if (row)
    {
      row.token = getToken(username, account_id, row.id);
      req.profile = row;
      next();
      
    }
    else
    {
      res.status(200).json({error: 'No profiles found'});
    }
  })
}

exports.getCurrent = (req, res, next) =>
{
  console.log('---');
  console.log('GET CURRENT PROFILE');
  const username = req.userData.username;
  const account_id = req.userData.account_id;


  const query = `SELECT * FROM profiles WHERE account_id=? AND isCurrent=?`;
  db.get(query, [account_id, 1], (err, row) =>
  {
    console.log(row);
    if (row)
    {
      row.token = getToken(username, account_id, row.id);
      req.profile = row;
      next();
      
    }
    else
    {
      res.status(200).json({error: 'No profiles found'});
    }
  });
}

/**
 * GET profile data for an account. Must be logged in.
 * If logged in, find the with requested name. 
 *
 * Route signature: GET /profiles/:profile_id
 * Example call: localhost:3000/profiles/2
 * Expected: token
 *
 * @return 1) error 500 if error occured while searching for profile. Otherwise
 *            -> {keys -> error}
 *         2) profile information if found or 
 *            -> {keys -> id, firstName, lastName, gender, dob, account_id}
 *         3) error 404 (Not Found) if profile not found
 *            -> {keys -> error}
 */
exports.getProfile = (req, res, next) =>
{
  console.log('---')
  console.log("GET PROFILE")
  const username = req.userData.username;
  const profile_id = req.params.profile_id;
  const account_id = req.userData.account_id;

  db.get(
    `SELECT profiles.id, firstname, lastname, gender, dob, 
            account_id, isDefault, isCurrent 
     FROM accounts, profiles 
     WHERE profiles.id = $profile_id AND accounts.id = $account_id`,
    {
      $profile_id: profile_id,
      $account_id: account_id
    },
    // callback function to run when the query finishes:
    (err, row) => 
    {
      if (err)
      {
        console.log(err);
        res.status(500).json( {error: err} );
      }
      else 
      {
        console.log('fetched profile (current profile): \n',row);
        const fetchedProfile = row;
        if (fetchedProfile) //found profile
        {
          const newCurrentProfile = fetchedProfile.id;
          // check if profile is already current; if not, set as current
          if (fetchedProfile.isCurrent != 1) // not already current
          {
            // get current profile id
            let query = `SELECT * FROM profiles WHERE account_id=? AND isCurrent=?`;
            db.get(query, [account_id, 1], (err, row) =>
            {
              console.log('previously selected profile: ', row.firstName+' '+row.lastName);
              if (row)
              { 
                const previousCurrentProfile = row.id;

                let query = `UPDATE profiles SET isCurrent=0 
                             WHERE id=? AND account_id=?`;
                db.all(query, [previousCurrentProfile, account_id], (err) =>
                {
                  console.log('err = '+err);

                  if (err)
                    res.status(500).json( {error: err} );
                  else
                  {
                    let query = `UPDATE profiles SET isCurrent=1 
                                 WHERE id=? AND account_id=?`;
                    db.all(query, [newCurrentProfile, account_id], (err) =>
                    {
                      if (err)
                        res.status(500).json( {error: err} );
                      else
                      {
                        fetchedProfile.token = getToken(username, account_id, profile_id);
                        console.log()
                        req.profile = fetchedProfile;
                        next();
                      }
                    });  
                  }
                  
                }); // end of db.all(..) for editing
                
                
              }
              else
              {
                res.status(200).json({error: 'No profiles found'});
              }
            });  
          } // end of checking if profile is already current
          else // profile already current
          {
            fetchedProfile.token = getToken(username, account_id, profile_id);
            req.profile = fetchedProfile;
            next();
          }
        } // end of if(row) to check if profile found
        else
        {
          res.status(404).json( {error: 'Profile id '+profile_id+' does not exist'} );
        }
      }

    } // end of (err, row) =>
  ); // end of db.get(..)

} // end of getProfile()



/**
 * PATCH request for editing profile. Must be logged in.
 * Edits the profile with the requested id and params passed in.
 * Front end will pass only the columns that user want edited and
 * this function will replace all of thost columns with new value.
 * 
 * The passed in body can contain all of the columns within profiles.
 * All are optional since users don't have to change all of them.
 *
 * Route signature: /profiles/edit/:profile_id
 * Example call: localhost:3000/profiles/edit/5
 * Expected: token, body { optional }
 *
 * @return 1) error 500 if error occured while editing profile. Otherwise
 *            -> {keys -> error}
 *         2) success message and profile id
 *            -> {keys -> message, id}
 */
exports.editProfile = (req, res) => 
{
  console.log('---');
  console.log('EDIT PROFILE');
  console.log(req.body);

  const id = req.params.profile_id;
  const account_id = req.userData.account_id;

  // to update, need to do `UPDATE profiles SET column='value', col2='value'`
  // 'str' iterates through all of the requested columns to be edited and
  // makes string for the `column='value', column2='value'`
  let str = ``;
  for (const e in req.body)
  {
    str += e+`='`+req.body[[e]]+`', `;
  }
  str = str.substring(0, str.length-2); // remove the final comma from string

  let query = `UPDATE profiles SET `+str+` WHERE id=? AND account_id=?`;
  db.all(query, [id, account_id], (err) =>
  {
    console.log('err = '+err);

    (err)? 
      res.status(500).json( {error: err} ) : 
      res.status(200).json( {message: 'Profile edited', id: id} )

  }); // end of db.all(..) for editing
} // end of editProfile()



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
exports.deleteProfile = (req, res) => 
{
  console.log('---');
  console.log('DELETE PROFILE');

  const profile_id = req.userData.profile_id;
  const account_id = req.userData.account_id;

  let query = `DELETE FROM medicine WHERE account_id=? AND profile_id=?`;
  db.all(query, [account_id, profile_id], (err) =>
  {
    console.log('delete medicine; err = '+err);
    if (err)
    {
      res.status(500).json( {error: err} );
    }
    else
    {
      query = `DELETE FROM profiles WHERE account_id=? AND id=?`;
      db.all(query, [account_id, profile_id], (err) =>
      {
        console.log('delete profile; err = '+err);
        (err)? 
          res.status(500).json( {error: err} ) : 
          res.status(200).json( {message: 'Profile deleted'} )
      });
    }
  }); //end of db.all(..)
} // end of deleteProfile()


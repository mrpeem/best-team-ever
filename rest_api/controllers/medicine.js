/*
 * REST API controller for dealing witha all requests related to medicine.
 * Functions:
 * - getAllMedicine - returns list of all medicine for given profile
 * - newMedicine - create new medicine for given profile
 * - getMedicine - get medicien info for specific preofile
 * - editMedicine - edit medicine from db
 * - deleteMedicine - delete medicine from db
 */


const jwt = require("jsonwebtoken");
const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');     

// use this library to interface with SQLite databases: https://github.com/mapbox/node-sqlite3
const db = new sqlite3.Database('rest_api/database/users.db');


/**
 * GET a list of all medicine for a profile. Find medicine belonging to the
 * correct profile by checking account_id and profile_id.
 *
 * Route signature: GET /medicine
 * Example call: localhost:3000/medicine
 * Expected: token
 *
 * @return 1) erorr 500 if error occured while searching for medicine. Otherwise
 *            -> {keys -> error}
 *         2) array of all of profile's medicine if any exists, or 
 *            -> [ {keys -> id, medicinename}, {..}, {..} ]
 */
exports.getAllMedicine = (req, res) => 
{
  console.log('---');
  console.log('GET ALL MEDICINE')

  const profile_id = req.params.profile_id || req.profile.id;

  db.all(
    `SELECT * FROM medicine 
     WHERE account_id=$account_id 
     AND   profile_id=$profile_id`,
    {
      $account_id: req.userData.account_id,
      $profile_id: profile_id
    }, 
    (err, rows) => 
    {
      if (err) 
      {
        console.log(err);
        res.status(500).json( {error: err} );
      }
      else
      {
        const allMed = rows.map(e => 
        { 
          return {id: e.id, medicinename: e.medicinename, 
                  image: e.med_type+'-'+e.med_color+'.png'} 
        });
        console.log('all med: \n', allMed);

        // request came from find profile
        if (req.profile)
        {
          req.profile.medicine = allMed;
          res.status(200).json(req.profile);
        }
        else // request directly from backend
        {
          res.status(200).json( {profile_id: profile_id, medicine: allMed} );
        }
        
      }
    }
  ); // end of db.all(...)

} // end of getAllMedicine()




/**
 * Creates new medicine for the requested profile. Must be logged in.
 * 
 * Route signature: POST /medicine/new
 * Example call: localhost:3000/medicine/new
 * Expected: token, body {medicinename, dosage, num_pills, recurrence_hour,
                          times_per_day, start_date, start_time, end_date,
                          end_time, med_type, med_color}
 *
 * @return 1) error 500 if error occured while creating medicine. Otherwise
 *            -> {keys -> error}
 *         2) message saying medicine has been created and medicine id 
 *            -> {keys -> message, id}
 */
exports.newMedicine = (req, res, next) => 
{
  console.log('---');
  console.log("CREATE NEW MEDICINE");
  console.log('medicine to create:\n', req.body, '\n');

  db.run(
    `INSERT INTO medicine
     VALUES ($id, $medicinename, $dosage, $num_pills, $recurrence_hour, 
             $times_per_day, $start_date, $start_time, $end_date, $end_time,
             $med_type, $med_color, $account_id, $profile_id)`,
    {
      $id : null,
      $medicinename : req.body.medicinename,
      $dosage : req.body.dosage,
      $num_pills : req.body.num_pills,
      $recurrence_hour : req.body.recurrence_hour,
      $times_per_day : req.body.times_per_day,
      $start_date : req.body.start_date,
      $start_time : req.body.start_time,
      $end_date : req.body.end_date,
      $end_time : req.body.end_time,
      $med_type : req.body.med_type,
      $med_color : req.body.med_color,
      $account_id : req.userData.account_id,
      $profile_id : req.params.profile_id
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
        const account_id = req.userData.account_id;
        const profile_id = req.params.profile_id

        // find ID of the newly created medicine to create token from it
        const query = 'SELECT * FROM medicine WHERE account_id=? AND profile_id=?';
        db.all(query, [account_id, profile_id], (err, rows) =>
        {
          const allId = rows.map(e => e.id);

          // if multiple profiles w/ same name, new one will have highest id
          const max = Math.max(...allId);

          console.log('found '+allId.length+' medicine(s) within this profile');
          console.log('IDs found: ', JSON.stringify(allId));
          console.log('ID of the new medicine = ' + max);
          req.medicine_id = max;
          next();
        }); // end of db.all(..) for new medicine id
        
      }
    } // end of (err) =>
  ); // end of db.run(`INSERT..`) for creating medicine 

} // end of newMedicine()



/**
 * GET medicine data for profile. Must be logged in.
 * If logged in, find the with requested profile name and account name
 *
 * Route signature: GET /medicine/:medicine_id
 * Example call: localhost:3000/medicine/2
 * Expected: token
 *
 * @return 1) error 500 if error occured while searching for medicine. Otherwise
 *            -> {keys -> error}
 *         2) medicine information if found or 
 *            -> {keys -> id, medicinename, dosage, num_pills, recurrence_hour,
 *                        times_per_day, start_date, start_time, end_date,end_time,
 *                        med_type, med_color, med_pic, account_id, profile_id}
 *         3) empty object if medicine not found
 *            -> {}
 */
exports.getMedicine = (req, res) => 
{
  console.log('---');
  console.log('GET MEDICINE');

  const id = req.params.medicine_id;
  const account_id = req.userData.account_id;

  const query = `SELECT * FROM medicine WHERE id=? AND account_id=?`;
  db.get(query, [id, account_id], (err, row) => 
    {
      if (err)
      {
        console.log(err);
        res.status(500).json( {error: err} );
      }
      else
      {
        row.med_pic = row.med_type+'-'+row.med_color+'.png';
        console.log('medicine: ',row);
        (row)? //check if medicine found
          res.status(200).json(row) :
          res.status(200).json( {} )  
      }
    }
  );

} // end of getMedicine()




/**
 * PATCH request for editing medicine. Must be logged in.
 * Edits the medicine with the requested id and params passed in.
 * Front end will pass only the columns that user want edited and
 * this code will replace all of thost columns with new value.
 * 
 * The passed in body can contain all of the columns within medicine.
 * All are optional since users don't have to change all of them.
 *
 * Route signature: /medicine/:medicine_id
 * Example call: /medicine/5
 * Expected: token, body { optional }
 *
 * @return 1) error 500 if error occured while editing medicine. Otherwise
 *            -> {keys -> error}
 *         2) success message and medicine id
 *            -> {keys -> message, id}
 */
exports.editMedicine = (req, res) => 
{
  console.log('---');
  console.log('EDIT MEDICINE');
  const id = req.params.medicine_id;
  const account_id = req.userData.account_id;

  // to update, need to do `UPDATE medicine SET column='value', col2='value'`
  // 'str' iterates through all of the requested columns to be edited and
  // makes string for the `column='value', column2='value'`
  let str = ``;
  for (const e in req.body)
  {
    str += e+`='`+req.body[[e]]+`', `;
  }
  str = str.substring(0, str.length-2); // remove the final comma from string

  let query = `UPDATE medicine SET `+str+` WHERE id=? AND account_id=?`;
  db.all(query, [id, account_id], (err) =>
  {
    console.log('err = '+err);

    (err)? 
      res.status(500).json( {error: err} ) : 
      res.status(200).json( {message: 'Medicine edited', id: id} )

  }); // end of db.all(..) for editing
} // end of editMedicine()



/**
 * DELETE request for deleting medicine. Must be logged in.
 * Checks that the account_id and profile_id of the requested medicine
 * match. If so, delete the medicine.
 *
 * Route signature: /medicine/delete/:medicine_id
 * Example call: localhost:3000/medicine/delete/5
 * Expected: token
 *
 * @return 1) error 500 if error occured while deleting medicine. Otherwise
 *            -> {keys -> error}
 *         2) success message
 *            -> {keys -> message}
 */
exports.deleteMedicine = (req, res) => 
{
  console.log('DELETE MEDICINE');

  const id = req.params.medicine_id;
  const account_id = req.userData.account_id;

  const query = `DELETE FROM medicine WHERE id=? AND account_id=?`;
  db.all(query, [id, account_id], (err, rows) =>
  {
    console.log('err = '+err);
    console.log(rows);
    (err)? 
      res.status(500).json( {error: err} ) : 
      res.status(200).json( {message: 'Medicine deleted'} )
  });
} // end of deleteMedicine()


module.exports = function(connection) {
  
  function findById(id, cb) {
    process.nextTick(() => {
      connection.get('SELECT id, name FROM user WHERE id = ?', id)
      .then(row => {
        if (row) {
          cb(null, row)
        } else {
          cb(new Error(`User ${id} does not exist`))
        }
      })
    })
  }

  function findOrCreate(profile, cb) {
    process.nextTick(() => {
      connection.get('SELECT id, name FROM user WHERE id = ?', profile.id)
      .then(row => {
        if (row) { cb(null, row) }
        else {
          console.log('Creating user: ', profile)
          connection.run('INSERT INTO user(id, name, email) VALUES (?, ?, ?)', profile.id, profile.displayName, _email(profile))
          .then(() => cb(null, profile))
          .catch(err => cb(err))
        }
      })
    })
  }
  function _email(profile) {
    return profile.emails && profile.emails[0] && profile.emails[0].value || 'Declined To Provide'
  }

  function fetch() {
    return connection.all('SELECT * FROM user')
  }

  // create the table, if necessary
  function initDb(table) {
    return table('user', 'CREATE TABLE user(id PRIMARY KEY, name NOT NULL, email NOT NULL)')
  }
  
  return {
    _initDb: initDb,
    findById: findById,
    findOrCreate: findOrCreate,
    fetch: fetch
  }
}
module.exports = function(connection) {

  function create(user, name) {
    const code = require('crypto').createHash('md5').update(user.id + name).digest("hex")
    return connection.run("INSERT INTO season(name, admin, code) VALUES (?, ?, ?)", name, user.id, code)
      .then(cursor => ({ id: cursor.lastID, code: code }))
  }
  
  function join(code, user) {
    return connection.get('SELECT id FROM season WHERE code = ?', code)
      .then(row => row ? row.id : null)
      .then(id => id ? connection.run('INSERT OR REPLACE INTO season_user(ixSeason, ixUser) VALUES (?, ?)', id, user.id)
            .then(() => id) : id)
  }
  
  function find(user) {
    return connection.all('\
SELECT season.id \
FROM season JOIN season_user su ON season.id = su.ixSeason \
WHERE su.ixUser = ? \
ORDER BY season.id DESC \
LIMIT 1', user.id)
      .then(seasons => seasons[0] ? seasons[0].id : null)
  }
  
  function fetch(ixSeason, ixUser) {
    return connection.all('\
SELECT season.id, season.name, season.admin, user.id AS ixUser, user.name AS userName \
FROM (season JOIN season_user ON season.id = season_user.ixSeason AND season_user.ixUser = ?) \
  JOIN season_user AS su ON season.id = su.ixSeason \
  JOIN user ON user.id = su.ixUser \
WHERE season.id = ? \
ORDER BY user.id', ixUser, ixSeason)
    .then(rows => rows.reduce(usersReduce, {}))
  }

  // create the table, if necessary
  function initDb(table) {
    return table('season', '\
CREATE TABLE season(\
 id INTEGER PRIMARY KEY,\
 name NOT NULL,\
 admin NOT NULL REFERENCES user(id),\
 code NOT NULL UNIQUE\
)')
      .then(() => table('season_user', '\
CREATE TABLE season_user(\
 id INTEGER PRIMARY KEY,\
 ixSeason NOT NULL REFERENCES season(id) ON DELETE CASCADE,\
 ixUser NOT NULL REFERENCES user(id) ON DELETE CASCADE,\
 UNIQUE (ixSeason, ixUser)\
)'))
  }
  
  return {
    _initDb: initDb,
    create: create,
    join: join,
    find: find,
    fetch: fetch,
  }
}

function usersReduce(season, row) {
  // console.log('usersReduce: ' + JSON.stringify(row))
  if (!season.id) {
    season.id = row.id
    season.name = row.name
    season.admin = row.admin
    season.pickers = []
  }
  let user = { id: row.ixUser, displayName: row.userName }
  season.pickers.push(user)
  if (row.ixUser === season.admin) {
    season.admin = user
  }
  return season
}
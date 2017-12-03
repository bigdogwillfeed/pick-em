/* global Map */
const TBD = ['TBD']

module.exports = function(connection) {  
  
  // schedule = [ { date: "string", games: [ { home: "string", away: "string" }, ...] }, ... ]
  function create(ixSeason, name, schedule) {
    return connection.run("INSERT OR REPLACE INTO week(ixSeason, name, schedule) VALUES (?,?,?)", ixSeason, name, JSON.stringify(schedule))
      .then(cursor => cursor.lastID)
  }

  // picks = [ "string", ... ]
  function pick(ixWeek, ixUser, picks) {
    // should include user id in SELECT to avoid inserting picks by authed users who aren't in the season
    return connection.get("SELECT id FROM week WHERE id = ? AND fClosed = 0", ixWeek)
      .then(row => row ? row.id : null)
      .then(ixWeek => ixWeek ? connection.run("INSERT OR REPLACE INTO picks(ixUser, ixWeek, picks) VALUES (?,?,?)", ixUser, ixWeek, JSON.stringify(picks)) : false)
      .then(ok => !!ok)
  }
  
  function find(ixWeek, user) {
    return connection.get('\
SELECT week.id \
FROM season JOIN week ON season.id = week.ixSeason \
WHERE week.id = ? AND season.admin = ?', ixWeek, user.id)
      .then(week => week ? week.id : null)
  }
  
  function close(ixWeek) {
    return winners(ixWeek, TBD)
  }
  
  function winners(ixWeek, winners) {
    winners = winners || []
    let fClosed = (winners.length > 0) ? 1 : 0
    return connection.run("UPDATE week SET fClosed = ?, winners = ? WHERE id = ?", fClosed, JSON.stringify(winners), ixWeek)
  }
  
  function fetchAll(ixSeason, ixUser) {
    return connection.all("\
SELECT week.id, week.name, week.schedule, picks.ixUser, picks.picks, week.winners \
FROM week JOIN season ON week.ixSeason = season.id \
  LEFT JOIN picks ON week.id = picks.ixWeek \
WHERE season.id = ? \
ORDER BY week.id, picks.id", ixSeason)
    .then(rows => rows.reduce(picksReduceFn(ixUser), new Map()))
    .then(weeks => [...weeks.values()])
  }

  // create the table, if necessary
  function initDb(table) {
    return table('week', "\
CREATE TABLE week(\
  id INTEGER PRIMARY KEY,\
  name NOT NULL,\
  ixSeason NOT NULL REFERENCES season(id),\
  fClosed NOT NULL DEFAULT 0,\
  schedule NOT NULL,\
  winners NOT NULL DEFAULT '[]',\
  UNIQUE(ixSeason, name)\
)")
    .then(() => table('picks', '\
CREATE TABLE picks(\
  id INTEGER PRIMARY KEY,\
  ixWeek NOT NULL REFERENCES week(id),\
  ixUser NOT NULL REFERENCES user(id),\
  picks NOT NULL,\
  UNIQUE(ixWeek, ixUser)\
)'))
   }
  
  return {
    _initDb: initDb,
    create: create,
    pick: pick,
    find: find,
    close: close,
    winners: winners,
    fetchAll: fetchAll,
  }
}

function picksReduceFn(ixUser) {
  return function(weeks, row) {
    // console.log(row)
    if (!weeks.has(row.id)) weeks.set(row.id, {
      id: row.id,
      name: row.name,
      schedule: JSON.parse(row.schedule),
      picks: [],
      winners: JSON.parse(row.winners)
    })
    if (row.ixUser) {
      weeks.get(row.id).picks.push({
        user: row.ixUser,
        // ONLY return other people's picks if the week is closed
        picks: (row.ixUser === ixUser || row.winners != '[]') ? JSON.parse(row.picks) : TBD
      })
    }
    return weeks
  }
}
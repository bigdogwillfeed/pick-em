/*

season = {
  id: int,
  name: "string",
  admin: user,
  pickers: [ user, ...],
  weeks: [ week, ...]
}

user = {
  displayName: "string",
  id: "string",
  ...
}

week = {
  id: int,
  name: "string",
  schedule: [
    { date: "string",
      games: [ { home: "string", away: "string" }, ...]
    }, ...],
  picks: [
    { user: user.id, picks: [ "string", ... ] },
    ...],
  winners: [ "string", ... ]
}

*/

module.exports = function(options) {
  options = Object.assign({
    dir: '.data',
    db: 'sqlite',
  }, options)
  
  // sqlite3 object
  const conn = openConnection(path(options)),
  
      // our db wrapper
      db = {
        store: createStore,
        user: require('./user')(conn),
        week: require('./week')(conn),
        season: require('./season')(conn),
      }

  // allow sessions to be stored in this db
  function createStore(session) {
    const store = require('connect-sqlite3')(session)
    return new store(options)
  }
  
  initDbIfNeeded(db, ensureTableFn(conn)).then(() => db.initialized = true)
  
  return db
}

// silly path-from-options to play nice with sessions (provided by connect-sqlite3)
function path(options) {
  return options.dir + '/' + options.db + '.db'
}

// make sure the database exists and is happy
function initDbIfNeeded(db, fn) {
  return db.user._initDb(fn)
    .then(() => db.season._initDb(fn))
    .then(() => db.week._initDb(fn))
    .catch(err => console.error(err))
}

function ensureTableFn(connection) {
  return (name, definition, drop) => (
    drop ?
      connection.run("DROP TABLE IF EXISTS " + name) :
      connection.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?;", name)
  ).then(row => { if (!row) return connection.run(definition) })
}

// also adds a promise-based API
function openConnection(path) {
  const sqlite = require('sqlite3').verbose(),
        db = new sqlite.Database(path)
  db.run("PRAGMA foreign_keys = ON")
  db.get = promisify(db.get)
  db.all = promisify(db.all)
  db.run = promisify(db.run, true)
  return db
}

// backport some of node8s util.promisify... only works with single arg returns, which is fine here
function promisify(orig, resolveWithThis) {

  function fn(...args) {
    return new Promise((resolve, reject) => {
      try {
        orig.call(this, ...args, function(err, ...values) {
          if (err) {
            reject(err);
          } else if (resolveWithThis) {
            resolve(this);
          } else {
            resolve(values[0]);
          }
        });
      } catch (err) {
        reject(err);
      }
    })
  }

  Object.setPrototypeOf(fn, Object.getPrototypeOf(orig));
  return Object.defineProperties(fn, Object.getOwnPropertyDescriptors(orig));
}
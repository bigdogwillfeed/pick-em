// init project
const pkg = require('./package'),
      express = require('express'),
      app = express()

// our SQLite database (app data and sessions)
const db = require('./db')()

// compress our responses (mostly css and js)
app.use(require('compression')())

// serve public folder with a bit of cacheing
app.use(express.static('public', { maxage: process.env.DEBUG ? '1h' : '1d' }))

// nunucks for server-side rendering
require('nunjucks').configure('views', {
  autoescape: true,
  noCache: process.env.DEBUG,
  express: app
})

// hook up reading post bodies (urlencoded for easy cURLing)
const bodyParser = require('body-parser')
app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

// add routes and providers for auth
require('./auth')(db).init(app)

// add our app-specific routes here
require('./routes')(app, db)

// listen for requests :)
app.listen(process.env.PORT, () => console.log(`✨🚀 ${pkg.name} ${pkg.version} running node ${process.version} ✨🚀`))

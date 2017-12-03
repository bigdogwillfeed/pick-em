module.exports = function (db) {
  
  const passport = require('passport'),
        facebook = require('./facebook')(passport, db),
        session = require('./sessions')(passport, db)
  
  return {
    init: function(app) {
      
      // persist sessions in our database
      app.use(session({
        cookie: { secure: true, maxAge: 7 * 24 * 60 * 60 * 1000 }, // 1 week
        proxy: true,
        resave: false,
        saveUninitialized: false,
        secret: process.env.SESSION_SECRET,
        store: db.store(session),
      }));
      
      // Initialize Passport and restore authentication state, if any, from the
      // session.
      app.use(passport.initialize())
      app.use(passport.session())

      app.get('/login',
        function(req, res){
          res.render('login.html', { title: 'Login' })
        })
  
      // setup the routes necessary for each provider
      facebook.routes(app)
      
      app.get('/logout',
        function(req, res){
          req.logout()
          res.redirect('/')
        })

    }
  }
}
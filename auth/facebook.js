module.exports = function(passport, db) {
  
  const Strategy = require('passport-facebook').Strategy,
        path = '/login/facebook',
        returnPath = path + '/return'
  
  // Configure the Facebook strategy for use by Passport.
  //
  // OAuth 2.0-based strategies require a `verify` function which receives the
  // credential (`accessToken`) for accessing the Facebook API on the user's
  // behalf, along with the user's profile.  The function must invoke `cb`
  // with a user object, which will be set at `req.user` in route handlers after
  // authentication.
  passport.use(new Strategy({
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: `https://${process.env.PROJECT_DOMAIN}${process.env.PROJECT_TLD}${returnPath}`,
      profileFields: ['id', 'displayName', 'email'],
    },
    function(accessToken, refreshToken, profile, cb) {
      db.user.findOrCreate(profile, function (err, user) {
        return cb(err, user)
      })
    }))

  
  return {
    routes: function(app) {
      
      app.get(path, passport.authenticate('facebook', { scope: ['public_profile', 'email'] }))
      
      app.get(returnPath, 
        passport.authenticate('facebook', {
          successReturnToOrRedirect: '/',
          failureRedirect: '/login',
        }))
    }
  }
}
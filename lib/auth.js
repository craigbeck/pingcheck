var passport = require("passport");
var Auth0Strategy = require("passport-auth0");

var path = require("path");
var FILE = path.basename(__filename);

var strategy = new Auth0Strategy({
    domain: process.env.AUTH0_DOMAIN,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    callbackURL: process.env.AUTH0_CALLBACK_URL
  }, function(accessToken, refreshToken, profile, done) {
    //Some tracing info
    console.log(FILE, "AUTH OK", accessToken, refreshToken);
    //save the profile
    return done(null, profile);
  });

passport.use(strategy);

passport.serializeUser(function(user, done) {
  console.log(FILE, "passport.serializeUser", user);
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  console.log(FILE, "passport.deserializeUser", user);
  done(null, user);
});

module.exports = strategy;
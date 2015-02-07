var Auth0Widget;

try {
  Auth0Widget = require("Auth0Widget");
} catch (e) {
  Auth0Widget = function () {};
}

var widget = new Auth0Widget({
  domain:         "app33164094.auth0.com",
  clientID:       "rakzQVY18vG1GOEIhIhWMKIt6Gq2PeVz",
  callbackURL:    "http://localhost:5000/callback"
});

module.exports = widget;

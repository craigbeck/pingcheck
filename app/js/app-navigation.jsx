var React = require("react");
var auth0 = require("./auth-widget");

console.log("auth0-widget", auth0);

var AppNavigation = React.createClass({
  signin: function () {
    auth0.signin();
  },
  render: function () {
    return (
      <nav className="navbar navbar-default navbar-static-top">
        <div className="container-fluid">
          <div className="navbar-header">
            <a className="navbar-brand" href="/">pingcheck</a>
          </div>
          <div className="collapse navbar-collapse">
            <button type="button"
                    className="btn btn-default navbar-btn navbar-right"
                    onClick={this.signin}>Sign in</button>
          </div>
        </div>
      </nav>
    );
  }
});

module.exports = AppNavigation;

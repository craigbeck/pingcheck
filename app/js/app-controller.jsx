var React = require("react");
var AppNavigation  = require("./app-navigation.jsx");

var JumboTron = React.createClass({
  render: function () {
    return (
      <div className="jumbotron">
        <h1>{this.props.title}</h1>
        <p>{this.props.description}</p>
      </div>
    );
  }
});

var AppController = React.createClass({
  render: function () {
    return (
      <div>
        <AppNavigation/>
        <div className="container">
          <JumboTron title="PingCheck!" description="making endless fucking web requests"/>
        </div>
      </div>
    );
  }
});

module.exports = AppController;

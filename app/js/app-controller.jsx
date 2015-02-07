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

var Container = React.createClass({
  render: function () {
    return (
      <div className="container">
        {this.props.children}
      </div>
    );
  }
});

var Row = React.createClass({
  render: function () {
    return (
      <div className="row">
        {this.props.children}
      </div>
    );
  }
});

var AppController = React.createClass({
  render: function () {
    return (
      <div>
        <AppNavigation/>
        <Container>
          <Row>
            <div className="col-md-8 col-md-offset-2">
              <JumboTron title="PingCheck!" description="making endless web requests"/>
            </div>
          </Row>
        </Container>
      </div>
    );
  }
});

module.exports = AppController;

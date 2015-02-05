var window = require("window");
var document = require("document");
var React = require("react");
var io = require("./io-events");
var AppController = require("./app-controller.jsx");

window.io = io;

var app = React.createElement(AppController);
React.render(app, document.body);

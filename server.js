var express = require("express.io");
var Boom = require("Boom");
var bodyParser = require("body-parser");

var pkg = require("./package.json");

var app = express();


app.get("/", function (req, res) {
  res.send({
    name: pkg.name,
    version: pkg.version,
    uptime: process.uptime() + "s",
    ts: new Date()
  });
});


var server = app.listen(process.env.PORT || 3003, function () {
  var addr = process.env.HEROKU_URL
             ? process.env.HEROKU_URL
             : server.address().address +":"+ server.address().port;
  console.log("server listening on %s", addr);
});
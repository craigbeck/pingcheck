var express = require("express.io");
var crypto = require('crypto');
var BodyParser = require("body-parser");
var Rollbar = require("rollbar");
var onFinished = require("on-finished");
var _ = require("lodash");
var pkg = require("./package.json");

var app = express();

var nextReqId = (function () {
  var id = 0;
  return function () {
    id++;
    return id;
  };
})();

app.use(BodyParser.json());

if (process.env.ROLLBAR_ACCESS_TOKEN) {
  app.use(rollbar.errorHandler(process.env.ROLLBAR_ACCESS_TOKEN));
}

app.use(function (req, res, next) {
  req._startAt = process.hrtime();
  req._startTime = new Date();
  onFinished(res, function () {
    var diff = process.hrtime(req._startAt);
    var ms = diff[0] * 1e3 + diff[1] * 1e-6;
    var elapsed = ms.toFixed(3);
    console.log("%s [%s] - %s %s %s (%sms)",
                req._startTime.valueOf(),
                req._requestId,
                req.method,
                req.path,
                res.statusCode,
                elapsed);
  });
  next();
});

app.use(function (req, res, next) {
  req._requestId = nextReqId();
  res.setHeader("X-RequestId", req._requestId);
  next();
});

app.get("/", function (req, res) {
  res.send({
    name: pkg.name,
    version: pkg.version,
    uptime: process.uptime() + "s",
    ts: new Date()
  });
});

var urls = {};

app.get("/urls", function (req, res) {
  res.send({ ok: true, urls: _.toArray(urls) });
});

app.post("/urls", function (req, res) {
  var url = req.body.url;
  if (!url) {
    return req.status(400).send({ ok: false, error: "Bad Request" });
  }
  var shasum = crypto.createHash('sha1');
  shasum.update(url);
  var hash = shasum.digest("hex");
  var urlObj = {
    id: hash,
    url: url,
    added: new Date(),
    checks: 0
  };
  urls[hash] = urlObj;
  res.send({ ok: true, data: urlObj });
});

app.get("/urls/:hash", function (req, res) {
  var url = urls[req.params.hash];
  if (!url) {
    return req.status(404).send({ ok: false, error: "Not Found" });
  }
  res.send({ ok: true, url: url });
});

var notFound = function (req, res) {
  res.status(404)
    .send({
      ok: false,
      statusCode: 404,
      error: "Not Found",
      path: req.path
    });
};

app.get("/*", notFound);
app.post("/*", notFound);

var server = app.listen(process.env.PORT || 3003, function () {
  var addr = process.env.HEROKU_URL
             ? process.env.HEROKU_URL
             : server.address().address +":"+ server.address().port;
  console.log("server listening on %s", addr);
});



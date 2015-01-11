var express = require("express.io");
var crypto = require('crypto');
var BodyParser = require("body-parser");
var Rollbar = require("rollbar");
var onFinished = require("on-finished");
var _ = require("lodash");
var pkg = require("./package.json");
var Url = require("./lib/url");

var app = express();

var nextReqId = (function () {
  var id = 0;
  return function () {
    id++;
    return id;
  };
})();

app.use(BodyParser.json());

var notify = function (message) {
  console.log("%s - NOTIFY %s", new Date().valueOf, message);
};

if (process.env.ROLLBAR_ACCESS_TOKEN) {
  rollbar.init(process.env.ROLLBAR_ACCESS_TOKEN);
  app.use(rollbar.errorHandler(process.env.ROLLBAR_ACCESS_TOKEN));

  notify = function (message) {
    rollbar.reportMessage(message);
  };
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
  res.send({ ok: true, urls: _.map(_.toArray(urls), toJson) });
});

app.post("/urls", function (req, res) {
  var url = req.body.url;
  if (!url) {
    return req.status(400).send({ ok: false, error: "Bad Request" });
  }
  var urlObj = new Url(url);
  urls[urlObj.id] = urlObj;
  urlObj.on("data", function (data) {
    console.log("%s - PING %s %s %s (%sms)",
                new Date().valueOf(),
                data.obj.id, data.obj.href, data.status, data.msec)
  });
  urlObj.on("error", function () {
    urlObj.stop();
    console.log("%s - PING %s %s %s (%sms)",
                new Date().valueOf(),
                data.obj.id, data.obj.href, err, data.msec);
  })
  urlObj.start();
  res.send({ ok: true, data: toJson(urlObj) });
});

app.get("/urls/:hash", function (req, res) {
  var url = urls[req.params.hash];
  if (!url) {
    return req.status(404).send({ ok: false, error: "Not Found" });
  }
  res.send({ ok: true, url: toJson(url) });
});

var toJson = function (obj) {
  var attrs = _.pick(obj, "id href interval".split(" "));
  var meta = {
    _links: {
      self: (process.env.HEROU_URL || "/") + "url/" + obj.id
    }
  };
  return _.extend(meta, attrs);
}

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


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
  Rollbar.init(process.env.ROLLBAR_ACCESS_TOKEN);
  app.use(Rollbar.errorHandler(process.env.ROLLBAR_ACCESS_TOKEN));

  notify = function (message) {
    Rollbar.reportMessage(message);
  };
}

if(process.env.NODETIME_ACCOUNT_KEY) {
  require("nodetime").profile({
    accountKey: process.env.NODETIME_ACCOUNT_KEY,
    appName: "pingcheck"
  });
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
  var interval = parseInt(req.body.interval || 60, 10);
  if (!url) {
    return res.status(400).send({ ok: false, error: "Bad Request" });
  }
  var urlObj = new Url(url, { interval: interval });
  if (urls[urlObj.id]) {
    return res.status(200).send({ ok: true, data: toJson(urls[urlObj.id]) });
  }
  urls[urlObj.id] = urlObj;
  urlObj.on("started", function (obj) {
    console.log("%s - STARTED %s %s",
                new Date().valueOf(),
                obj.id, obj.href);
  });
  urlObj.on("stopped", function (obj) {
    console.log("%s - STOPPED %s %s",
                new Date().valueOf(),
                obj.id, obj.href);
  });
  urlObj.on("data", function (data) {
    console.log("%s - PING %s %s %s (%sms)",
                new Date().valueOf(),
                data.obj.id, data.obj.href, data.status, data.msec)
  });
  urlObj.on("error", function (data) {
    console.log("%s - PING %s %s %s (%sms)",
                new Date().valueOf(),
                data.obj.id, data.obj.href, data.error, data.msec);
    urlObj.stop();
  })
  urlObj.start();
  res.status(201).send({ ok: true, data: toJson(urlObj) });
});

app.get("/urls/:hash", function (req, res) {
  var url = urls[req.params.hash];
  if (!url) {
    return req.status(404).send({ ok: false, error: "Not Found" });
  }
  res.send({ ok: true, url: toJson(url) });
});

app.delete("/urls/:hash", function (req, res) {
  var urlCheck = urls[req.params.hash];
  if (urlCheck) {
    urlCheck.stop();
    delete urls[req.params.hash];
  }
  res.send({ ok: true });
});

var toJson = function (obj) {
  var attrs = _.pick(obj, "id href interval history state".split(" "));
  var responseTimes = _.pluck(obj.history, "msec");
  var stats = {
    totalChecks: obj.totalChecks,
    maxResponse: _.max(responseTimes) || 0,
    minResponse: _.min(responseTimes) || 0,
    avgResponse: _.reduce(responseTimes, function (sum, obj) {
      return sum + obj.msec;
    }) / (responseTimes.length || 1) * 1.0
  };
  var meta = {
    _links: {
      self: (process.env.HEROKU_URL || "/") + "urls/" + obj.id
    }
  };
  return _.extend(meta, { stats: stats }, attrs);
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



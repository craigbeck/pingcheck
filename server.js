var _ = require("lodash");
var BodyParser = require("body-parser");
var crypto = require("crypto");
var express = require("express.io");
var fs = require("fs");
var keenIO = require("keen.io");
var onFinished = require("on-finished");
var passport = require("passport");
var postal = require("postal");
var Rollbar = require("rollbar");
var url = require("url");

var Agent = require("./lib/agent");
var pkg = require("./package.json");
var Stats = require("./lib/stats");
var strategy = require("./lib/auth");


var app = express().http().io();
var connections = {};

app.configure(function () {
  this.use(BodyParser.json());
  this.use(express.cookieParser());
  this.use(express.session({secret: "h0lyS3kretHand5h@k3Ba7m4n!"}));
  this.use(passport.initialize());
  this.use(passport.session());

  this.use(app.router);

  if (process.env.ROLLBAR_ACCESS_TOKEN) {
    Rollbar.init(process.env.ROLLBAR_ACCESS_TOKEN);
    app.use(Rollbar.errorHandler(process.env.ROLLBAR_ACCESS_TOKEN));
  }
});

app.io.on("connection", function (socket) {
  var pingClients, tid;
  console.log("NEW client connection", socket.id);
  connections[socket.id] = socket;
  socket.on("disconnect", function () {
    console.log("CLIENT disconnect!", socket.id);
    delete connections[socket.id];
    if (!connections.length) {
      clearTimeout(tid);
    }
  });
  socket.emit("version", {
    name: pkg.name,
    version: pkg.version
  });
  console.log("socket rooms:", socket.rooms);
  pingClients = function () {
    app.io.broadcast("ping", new Date());
    console.log("SENT ping");
    tid = setTimeout(pingClients, 30 * 1000);
  };
  if (!tid) {
    tid = setTimeout(pingClients, 10 * 1000);
  }
});

app.io.on("error", function (err) {
  console.log("IO ERR", err);
});


app.io.route("ping", function (req) {
  console.log("socket ping RECV");
  setTimeout(function () {
    req.io.emit("pong");
  }, 500);
});

var nextReqId = (function () {
  var id = 0;
  return function () {
    id++;
    return id;
  };
})();

if(process.env.NODETIME_ACCOUNT_KEY) {
  require("nodetime").profile({
    accountKey: process.env.NODETIME_ACCOUNT_KEY,
    appName: "pingcheck"
  });
}

var evtChannel = postal.channel("events");

if (process.env.KEEN_WRITE_KEY && process.env.KEEN_PROJECT_ID) {
  // Configure instance. Only projectId and writeKey are required to send data.
  var keen = keenIO.configure({
      projectId: process.env['KEEN_PROJECT_ID'],
      writeKey: process.env['KEEN_WRITE_KEY']
  });

  var agentStats = {
    runningAgents: 0,
    totalAgents: 0,
    checkCount: 0
  }

  evtChannel.subscribe("url.checked", function (data) {
    keen.addEvent("url.checked", data);
    agentStats.checkCount++;
    app.io.emit("check:completed", { count: agentStats.checkCount });
  });

  evtChannel.subscribe("url.added", function (data) {
    keen.addEvent("url.added", data);
    agentStats.totalAgents++;
  });

  evtChannel.subscribe("agent.started", function (data) {
    agentStats.runningAgents++;
    app.io.broadcast("agent:started", { count: agentStats.runningAgents });
  });

  evtChannel.subscribe("agent.stopped", function (data) {
    agentStats.runningAgents--;
    app.io.broadcast("agent:stopped", { count: agentStats.runningAgents });
  });

  var pulse = function () {
    keen.addEvent("agent.stats", agentStats);
    setTimeout(pulse, 60 * 1000);
  }
  process.nextTick(pulse);
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

var requestId = function (req, res, next) {
  req._requestId = nextReqId();
  res.setHeader("X-RequestId", req._requestId);
  next();
};

app.use(requestId);

app.get("/", function (req, res) {
  if (req.accepts("html")) {
    fs.readFile("./app/index.html", function (err, data) {
      if (err) {
        throw err;
      }
      res.send(data.toString());
    });
    return;
  }

  res.send({
    name: pkg.name,
    version: pkg.version,
    uptime: process.uptime() + "s",
    ts: new Date()
  });
});

var agents = {};

app.get("/agents", function (req, res) {
  res.send({ ok: true, agents: _.map(_.toArray(agents), toJson) });
});

var isValidUri = function (str) {
  // minimal host validation for "<host>.<tld>"
  // where host is 2+ alphanumeric characters
  // and tld is 2+ alpha characters
  var hostRegex = /\w{2,}\.[a-z]{2,}/;
  try {
    return url.parse(str).host.match(hostRegex);
  } catch (e) {
    return false;
  }
}

app.post("/agents", function (req, res) {
  var uri = req.body.url;
  try {
    url.parse(uri);
  } catch (e) {
    return res.status(400).send({
      ok: false,
      error: "Bad Request",
      message: "Invalid URL",
      url: uri
    });
  }
  var interval = parseInt(req.body.interval || 60, 10);
  if (!uri) {
    return res.status(400).send({ ok: false, error: "Bad Request" });
  }
  var agent = new Agent(uri, { interval: interval });
  if (agents[agent.id]) {
    return res.status(200).send({ ok: true, data: toJson(agents[agent.id]) });
  }

  agents[agent.id] = agent;
  evtChannel.publish("url.added", { id: agent.id, href: agent.href });

  agent.on("started", function (obj) {
    console.log("%s - STARTED %s %s",
                new Date().valueOf(),
                obj.id, obj.href);
  });

  agent.on("stopped", function (obj) {
    console.log("%s - STOPPED %s %s",
                new Date().valueOf(),
                obj.id, obj.href);
  });

  agent.on("data", function (data) {
    console.log("%s - PING %s %s %s (%sms)",
                new Date().valueOf(),
                data.obj.id, data.obj.href, data.status, data.msec);
    evtChannel.publish("url.checked", {
      id: agent.id,
      href: agent.href,
      statusCode: data.status,
      success: (data.status < 400),
      timestamp: data.startTime,
      responseTime: data.msec
    });
  });

  agent.on("error", function (data) {
    console.log("%s - PING %s %s %s (%sms)",
                new Date().valueOf(),
                data.obj.id, data.obj.href, data.error, data.msec);
    evtChannel.publish("url.added", { id: agent.id, href: agent.href });
    agent.stop();
  });

  agent.start();
  res.status(201).send({ ok: true, data: toJson(agent) });
});

app.get("/agents/:hash", function (req, res) {
  var url = agents[req.params.hash];
  if (!url) {
    return req.status(404).send({ ok: false, error: "Not Found" });
  }
  res.send({ ok: true, url: toJson(url) });
});

app.delete("/agents/:hash", function (req, res) {
  var urlCheck = agents[req.params.hash];
  if (urlCheck) {
    urlCheck.stop();
    delete agents[req.params.hash];
  }
  res.send({ ok: true });
});

// Auth0 callback handler
app.get('/callback', passport.authenticate('auth0'), function(req, res) {
    res.redirect("/");
});

var toJson = function (obj) {
  var attrs = _.pick(obj, "id href interval history state".split(" "));
  attrs.history = _.last(attrs.history, 10);
  var responseTimes = _.pluck(obj.history, "msec");
  var stats = {
    totalChecks: obj.totalChecks,
    maxResponse: _.max(responseTimes) || 0,
    minResponse: _.min(responseTimes) || 0,
    avgResponse: Stats.avg(responseTimes),
    percentiles: {
      "90th": Stats.pct(responseTimes, 0.90),
      "80th": Stats.pct(responseTimes, 0.80)
    }
  };
  var meta = {
    _links: {
      self: (process.env.HEROKU_URL || "/") + "agents/" + obj.id
    }
  };
  return _.extend(meta, { stats: stats }, attrs);
}

var notFound = function (req, res) {
  res.redirect("/");
};

app.get("/*", notFound);
app.post("/*", notFound);

app.listen(process.env.PORT || 5000);



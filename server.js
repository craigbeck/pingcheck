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
var mongo = require("promised-mongo");

var Agent = require("./lib/agent");
var pkg = require("./package.json");
var Stats = require("./lib/stats");
var strategy = require("./lib/auth");

// setup server to handle compiling of jsx files
require("node-jsx").install({ extension: ".jsx" });

var app = express().http().io();
var connections = {};

var requestLogger = function (req, res, next) {
  req._startAt = process.hrtime();
  req._startTime = new Date();

  req.log = function () {
    var args = Array.prototype.slice.call(arguments, 0);
    var arglist = [
      "%s [%s] -",
      req._startTime.valueOf(),
      req._requestId
    ].concat(args);
    console.log.apply(console, arglist);
  };

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
};

var nextReqId = (function () {
  var id = 0;
  return function () {
    id++;
    return id;
  };
})();

var requestId = function (req, res, next) {
  req._requestId = nextReqId();
  res.setHeader("X-RequestId", req._requestId);
  next();
};

app.log = function (message) {
  console.log("%s [app] -",
              new Date().valueOf(),
              message);
};

app.log("starting....");

app.use(requestId);
app.use(requestLogger);
app.use(BodyParser.json());
app.use(express.cookieParser());
app.use(express.session({secret: "h0lyS3kretHand5h@k3Ba7m4n!"}));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(express.static("./app"));


if (process.env.ROLLBAR_ACCESS_TOKEN) {
  Rollbar.init(process.env.ROLLBAR_ACCESS_TOKEN);
  app.use(Rollbar.errorHandler(process.env.ROLLBAR_ACCESS_TOKEN));
  app.log("using Rollbar");
}

app.io.on("connection", function (socket) {
  var pingClients, tid;
  app.log("NEW client connection", socket.id);
  connections[socket.id] = socket;
  socket.on("disconnect", function () {
    app.log("CLIENT disconnect!", socket.id);
    delete connections[socket.id];
    if (!connections.length) {
      clearTimeout(tid);
    }
  });
  socket.emit("version", {
    name: pkg.name,
    version: pkg.version
  });
  app.log("socket rooms:", socket.rooms);
  pingClients = function () {
    app.io.broadcast("ping", new Date());
    app.log("SENT ping");
    tid = setTimeout(pingClients, 45 * 1000);
  };
  if (!tid) {
    tid = setTimeout(pingClients, 10 * 1000);
  }
});

app.io.on("error", function (err) {
  app.log("IO ERR", err);
});


app.io.route("ping", function (req) {
  app.log("RECV ping");
  setTimeout(function () {
    req.io.emit("pong");
  }, 500);
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
      self: (process.env.HEROKU_URL || "/") + "agents/" + obj.hash
    }
  };
  return _.extend(meta, { stats: stats }, attrs);
};

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
      projectId: process.env.KEEN_PROJECT_ID,
      writeKey: process.env.KEEN_WRITE_KEY
  });

  var agentStats = {
    runningAgents: 0,
    totalAgents: 0,
    checkCount: 0
  };

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
  };

  process.nextTick(pulse);
}

var hbs = require("express-hbs");
// Use `.hbs` for extensions and find partials in `views/partials`.
app.engine("html", hbs.express3({
  partialsDir: __dirname + "/views/partials"
}));
app.set("view engine", "html");

var React = require("react");
var AppController = require("./app/js/app-controller.jsx");

app.get("/", function (req, res) {
  if (req.accepts("html")) {
    // fs.readFile("./app/index.html", function (err, data) {
    //   if (err) {
    //     throw err;
    //   }
    //   res.send(data.toString());
    // });
    var app = React.renderToString(AppController);
    return res.render("./app/index.html");
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
  db.agents.find().toArray().then(function (agents) {
    res.send({ ok: true, agents: _.map(_.toArray(agents), toJson) });
  });
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
};

var db = mongo(process.env.MONGOLAB_URI, ["agents", "activity"]);
db.activity.ensureIndex("agentId");

var initializeAgent = function (agent) {
  agent.on("started", function (obj) {
    console.log("%s - STARTED %s %s",
                new Date().valueOf(),
                obj.hash, obj.href);
  });

  agent.on("stopped", function (obj) {
    console.log("%s - STOPPED %s %s",
                new Date().valueOf(),
                obj.hash, obj.href);
  });

  agent.on("state:changed", function (data) {
    process.nextTick(function () {
      db.agents.update(
        { _id: data.hash },
        { $set: { state: data.state, updated: new Date() } }
      ).then(function () {
        console.log("update", data.hash, "OK");
      }, function (err) {
        console.error("update", data.hash, err);
      });
    });
  });

  agent.on("data", function (data) {
    console.log("%s - PING %s %s %s (%sms)",
                new Date().valueOf(),
                data.obj.hash, data.obj.href, data.status, data.msec);
    evtChannel.publish("url.checked", {
      id: agent.id,
      href: agent.href,
      statusCode: data.status,
      success: (data.status < 400),
      timestamp: data.startTime,
      responseTime: data.msec
    });

    var doc = {
      agentId: agent.hash,
      timestamp: data.startTime,
      statusCode: data.status,
      msec: data.msec
    };

    db.activity.insert(doc).then(null, function (err) {
      console.error("%s - ERR failed to save activity",
                    new Date().valueOf(),
                    data.obj.hash, data.obj.href, data.status, data.msec);
    });
  });

  agent.on("error", function (data) {
    console.log("%s - PING %s %s %s (%sms)",
                new Date().valueOf(),
                data.obj.hash, data.obj.href, data.error, data.msec);
    agent.stop();
  });

  agent.start();
};

db.agents.find()
  .toArray()
  .then(function (docs) {
    if (!docs.length) {
      console.log("no agents to initialize");
    }
    docs.forEach(function (doc) {
      var agent = new Agent(doc.href, { interval: doc.interval });
      initializeAgent(agent);
      console.log("init", agent.hash, agent.href);
      agents.push(agent);
    });
  });

app.post("/agents", function (req, res) {
  var uri;
  try {
    uri = url.parse(req.body.url);
  } catch (e) {
    return res.status(400).send({
      ok: false,
      error: "Bad Request",
      message: "Invalid URL",
      url: req.body.url
    });
  }
  var hash = Agent.idHash(url.format(uri));
  db.agents.findOne({ _id: hash })
    .then(function (doc) {
      if (doc) {
        // found it!
        console.log("found doc");
        return res.status(400).send({ ok: false, error: "already exists" });
      }

      var interval = parseInt(req.body.interval || 60, 10);
      if (!uri) {
        return res.status(400).send({ ok: false, error: "Bad Request" });
      }
      var agent = new Agent(url.format(uri), { interval: interval });
      if (agents[agent.id]) {
        return res.status(200).send({ ok: true, data: toJson(agents[agent.id]) });
      }

      var newAgent = {
        _id: agent.hash,
        interval: agent.interval,
        hash: agent.hash,
        href: url.format(uri),
        url: uri,
        state: agent.state
      };

      db.agents.insert(newAgent).then(function (doc) {
        agents[agent.id] = agent;
        evtChannel.publish("url.added", { id: agent.id, href: agent.href });

        initializeAgent(agent);

        res.status(201).send({ ok: true, data: doc });
      }, function (err) {
        console.error(err);
        res.status(500).send({ ok: false, error: err });
      });
    });
});

app.get("/agents/:hash", function (req, res) {
  db.agents.findOne({ _id: req.params.hash }).then(function (doc) {
    if (!doc) {
      return res.status(404).send({ ok: false, error: "Not Found" });
    }
    var agent = doc;
    db.activity
      .find({ agentId: req.params.hash })
      .toArray()
      .then(function (docs) {
        var activity = docs;
        var obj = _.extend({ }, agent, { history: activity } );
        res.send({ ok: true, agent: toJson(obj) });
      }, function (err) {
        return res.status(500).send({ ok: false, error: err });
      });

  }, function (err) {
    return res.status(500).send({ ok: false, error: err });
  });
});

app.put("/agents/:hash", function (req, res) {
  var agent = agents[req.params.hash];
  if (!agent) {
    return res.status(404).send({ ok: false, error: "Not Found" });
  }
  var state = req.body.state;
  if (state != "ready") {
    return res.status(400).send({ ok: false, error: "Missing State" });
  }
  agent.reset();
  process.nextTick(function () {
    agent.start();
  });
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
app.get("/callback", passport.authenticate("auth0"), function(req, res) {
    res.redirect("/");
});

var notFound = function (req, res) {
  res.status(404).send({ ok: false, error: "Not Found", path: req.path });
};

app.get("/*", notFound);
app.post("/*", notFound);

app.listen(process.env.PORT || 5000);

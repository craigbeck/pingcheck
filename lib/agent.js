var crypto = require("crypto");
var request = require("request");
var url = require("url");
var util = require("util");
var _ = require("lodash");
var EventEmitter = require("events").EventEmitter;
var Hoek = require("hoek");

var MAX_HISTORY = 180;

var isValidUrl = function (str) {
  try {
    var parsed = url.parse(str);
    return parsed.protocol.match(/^https?/) && parsed.hostname;
  } catch (e) {
    return false;
  }
};

var Agent = function (href, options) {
  Hoek.assert(href, "URL required");
  Hoek.assert(isValidUrl(href), "Invalid URL");

  EventEmitter.call(this);

  options = _.extend({}, options);

  var shasum = crypto.createHash("sha1");
  shasum.update(href);
  var hash = shasum.digest("hex");

  this.id = hash;
  this.href = href;
  this.interval = options.interval || 60; // interval in seconds
  this.history = [];
  this.totalChecks = 0;
  this.state = "ready";
};

util.inherits(Agent, EventEmitter);

Agent.prototype.check = function (callback) {
  var start = process.hrtime();
  var startTime = new Date();
  request(this.href, { timeout: 10 * 1000 }, function (err, res, body) {
    var diff = process.hrtime(start);
    var ms = diff[0] * 1e3 + diff[1] * 1e-6;
    var elapsed = parseFloat(ms.toFixed(3), 10);
    this.totalChecks++;
    var data;
    if (err) {
      data = {
        error: err,
        ts: startTime,
        msec: elapsed
      };
      this.emit("error", _.extend({ obj: this }, data));
    } else {
      var length = parseInt(res.headers["content-length"], 10);
      data = {
        status: res.statusCode,
        ts: startTime,
        msec: elapsed,
        bytes: length
      };
      this.emit("data", _.extend({ obj: this }, data));
    }
    this.history.push(data);
    while (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
    if (typeof callback === "function") {
      callback(err, data);
    }
  }.bind(this));
};

Agent.prototype.start = function () {
  if (this.state !== "ready" && this.state !== "stopped") {
    return;
  }
  var self = this;
  var check = function () {
    self.check(function () {
      if (self.state !== "started") {
        return;
      }
      self._timer = setTimeout(check, self.interval * 1000);
    });
  }.bind(this);
  this.state = "started";
  this.emit("started", this);
  process.nextTick(check);
};

Agent.prototype.stop = function () {
  if (this.state !== "started") {
    return;
  }
  this.state = "stopped";
  if (this._timer) {
    clearTimeout(this._timer);
    this._timer = null;
  }
  this.emit("stopped", this);
};

module.exports = Agent;

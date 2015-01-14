var crypto = require("crypto");
var request = require("request");
var util = require("util");
var _ = require("lodash");
var EventEmitter = require("events").EventEmitter;

var Agent = function (href, options) {
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
    var elapsed = ms.toFixed(3);
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
        msec: parseFloat(elapsed, 10),
        bytes: length
      };
      this.emit("data", _.extend({ obj: this }, data));
    }
    this.history.push(data);
    while (this.history.length > 10) {
      this.history.shift();
    }
    if (typeof callback === "function") {
      callback(err, data);
    }
  }.bind(this));
};

Agent.prototype.start = function () {
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
  this.state = "stopped";
  if (this._timer) {
    clearTimeout(this._timer);
  }
  this.emit("stopped", this);
};

module.exports = Agent;

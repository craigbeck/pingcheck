var crypto = require("crypto");
var request = require("request");
var util = require("util");
var _ = require("lodash");
var EventEmitter = require('events').EventEmitter;

var Url = function (href, options) {
  EventEmitter.call(this);

  var options = _.extend({}, options);

  var shasum = crypto.createHash("sha1");
  shasum.update(href);
  var hash = shasum.digest("hex");

  this.id = hash;
  this.href = href;
  this.interval = options.interval || 60; // interval in seconds
  this.history = [];
  this.totalChecks = 0;
};

util.inherits(Url, EventEmitter);

Url.prototype.check = function (callback) {
  var start = process.hrtime();
  var startTime = new Date();
  request(this.href, function (err, res, body) {
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
    while (this.history.length > 100) {
      this.history.shift();
    }
    if (typeof callback === "function") {
      callback(err, data);
    }
  }.bind(this));
};

Url.prototype.start = function () {
  this.emit("started");
  var self = this;
  var check = function () {
    self.check(function () {
      self._timer = setTimeout(check, self.interval * 1000);
    });
  }.bind(this);
  check();
}

Url.prototype.stop = function () {
  if (this._timer) {
    clearTimeout(this._timer);
  }
  this.emit("stopped");
};

module.exports = Url;

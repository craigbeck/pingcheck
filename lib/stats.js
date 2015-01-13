var _ = require("lodash");

var Stats = {};

Stats.sum = function (arr) {
  return _.reduce(arr, function (sum, val) {
    return sum + val;
  });
};

Stats.avg = function (arr) {
  return (Stats.sum(arr) * 1.0) / arr.length;
};

Stats.pct = function (arr, p) {
  var ordered = _(arr).clone().sort();
  var idx = Math.ceil(arr.length * p) - 1;
  console.log("idx", idx, arr.length);
  return ordered[idx];
};

module.exports = Stats;

var expect = require("chai").expect;
var Stats = require("../lib/stats");

describe("Stats module", function () {

  describe("avg", function () {
    it("should calculate averages", function () {
      expect(Stats.avg([1,2])).to.equal(1.5);
    });

    it("should return NaN for empty array", function () {
      expect(isNaN(Stats.avg([]))).to.be.true;
    });
  });

  describe("pct", function () {
    it("should calculate percentiles", function () {
      var data = [3, 5, 7, 9];
      expect(Stats.pct(data, 0.00)).to.equal(3);
      expect(Stats.pct(data, 0.25)).to.equal(5);
      expect(Stats.pct(data, 0.50)).to.equal(7);
      expect(Stats.pct(data, 0.75)).to.equal(9);
    });

    it("should return undefined for invalid percentiles", function () {
      var data = [3, 4];
      // cant be in 75% percentile with population of 2
      expect(Stats.pct(data, 0.75)).to.equal(undefined);
      expect(Stats.pct(data, 0.50)).to.equal(4);
    });
  });
});

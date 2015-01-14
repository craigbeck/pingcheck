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
});

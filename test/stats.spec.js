var Stats = require("../lib/stats");

describe("Stats module", function () {

  describe("avg", function () {
    it("should calculate averages", function () {
      expect(Stats.avg([1,2])).to.equal(1.5);
    });
  });
});

var expect = require("chai").expect;
var sinon = require("sinon");

var Agent = require("../lib/agent");

describe("Agent", function () {

  it("should only accept valid URL", function () {
    expect(new Agent("http://localhost")).to.be.instanceof(Agent);

    [undefined, null, "", "foobar"].forEach(function (val) {
      expect(function () { return new Agent(val); }, val)
        .throws(Error, /URL/);
    });
  });

  it("should have initial state of 'ready'", function () {
    var actual = new Agent("http://localhost");
    expect(actual).to.have.property("state", "ready");
  });

  describe("when ready", function () {
    var actual, sandbox;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      actual = new Agent("http://localhost");
      actual.check = sandbox.spy();
    });

    afterEach(function () {
      sandbox.reset();
    });

    it("should be able to be started", function () {
      actual.start();
      expect(actual).to.have.property("state", "started");
      expect(actual.check).to.have.been.called;
    });

    it("should not be able to be stopped", function () {
      actual.stop();
      expect(actual).to.have.property("state", "ready");
    });
  });

  describe("when started", function () {
    var actual, sandbox;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      actual = new Agent("http://localhost");
      actual.check = sandbox.spy();
      actual.start();
    });

    it("should be able to be stopped", function () {
      actual.stop();
      expect(actual).to.have.property("state", "stopped");
    });

    it("should ignore start", function (done) {
      actual.on("started", function () {
        throw "Should not start again";
      });
      actual.start();
      expect(actual).to.have.property("state", "started");
      process.nextTick(done);
    });
  });
});


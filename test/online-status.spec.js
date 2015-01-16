var expect = require("chai").expect;

var OnlineStatus = require("../lib/online-status");

describe("OnlineStatus",function () {
  describe("inital state", function () {
    var state;

    beforeEach(function () {
      state = OnlineStatus;
    });

    it("should start \"offline\"", function () {
      expect(state).to.have.property("state", "offline");
    });
  });

  describe("when online", function () {
    var state;

    beforeEach(function () {
      state = OnlineStatus;
      state.handle("socket.connected");
    });

    it("should transition to \"offline\" on \"socket.disconnected\"", function () {
      state.handle("socket.disconnected");
      expect(state).to.have.property("state", "offline");
    });

    it("should ignore \"socket.connected\" event", function () {
      state.handle("socket.connected");
      expect(state).to.have.property("state", "online");
    });

    it("isOnline() should be true", function () {
      expect(state.isOnline()).to.be.true;
    });

    it("isOffline() should be false", function () {
      expect(state.isOffline()).to.be.false;
    });
  });

  describe("when offline", function () {
    var state;

    beforeEach(function () {
      state = OnlineStatus;
      state.handle("socket.disconnected");
    });

    it("should transition to \"online\" on \"socket.connected\" event", function () {
      state.handle("socket.connected");
      expect(state).to.have.property("state", "online");
    });

    it("should ignore \"socket.disconnected\" event", function () {
      state.handle("socket.disconnected");
      expect(state).to.have.property("state", "offline");
    });

    it("isOnline() should be false", function () {
      expect(state.isOnline()).to.be.false;
    });

    it("isOffline() should be true", function () {
      expect(state.isOffline()).to.be.true;
    });
  });
});

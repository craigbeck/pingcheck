var machina = require("machina");

var OnlineStatus = new machina.Fsm({

  initialState: "offline",

  isOnline: function () {
    return this.state === "online";
  },

  isOffline: function () {
    return !this.isOnline();
  },

  states: {
    "offline": {
      _onEnter: function () {
        // no op
      },

      "socket.connected": function () {
        this.transition("online");
      }
    },
    "online": {
      _onEnter: function () {
        // no op
      },
      "socket.disconnected": function () {
        this.transition("offline");
      }
    }
  }
});

module.exports = OnlineStatus;

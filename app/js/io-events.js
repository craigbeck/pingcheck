var io = require("io");
var appInfo = require("./app-info");

var io = io.connect();

io.on("connect", function () {
  console.log("IO online");
});

io.on("reconnect", function () {
  console.log("IO reconnect");
});

io.on("disconnect", function () {
  console.log("IO offline");
});

io.on("pong", function () {
  console.log("RECV pong");
});

io.on("ping", function () {
  console.log("RECV ping", arguments);
});

io.on("check:completed", function (msg) {
  console.log("RECV check:completed", msg.count);
});

io.on("version", function (version) {
  if (appInfo) {
    if (appInfo.version !== version.version) {
      alert("New app version!");
    }
  };
  appInfo = version;
});

module.exports = io;

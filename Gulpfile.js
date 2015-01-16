var gulp = require("gulp");
var mocha = require("gulp-mocha");
var jshint = require("gulp-jshint");
var stylish = require("jshint-stylish");
var runSequence = require("run-sequence");
var fs = require("fs");
var chai = require("chai");
var _jsonCfg = function (name) {
  var raw = fs.readFileSync(name).toString();
  return JSON.parse(raw.replace(/\/\/.*\n/g, ""));
};

gulp.task("mocha", function () {
  // Include setup.
  // require("./test/setup");
  global.expect = chai.expect;
  return gulp
    .src(["test/**/*.spec.js"])
    .pipe(mocha({
      ui: "bdd",
      reporter: "spec"
    }))
    .on("error", function (err) {
      throw err;
    });
});

gulp.task("test", ["mocha"]);

gulp.task("jshint", function (){
  return gulp.src(["Gulpfile.js", "server.js", "lib/*.js", "test/*.js"])
    .pipe(jshint(_jsonCfg(".jshint.json")))
    .pipe(jshint.reporter(stylish))
    .pipe(jshint.reporter("fail"));
});

gulp.task("check", function (done) {
  runSequence("jshint", "test", done);
});

gulp.task("default", ["check"]);


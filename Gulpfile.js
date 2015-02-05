var chai = require("chai");
var fs = require("fs");
var gulp = require("gulp");
var gutil = require("gulp-util");
var jshint = require("gulp-jshint");
var mocha = require("gulp-mocha");
var runSequence = require("run-sequence");
var stylish = require("jshint-stylish");
var webpack = require("webpack");
var _ = require("lodash");

// Configuration
var buildCfg = require("./webpack.config");

// JSON file helper; naive comment stripping
var _jsonCfg = function (name) {
  var raw = fs.readFileSync(name).toString();
  return JSON.parse(raw.replace(/\/\/.*\n/g, ""));
};

// webpack build
var _webpack = function (cfg, pluginExcludes, pluginExtras) {
  // Filter plugins by constructor name.
  if (pluginExcludes) {
    cfg = _.extend({}, cfg, {
      plugins: _.reject(cfg.plugins, function (plugin) {
        return _.indexOf(pluginExcludes, plugin.constructor.name) !== -1;
      })
    });
  }

  // Now add plugin extras to front.
  if (pluginExtras) {
    cfg = _.extend({}, cfg, {
      plugins: pluginExtras.concat(cfg.plugins)
    });
  }

  // Single compiler for caching.
  var compiler = webpack(cfg);

  return function (done) {
    compiler.run(function (err, stats) {
      if (err) { throw new gutil.PluginError("webpack", err); }

      gutil.log("[webpack]", stats.toString({
        hash: true,
        colors: true,
        cached: false
      }));

      done();
    });
  };
};


gulp.task("build", _webpack(buildCfg));

// testing
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

gulp.task("jshint", function (){
  return gulp.src(["Gulpfile.js", "server.js", "lib/*.js", "test/*.js"])
    .pipe(jshint(_jsonCfg(".jshint.json")))
    .pipe(jshint.reporter(stylish))
    .pipe(jshint.reporter("fail"));
});

// wrapper tasks
gulp.task("check", function (done) {
  runSequence("jshint", "test", done);
});

gulp.task("test", ["mocha"]);
gulp.task("default", ["check", "build"]);


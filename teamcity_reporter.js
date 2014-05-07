/**
 * Module dependencies.
 */

var Base = require('mocha').reporters.Base;

module.exports = function (browser) {

  // accumulates the log
  // displayed when the tests are done
  // the idea is that multiple browsers can run tests at the same time using `concurrency`...
  var logs = [];

  /**
   * Initialize a new `Teamcity` reporter.
   *
   * @param {Runner} runner
   * @api public
   */

  var Teamcity = function(runner) {
    Base.call(this, runner);
    var stats = this.stats;

    runner.on('suite', function(suite) {
      if (suite.root) {
        logs.push("##teamcity[testSuiteStarted name='" + escape(browser.browserTitle) + "']");
        return;
      }
      logs.push("##teamcity[testSuiteStarted name='" + escape(suite.title) + "']");
    });

    runner.on('test', function(test) {
      logs.push("##teamcity[testStarted name='" + escape(test.title) + "' captureStandardOutput='true']");
    });

    runner.on('fail', function(test, err) {
      logs.push("##teamcity[testFailed name='" + escape(test.title) + "' message='" + escape(err.message) + "' captureStandardOutput='true']");
    });

    runner.on('pending', function(test) {
      logs.push("##teamcity[testIgnored name='" + escape(test.title) + "' message='pending']");
    });

    runner.on('test end', function(test) {
      logs.push("##teamcity[testFinished name='" + escape(test.title) + "' duration='" + test.duration + "']");
    });

    runner.on('suite end', function(suite) {
      if (suite.root) {
        logs.push("##teamcity[testSuiteFinished name='" + escape(browser.browserTitle) + "']");
        return;
      }
      logs.push("##teamcity[testSuiteFinished name='" + escape(suite.title) + "' duration='" + (new Date() - suite.startDate) + "']");
    });

    runner.on('end', function() {
      logs.push("##teamcity[testSuiteFinished name='mocha.suite' duration='" + stats.duration + "']");
      // we're done, show the logs
      console.log(logs.join('\n'));
    });
  };

  // Teamcity.prototype.__proto__ = BaseReporter.prototype;

  return Teamcity;
}

/**
 * Escape the given `str`.
 */

function escape(str) {
  if (!str) return '';
  return str
    .replace(/\|/g, "||")
    .replace(/\n/g, "|n")
    .replace(/\r/g, "|r")
    .replace(/\[/g, "|[")
    .replace(/\]/g, "|]")
    .replace(/\u0085/g, "|x")
    .replace(/\u2028/g, "|l")
    .replace(/\u2029/g, "|p")
    .replace(/'/g, "|'");
}

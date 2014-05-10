// accepts 1 json param:
// - { files: [], // <-- preprocessed by task runner
//     mocha: opts
//     selenium: { host, port, ...},
//     browser: { browserName, capabilities....}
//   }
// then call mocha-runner

// TODO
// - add launcher-script.js file that reads that param from command line (I think json is fine...)
// - make grunt-mocha-wd.js spawn this launcher-script and capture stderr, stdout, exitcode

// node
var util = require('util');

// third-party
var wd   = require('wd');
var _    = require('lodash');

var runner = require('./mocha-runner');

var opts = {
  files: ['./test/testSpawn.js'],
  mocha: {},
  selenium: {
    hostname: '127.0.0.1',
    port: 4444
  },
  browser: {
    browserName: 'phantomjs'
  }
}


function getBrowserTitle(browserOpts) {
  var browserTitle = '' + browserOpts.browserName;
  if (browserOpts.version) {
    browserTitle = browserTitle + ' ' + browserOpts.version;
  }
  if (browserOpts.platform) {
    browserTitle = browserTitle + ' on ' + browserOpts.platform;
  }
}

function getBrowser(wdOpts, browserOpts) {
  var wdMethod = wdOpts.method || 'promiseChainRemote';
  // delete wdOpts.method;
  return wd[wdMethod](wdOpts).init(browserOpts);
}

// var b = getBrowser(opts.selenium, opts.browser);
// b.get('http://saadtazi.com').title().then(function(title) {
//   console.log(title);
// }).quit();
var browser = getBrowser(opts.selenium, opts.browser);
runner(opts.mocha, opts.files, browser, function(err) { browser.quit(); process.exit(err? 1: 0);})



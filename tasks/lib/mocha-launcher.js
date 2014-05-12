// accepts 1 json param:
// - { files: [...], // <-- preprocessed/globbed by task runner
//     mocha: {require: , reporter: , ignoreLeaks:, grep:, }
//     selenium: { host, port, ...},
//     browser: { browserName, capabilities....}
//   }
// then call mocha-runner

// node
var util = require('util');

// third-party
var wd   = require('wd');

var runner = require('./mocha-runner');

function getBrowser(wdOpts, browserOpts) {
  var wdMethod = wdOpts.method || 'promiseChainRemote';
  // delete wdOpts.method;
  return wd[wdMethod](wdOpts).init(browserOpts);
}

module.exports = function(opts) {
  var browser = getBrowser(opts.selenium, opts.browser);
  process.on('exit', function() {
    browser.quit();
  });
  opts.mocha.wd = wd;
  runner(opts.mocha, opts.files, browser, function(err) { 
    browser.quit()
    .then(function() { 
      process.exit(err? 1: 0);
    });
  });
}



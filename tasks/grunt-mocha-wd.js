'use strict';

var stream = require('stream');
var childProcess = require('child_process');

var wd = require('wd');
var SauceTunnel = require('sauce-tunnel');
var _ = require('grunt').util._;
var async = require('async');
var phantom = require('phantomjs');

var runner = require('./lib/mocha-runner');
var LogBuffer = require('./lib/log-buffer');

/*
 * grunt-mocha-webdriver
 * https://github.com/jmreidy/grunt-mocha-webdriver
 *
 * Copyright (c) 2013 Justin Reidy
 * Licensed under the MIT license
 */
module.exports = function (grunt) {
  grunt.registerMultiTask('mochaWebdriver', 'Run mocha tests against PhantomJS and SauceLabs', function () {

    var opts = this.options({
      username: process.env.SAUCE_USERNAME,
      key: process.env.SAUCE_ACCESS_KEY,
      identifier: Math.floor((new Date()).getTime() / 1000 - 1230768000).toString(),
      concurrency: 1,
      testName: "",
      testTags: [],
      tunnelFlags: null,
      secureCommands: false,
      phantomCapabilities: {},
      phantomFlags: []
    });

    grunt.util.async.forEachSeries(this.files, function (fileGroup, next) {
      if (opts.usePhantom) {
        runTestsOnPhantom(fileGroup, opts, next);
      }
      else if (opts.hostname && !opts.secureCommands) {
        runTestsOnSelenium('selenium', fileGroup, opts, next);
      }
      else {
        startTunnel(opts, function(tunnelProc) {
          runTestsOnSelenium('saucelabs', fileGroup, opts, next, tunnel);
        });
      }
    }, this.async());
  });


  function configureLogEvents(tunnel) {
    var methods = ['write', 'writeln', 'error', 'ok', 'debug'];
    methods.forEach(function (method) {
      tunnel.on('log:'+method, function (text) {
        grunt.log[method](text);
      });
      tunnel.on('verbose:'+method, function (text) {
        grunt.verbose[method](text);
      });
    });
  }

  // options "massage" functions
  function getWdMethod(usePromises) {
    return usePromises? 'promiseChainRemote' : 'remote';
  }

  function getMochaOpts(opts) {
    return {
      reporter: opts.reporter,
      require: opts.require,
      timeout: opts.timeout,
      color: true
    }
  }

  // returns a POJO that is expected by the child process
  function extractTaskOptions(opts, browserOptions, fileGroup) {
    var cnx = getSeleniumOptions(opts);
    cnx.method = getWdMethod(opts.usePromises);
    return {
      mocha: getMochaOpts(opts),
      files: fileGroup.src,
      selenium: cnx,
      browser: augmentBrowserOptions(opts, browserOptions)
    };
  }

  // adds some global options to browsers
  function augmentBrowserOptions(opts, browserOpts) {
    if (opts.testName) {
      browserOpts.name = opts.testName;
    }
    if (opts.testTags) {
      browserOpts.tags = opts.testTags;
    }
    if (opts.identifier) {
      browserOpts['tunnel-identifier'] = opts.identifier;
    }
    return browserOpts;
  }

  function getSeleniumOptions(opts) {
    var params = {};
    var defaultServer = opts.secureCommands ?
                        { hostname: '127.0.0.1', port: 4444 } :
                        { hostname: 'ondemand.saucelabs.com', port: 80 };

    params.hostname = opts.hostname || defaultServer.hostname;
    params.port     = opts.port || defaultServer.port;
    if (opts.key) {
      params.accessKey = opts.key;
    }
    ['auth', 'username'].forEach(function(prop) {
      if (opts[prop]) {
        params[prop] = opts[prop];
      }
    });
    return params;
  }

  function getBrowserTitle(browserOpts) {
    var browserTitle = '' + browserOpts.browserName;
    if (browserOpts.version) {
      browserTitle = browserTitle + ' ' + browserOpts.version;
    }
    if (browserOpts.platform) {
      browserTitle = browserTitle + ' on ' + browserOpts.platform;
    }
    return browserTitle;
  }


  // end options massage functions

  // phantom specific
  function runTestsOnPhantom(fileGroup, opts, next) {
    var taskOpts = {
      // todo
      mocha: getMochaOpts(opts),
      files: fileGroup.src,
      selenium: {
        // todo: phantomPort should be port
        port: opts.phantomPort? opts.phantomPort : 4444
      },
      browser: {
        browserName: 'phantomjs',
        capabilities: opts.phantomCapabilities,
        method: getWdMethod(opts.usePromises)
      }
    };
    

    grunt.log.writeln('Running webdriver tests against PhantomJS.');

    startPhantom(taskOpts.selenium.port, opts, function (err, phantomProc) {
      if (err) { return next(err); }
      spawnTestsForBrowser(taskOpts, false, function (code) {
        phantomProc.on('close', function () {
          grunt.log.writeln('Phantom exited.');
          next(code === 0? undefined : 'test failed');
        });
        phantomProc.kill();
      });
    });

  }

  function startPhantom(port, opts, next) {
    var phantomOpts = opts.phantomFlags || [];
    phantomOpts.push('--webdriver', port);
    if (opts.ignoreSslErrors) {
      phantomOpts.push('--ignore-ssl-errors', 'yes');
    }
    var phantomProc = childProcess.execFile(phantom.path, phantomOpts);
    var stopPhantomProc = function() {
      phantomProc.kill();
    };
    // stop child phantomjs process when interrupting master process
    process.on('SIGINT', stopPhantomProc);

    phantomProc.on('exit', function () {
      process.removeListener('SIGINT', stopPhantomProc);
    });
    phantomProc.stdout.setEncoding('utf8');
    var onPhantomData = function (data) {
      if (data.match(/running/i)) {
        grunt.log.writeln('PhantomJS started.');
        phantomProc.stdout.removeListener('data', onPhantomData);
        next(null, phantomProc);
      }
      else if (data.match(/error/i)) {
        grunt.log.error('Error starting PhantomJS');
        next(new Error(data));
      }
    };
    phantomProc.stdout.on('data', onPhantomData);
  }


  // used by runTestsOnSaucelabs or runTestsOnSeleni
  var browserFailed = false;

  // starts the tunnel
  // extracted here to merge runTestsOnSelenium and runTestsOnSaucelabs
  function startTunnel(opts, cb) {
    if (opts.browsers) {
      // todo add startTunnel option: false/true
      var tunnel = new SauceTunnel(opts.username, opts.key, opts.identifier, true, opts.tunnelFlags);
      configureLogEvents(tunnel);

      grunt.log.writeln("=> Connecting to Saucelabs ...");

      tunnel.start(function(isCreated) {
        if (!isCreated) {
          return next(new Error('Failed to create Sauce tunnel.'));
        }
        grunt.log.ok("Connected to Saucelabs.");
      });
      cb(tunnel);
    } else {
      grunt.log.writeln('No browsers configured for running on Saucelabs.');
    }
  }

  // called for saucelabs or local selenium
  // could be used for phantom also if startGhostDriver is a seperate task
  function runTestsOnSelenium(mode, fileGroup, opts, next, tunnel) {
    if (opts.browsers) {
      grunt.log.writeln("=> Connecting to %s ...", mode);

      var testQueue = async.queue(function (taskOpts, cb) {
        console.log('starting browser', getBrowserTitle(taskOpts.browser));
        spawnTestsForBrowser(taskOpts, true, cb);
      }, opts.concurrency);

      opts.browsers.forEach(function (browserOpts) {
        var taskOpts = extractTaskOptions(opts,
                                browserOpts,
                                fileGroup);

        testQueue.push(taskOpts, function (code) {
          console.log(getBrowserTitle(taskOpts.browser), 'finished');
          if (code !== 0) {
            browserFailed = true;
          }
          grunt.log.verbose.writeln('%s test complete, %s tests remaining', taskOpts.browser.browserTitle, testQueue.length());
        });
      });

      testQueue.drain = function () {
        var err;
        if (browserFailed) {
          err = new Error('One or more tests on Selenium failed.');
        }
        if (tunnel) {
          tunnel.stop(function () {
            next(err);
          });
        } else {
          next(err);
        }
      };

    }
    else {
      grunt.log.writeln('No browsers configured for running on Selenium.');
    }
  }

  // used to output logs from child process
  function procLog(type, logStream) {
    return function(data) {
      // console[type](data.toString());
      logStream.write(data);
    };
  }

  // starts a child process
  function spawnTestsForBrowser(taskOpts, shouldBuffer, cb) {
    // todo: use shouldBuffer
    var params = [
      require('path').join(__dirname, '/lib/launcher_script.js'),
      JSON.stringify(taskOpts)
    ],
        procOpts = {},
        logBuffer;
    function spawn(procOpts) {
      var proc = childProcess.spawn('node', params, procOpts);
      proc.on('exit', function(code) {

        if (shouldBuffer && logBuffer) {
          logBuffer.pipe(process.stdout, function() {
            cb(code);
          });
        } else {
          cb(code);
        }
      });
    }

    if (shouldBuffer) {
      logBuffer = new LogBuffer(function() {
        procOpts.stdio = [0, logBuffer.writeStream, logBuffer.writeStream];
        spawn(procOpts);
      });
    } else {
      procOpts.stdio = 'inherit';
      spawn(procOpts);
    }
    

  }
};

//wd.js monkey patch for clearer errors
var _newError = wd.webdriver.prototype._newError;
wd.webdriver.prototype._newError = function (opts) {
  var err = _newError(opts);
  try {
    err = new Error(err.cause.value.message
      .match(/([\s\S]*) caused/)[1]
      .match(/'([\s\S]*)'\n/)[1]
    );
  }
  catch (e) {}
  return err;
};

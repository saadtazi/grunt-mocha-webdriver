// usage:
// node tasks/lib/launcher_script.js '{"files":["./test/testSpawn.js"],"mocha":{},"selenium":{"hostname":"127.0.0.1","port":4444},"browser":{"browserName":"phantomjs"}}'

var launchMochaSuite = require('./mocha-launcher');

var opts = JSON.parse(process.argv[2]);
// console.log('is tty?', require('tty').isatty(1));

launchMochaSuite(opts);
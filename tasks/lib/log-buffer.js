var util = require('util');
var fs = require('fs');
var os = require('os');
var path = require('path');


// TODO change to a better Duplex memory stream...
function LogBuffer(cb) {
  this.filePath = path.join(os.tmpdir(), 'log-' + (new Date()).getTime());
  this.writeStream = fs.createWriteStream(this.filePath);
  // have to wait for 'open' evt
  this.writeStream.on('open', cb);
}

LogBuffer.prototype.pipe = function(destStream, cb) {
  var self = this;
  this.writeStream.end();
  var readStream = fs.createReadStream(this.filePath);

  readStream.pipe(destStream);
  readStream.on('end', function() {
    fs.unlink(self.filePath);
    cb && cb();
  });

}

module.exports = LogBuffer;


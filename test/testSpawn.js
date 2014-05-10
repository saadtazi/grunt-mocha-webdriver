var assert = require('assert');

describe('yo', function() {
  it('should yi', function(done) {
    this.browser.get('http://saadtazi.com').title().then(function(title) {
      assert.equal(title, 'Saad Tazi');
    }).nodeify(done);

  });
});
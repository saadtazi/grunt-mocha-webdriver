describe('desc1', function() {
  it('test1', function(done) {
    this.browser.get('http://saadtazi.com/')
      .waitForElementByCssSelector('body', 1000)
      .nodeify(done);
  });
  it('test2', function(done) {
    this.browser.get('http://radialpoint.com/')
      .waitForElementByCssSelector('body', 1000)
      .nodeify(done);
  });
  describe('desc1.1', function() {
    it('test1.1', function(done) {
      this.browser.get('http://blog.fruitsoftware.com/')
        .waitForElementByCssSelector('bodyy', 1000)
        .nodeify(done);
    });
    describe('desc1.1.1', function() {
      it('test1.1.1', function(done) {
        this.browser.get('http://beta.saadtazi.com/')
          .waitForElementByCssSelector('body', 1000)
          .nodeify(done);
      });
      it('test1.1.2', function(done) {
        this.browser.get('http://www.google.com/')
          .waitForElementByCssSelector('body', 1000)
          .nodeify(done);
      });
    });

    it('test1.2', function(done) {
      this.browser.get('http://www.yahoo.com/')
        .waitForElementByCssSelector('body', 1000)
        .nodeify(done);
    });
  });
});
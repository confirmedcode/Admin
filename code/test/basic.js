// Chai + Server (Server must be loaded before other utilities)
const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = require("chai").should();

describe("Basic", () => {
  
  describe("Health Check", () => {
    it("should respond 200 and JSON OK", (done) => {
      chai.request(server)
        .get("/health")
        .then(response => {
          response.status.should.equal(200);
          response.body.message.should.contain("OK from");
          done();
        })
        .catch(error => {
          done(error);
        });
    });
  });
  
});
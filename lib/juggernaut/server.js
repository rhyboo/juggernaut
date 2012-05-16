var http     = require("http");
var https    = require("https");
var path     = require("path");
var fs       = require("fs");
var io       = require("socket.io");
var nstatic  = require("node-static");
var Connection = require("./connection");
var logger = require("../logger");

var credentials;
var keysPath = __dirname + "/keys";
if (path.existsSync(keysPath + "/privatekey.pem") && path.existsSync(keysPath + "/certificate.pem")) {
  var privateKey = fs.readFileSync(keysPath + "/privatekey.pem", "utf8");
  var certificate = fs.readFileSync(keysPath + "/certificate.pem", "utf8");
  credentials = {key: privateKey, cert: certificate};
}

Server = module.exports = require("./klass").create();

var fileServer = new nstatic.Server(path.normalize(__dirname + "../../../public"));

Server.include({
  init: function(){
    var connectionListener = function(request, response){
      request.addListener("end", function() {

        fileServer.serve(request, response, function (err, res) {
          if (err) { // An error as occured
            logger.log("> Error serving " + request.url + " - " + err.message);
            response.writeHead(err.status || 500, err.headers);
            response.end();
          } else { // The file was served successfully
            logger.log("Serving " + request.url + " - " + res.message);
          }
        });

      });
    }

    if (credentials) {
      this.httpServer = https.createServer(credentials, connectionListener);
    } else {
      this.httpServer = http.createServer(connectionListener);
    }

    this.io = io.listen(this.httpServer);

    var env = process.env.NODE_ENV || "development"
    console.log("Socket.io - set configuration for " + env);

    this.io.configure('development', function() {
      this.set('log level', 5);
    });

    this.io.configure('production', function() {

      var redis = require("./redis");

      this.set('log level', 1);
      this.enable('browser client etag');
      this.enable('browser client gzip');
      this.set('store', 
        new io.RedisStore({
          redisPub: redis.createClient(),
          redisSub: redis.createClient(),
          redisClient: redis.createClient()
        })); // use redis as store
      this.set('transports', [ // enable all transports (optional if you want flashsocket)
          'websocket'
        , 'flashsocket'
        , 'htmlfile'
        , 'xhr-polling'
        , 'jsonp-polling'
      ]);
    });

    this.io.sockets.on("connection", function(stream){ Connection.inst(stream) });
  },

  listen: function(port){
    port = parseInt(port || process.env.PORT || 8080);
    this.httpServer.listen(port);
  }
});
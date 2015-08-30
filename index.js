//libraries
var constants = require('constants'),
    tls = require('tls'),
    fs = require('fs'),
    events = require('events'),
    trans = require('./transparent').open;

//static variables
var HEADERS = "Proxy-agent: kokyman/0.0.1\r\n";
var tlsOptions = {
	key: fs.readFileSync('./certs/thecoffeehouse.xyz.key'),
	cert: fs.readFileSync('./certs/thecoffeehouse.xyz.bundle.crt'),
	ciphers: 'ECDH+AESGCM:DH+AESGCM:ECDH+AES256:DH+AES256:ECDH+AES128:DH+AES:ECDH+3DES:DH+3DES:!aNULL:!MD5:!DSS',
	dhparam: fs.readFileSync('./certs/dhparam.pem'),
	honorCipherOrder: true,
	secureOptions: constants.SSL_OP_NO_SSLv3 | constants.SSL_OP_NO_SSLv2
}

var server = tls.createServer(tlsOptions, function (socket) {
	var buffer = '',
	    http_version = 'HTTP/1.1';

	send_response = function(numeric, text, close) {
	console.log('Sending HTTP ' + numeric + ' ' + text + ' response');

	socket.write(http_version + ' ' + numeric + ' ' + text + "\r\n" + HEADERS + "\r\n");

	if(close) {
		console.log('Disconnecting client');
		socket.end();
	}
}

// define it here so it can be unassigned
var handler = function(data) {
	buffer += data.toString();

	if (buffer.indexOf("\r\n\r\n") > -1 || buffer.indexOf("\n\n") > -1) {
		socket.removeListener('data', handler);

		var captures = buffer.match(/^CONNECT ([^:]+):([0-9]+) (HTTP\/1\.[01])/);

		if (!captures || captures.length < 2) {
			console.log('Received invalid HTTP request');
			return send_response(400, 'Bad Request', true);
		}

		var tmp = captures[1].split('~');
		var target = tmp[0];
		var port = captures[2];
		console.log('Client requested a tunnel to ' + target + ' port ' + port);

		http_version = captures[3];
		console.log('Remote port is ' + port);

		if (!port) { return send_response(401, 'Unknown Proxy Target', true); }

			trans(target, port, target + ':' + port, function(err, remote) {
				
				if(err){
					console.log(err);
					send_response(500, 'Remote node refused tunnel or does not respond', true);
					return;
				}
				
				send_response(200, 'Connection Established');
				console.log('Connected to upstream service, initiating tunnel pumping');
				
				//define a kill switch for this tunnel
				
				var killSwitch = new events.EventEmitter();
				
				killSwitch.once('disconnect', function() {
					console.log('An error was encountered, forcing tunnel to close'); 
					socket.end(); 
					remote.end();
				});

				var tunnel = function(other) {
					return function(data) {
						other.write(data); 
					}
				}

				socket.addListener('data', tunnel(remote));
				remote.addListener('data', tunnel(socket));

				socket.addListener('close', function(){
					console.log('client socket closed connection, all sockets will now close or have been closed');
					remote.end();
				});
				remote.addListener('close', function(){
					console.log('remote socket closed connection, all sockets will now close or have been closed');
					socket.end();
				});

				socket.addListener('error', function(){
					killSwitch.emit('disconnect');
				});
				remote.addListener('error', function(){
					killSwitch.emit('disconnect');
				});
			});
		}
	}
	socket.addListener('data', handler);
});

//initialize tunnelling proxy
server.listen(3080);
console.log('Secure proxy server running at http://0.0.0.0:3080/');

//Finally set up exception handling
process.on('uncaughtException',function(error){
	//process error
	console.log(error);
});
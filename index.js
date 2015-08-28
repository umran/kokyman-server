//Libraries
var tls = require('tls'),
    fs = require('fs'),
    events = require('events'),
    trans = require('./transparent').open;
    
//static variables
var HEADERS = "Proxy-agent: protonet-proxy/0.0.1\r\n";
var tlsOptions = {
	key: fs.readFileSync('./certs/thecoffeehouse.xyz.key'),
	cert: fs.readFileSync('./certs/thecoffeehouse.xyz.bundle.crt'),
	ciphers: 'ECDH+AESGCM:DH+AESGCM:ECDH+AES256:DH+AES256:ECDH+AES128:DH+AES:ECDH+3DES:DH+3DES:RSA+AESGCM:RSA+AES:RSA+3DES:!aNULL:!MD5:!DSS',
	dhparam: fs.readFileSync('./certs/dhparam.pem'),
	honorCipherOrder: true,
	secureOptions: constants.SSL_OP_NO_SSLv3
}

var server = tls.createServer(tlsOptions, function (socket) {
	var buffer = '',
	    http_version = 'HTTP/1.1';

	send_response = function(numeric, text, close) {
	console.log('Sending HTTP ' + numeric + ' ' + text + ' response');

	try {
		socket.write(http_version + ' ' + numeric + ' ' + text + "\r\n");
		socket.write(HEADERS + "\r\n");
	}catch(ex) {
		console.log('Error occurred while sending HTTP response');
	}

	if(close) {
		console.log('Disconnecting client');
		socket.end();
	}
}

// define it here so it can be unassigned
var handler = function(data) {
	buffer += data.toString();

	if (buffer.indexOf("\r\n\r\n") > 0 || buffer.indexOf("\n\n") > 0) {
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
				
				console.log('Connected to upstream service, initiating tunnel pumping');
				
				//define a kill switch for this tunnel
				
				var killSwitch = new events.EventEmitter();
				
				killSwitch.once('disconnect', function() {
					console.log('Disconnecting tunnel');
					try { 
						socket.end(); 
					}catch(ex) {}
					try { 
						remote.end(); 
					}catch(ex) {}
				});

				var closeBoth = function(){
					killSwitch.emit('disconnect');
				}

				var tunnel = function(other) {
					return function(data) {
						try { 
							other.write(data); 
						}catch(ex) {
							console.log('Error during socket write');
							closeBoth();
						}
					}
				}

				socket.addListener('data', tunnel(remote));
				remote.addListener('data', tunnel(socket));

				socket.addListener('close', closeBoth);
				remote.addListener('close', closeBoth);

				socket.addListener('error', closeBoth);
				remote.addListener('error', closeBoth);

				send_response(200, 'Connection Established');
			});
		}
	}
	socket.addListener('data', handler);
});

//initialize tunnelling proxy
server.listen(443);
console.log('Secure proxy server running at http://0.0.0.0:443/');

//Finally set up exception handling
process.on('uncaughtException',function(error){
	//process error
	console.log(error);
});
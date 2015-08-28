var net = require('net');

exports.open = function(host, port, trash, callback) {
  console.log('Connecting to ' + host + ':' + port);

  var proxy = new net.Socket();
  
  var error_callback = function() {
  	callback('connection attempt to remote host failed');
  }
  
  proxy.addListener('error', error_callback);
  
  proxy.connect(port, host, function() {
    console.log('Connected, proxying traffic verbatim');
    proxy.removeListener('error', error_callback);
    callback(null, proxy);
  });
}
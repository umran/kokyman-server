var proxying = require('proxying-agent');
var https = require('https');
var fs = require('fs');

var proxyingOptions = {
	proxy: 'localhost:8080',
	tunnel: true,
	tlsOptions: {
		key: fs.readFileSync('../certs/thecoffeehouse.xyz.key'),
  	cert: fs.readFileSync('../certs/thecoffeehouse.xyz.bundle.crt'),
  	dhparam: fs.readFileSync('../certs/dhparam.pem'),
  	ciphers: 'ECDHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA256:AES128-GCM-SHA256:!RC4:!MD5:!aNULL',
  	honorCipherOrder: true,
  	secureOptions: 'SSL_OP_NO_SSLv3'
	}
};

var proxyingAgent = new proxying.ProxyingAgent(proxyingOptions);

var req = https.request({
	host: 'thecoffeehouse.xyz',
	port: 22,
	agent: proxyingAgent
});
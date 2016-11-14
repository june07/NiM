/**
 * MIT License
 *
 *    Copyright (c) 2016 June07
 *
 *    Permission is hereby granted, free of charge, to any person obtaining a copy
 *    of this software and associated documentation files (the "Software"), to deal
 *    in the Software without restriction, including without limitation the rights
 *    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *    copies of the Software, and to permit persons to whom the Software is
 *    furnished to do so, subject to the following conditions:
 *
 *    The above copyright notice and this permission notice shall be included in all
 *    copies or substantial portions of the Software.
 *
 *    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *    SOFTWARE.
 */
module.exports = (function () {
	var http = require('http');

	var config = {
		messages: {
			/** See init function() for the following config values:
			listening:
			probing:
			*/
			started: "Node Inspector session started.",
		},
		options: {
			port: 9230
		},
		v8probe: {
			options: {
				hostname: '127.0.0.1',
				port: 9229,
				path: '/json',
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			},
			delay: 10000
		},
		init: function (resolve, reject) {
			this.messages.listening = "nim is listening on port " + this.options.port + "...";
			this.messages.probing = "nim is probing on port " + this.v8probe.options.port + "...";
			resolve();
		}
	};

	var nim = {
		inspect: this.process.execArgv['--inspect'],
		app: null,
		io: null,
		probe: function* probe(delay) {
			while (true) {}
			yield
		}

			configure: function () {
			return new Promise(function (resolve, reject) {
				config.init(resolve, reject);
			});
		},
		v8handler: function (req, res) {
			res.writeHead(200);
			res.end(config.messages.listening);

			req.on('connect', function (res, socket, head) {

			});
		},

		handler: function (req, res) {
			res.writeHead(200);
			res.end(config.messages.listening);
		},
		/**
		 *	If we are not included as a dependancy then listen for external Node v8 Inspector starts.
		 *	Once detected, connect to local inspector monitor and get the port.  Then pass it via websocket
		 *	to chrome plugin.  Basically serving as a proxy.
		 *
		 */
		v8Probe: function () {
			io.sockets.setMaxListeners(0);
			
			var req = http.request(config.v8probe.options, function (res) {
				res.on('data', function (chunk) {
					io.emit('started', config.messages.started);
					io.sockets.on('data', function (chunk) {
						console.log(chunk.toString());
					});
					io.sockets.on('end', function () {
						console.log("External Node v8 Inspector stopped.");
					});
				});
				res.on('end', function () {
					//console.log('No more data in response.');
				});

			});
			req.on('error', function (error) {
				console.log('problem with request: ' + error.message);
			});
			req.end();
		},
		inspectorMonitor: function () {
			app.listen(config.options.port);
			console.log(config.messages.listening);
			io.on('connection', function (socket) {
				socket.emit('connected');
				socket.on('connected', function (data) {
					console.log(data);
					socket.emit('started', config.messages.started);
				});
				socket.on('tabopen', function (data) {
					console.log("Pausing... " + console.dir(data));
					//console.dir(nim.interval);
					clearInterval(nim.interval);
				});
			});
		}
	}
	nim.configure()
		.then(function () {
			app = http.createServer(nim.handler);
			io = require("socket.io")(app);

			nim.inspectorMonitor();
			nim.v8Probe();
		});
	console.log("Started nim");
})();

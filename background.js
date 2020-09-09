/**
 * MIT License
 *
 *    Copyright (c) 2016-2020 June07
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
'use strict'

var ngApp = angular.module('NimBackgroundApp', []);
ngApp
.run(function() {})
.controller('nimController', ['$scope', '$window', '$http', '$q', function($scope, $window, $http, $q) {
    class Auth {
        constructor() {
            let self = this;
            self.isAuthenticated = false;
            self.loggingin = false;
            createAuth0Client({
                domain: env.AUTH0_DOMAIN,
                client_id: env.AUTH0_CLIENT_ID,
                audience: DEVEL ? 'https://api-dev.brakecode.com/api/v1/' : 'https://api.brakecode.com/api/v1',
                display: 'popup'
            })
            .then(auth0 => {
                self.auth0 = auth0;
            });

            $scope.$on('brakecode-login', function() {
                self.loggingin = true;
                // Remove the spinner if the login doesn't happen within a period of time.  Not sure there's a callback for dismissing the login popup.
                setTimeout(function() {
                    this.loggingin = false;
                    Object.values(connections).map(c => c.postMessage({ event: 'brakecode-login-cancelled' }));
                }.bind(self), 5000);
                
                $scope.Auth.auth0.getTokenSilently()
                .then(() => {
                    self.isAuthenticated = true;
                    self.setProfileData(() => {
                        Object.values(connections).map(c => c.postMessage({ event: 'brakecode-logged-in' }));
                        $scope.$emit('brakecode-logged-in');
                    });
                    self.loggingin = false;
                })
                .catch(err => {
                    if (err.error === 'login_required') {
                        $scope.Auth.auth0.loginWithPopup()
                        .then(authResult => {
                            self.isAuthenticated = true;
                            localStorage.authResult = JSON.stringify(authResult);
                            self.setProfileData(() => {
                                Object.values(connections).map(c => c.postMessage({ event: 'brakecode-logged-in' }));
                                $scope.$emit('brakecode-logged-in');
                            });
                            chrome.notifications.create({
                                type: 'basic',
                                iconUrl: 'icon/icon128.png',
                                title: 'Login Successful',
                                message: 'Advanced NiM Features Ready.'
                            }, function(notificationId) {
                                $window._gaq.push(['_trackEvent', 'Notification Event', 'notification_created', 'Brakecode Login Success', undefined, true]);
                                if ($scope.settings.debugVerbosity >= 4) console.log(notificationId);
                            });
                            self.loggingin = false;
                        }).catch(async function (err) {
                            chrome.notifications.create({
                                type: 'basic',
                                title: 'Login Failed',
                                message: err.message,
                                iconUrl: 'icon/icon128.png'
                            }, function(notificationId) {
                                $window._gaq.push(['_trackEvent', 'Notification Event', 'notification_created', 'Brakecode Login Failed', undefined, true]);
                                if ($scope.settings.debugVerbosity >= 4) console.log(notificationId);
                            });
                            self.loggingin = false;
                        });
                    } else {
                        chrome.notifications.create({
                            type: 'basic',
                            title: 'Login Failed',
                            message: err.error_description,
                            iconUrl: 'icon/icon128.png'
                        }, function(notificationId) {
                            $window._gaq.push(['_trackEvent', 'Notification Event', 'notification_created', 'Brakecode Login Failed', undefined, true]);
                            if ($scope.settings.debugVerbosity >= 4) console.log(notificationId);
                        });
                        self.loggingin = false;
                    }
                });
            });
            $scope.$on('brakecode-logout', () => {
                localStorage.clear();
                $scope.Auth.auth0.logout({ localOnly: true });
                $scope.Auth.isAuthenticated = false;
            });
        }
        async setProfileData(callback) {
            let id_token = await this.getIdToken();
            let profile = jwt_decode(id_token);
            this.profile = {
                nickname: profile.nickname,
                user_metadata: profile[DEVEL ? 'http://localhost/user_metadata' : 'https://brakecode.com/user_metadata'],
                picture: profile.picture
            };
            callback();
        }
        async getIdToken() {
            let self = this;
            const claims = await self.auth0.getIdTokenClaims();
            // if you need the raw id_token, you can access it
            // using the __raw property
            const id_token = claims.__raw;
            return id_token;
        }
        async getAPIKey() {
            if (!$scope.Auth || !$scope.Auth.isAuthenticated) return;
            let id_token = await this.getIdToken();
            let key = jwt_decode(id_token)[DEVEL ? 'http://localhost/apikey' : 'https://brakecode.com/apikey'];
            return key;
        }
    }
    class DevToolsProtocolClient {
        constructor() { 
            this.sockets = {};
        }
        getSocket(socketUrl) {
            let self = this,
                ws = new WebSocket(socketUrl),
                socket = this.parseWebSocketUrl(socketUrl)[2];
            ws.addEventListener('close', () => {
                self.closeSocket(self.sockets[socket]);
            });
            return ws;
        }
        parseWebSocketUrl(socketUrl) {
            return socketUrl.match(/(wss?):\/\/(.*)\/(.*)$/);
        }
        setSocket(websocketId, socketUrl, options) {
            let socket = this.parseWebSocketUrl(socketUrl)[2];
            if (! this.sockets[socket]) {
                let ws = this.getSocket(socketUrl);
                this.sockets[socket] = { messageIndex: 0, socketUrl, ws, socket };
            }
            let promise = this.tasks(this.sockets[socket], options);
            return promise;
        }
        closeSocket(dtpSocket) {
            if (dtpSocket === undefined) return;
            delete this.sockets[dtpSocket.socket];
            if (dtpSocket.ws.readyState !== WebSocket.CLOSED) dtpSocket.ws.close();
        }
        updateSocket(websocketId, socketUrl, options) {
            // Only need to update the websocket if the tab has been reused with a different debugger websocketId.
            let socket = this.parseWebSocketUrl(socketUrl)[2];
            if (socketUrl.includes(websocketId)) return Promise.resolve(this.sockets[socket]);
            if (!this.sockets[socket].ws.readyState !== WebSocket.CLOSED) {
                this.sockets[socket].ws.close();
                delete this.sockets[socket].ws;
            }
            this.sockets[socket] = {
                messageIndex: 0,
                socketUrl,
                ws: this.getSocket(socketUrl),
                socket
            };
            let promise = this.tasks(this.sockets[socket], options);
            return promise;
        }
        tasks(socket, options) {
            return new Promise(resolve => {
                let autoResume = options && options.autoResume ? options.autoResume : false;
                if (autoResume) {
                    this.autoResumeInspectBrk(socket)
                    .then(socket => {
                        resolve(socket);
                    })
                } else {
                    resolve(socket);
                }
            });
        }
        autoResumeInspectBrk(socket) {
            let parsedData = {};

            socket.ws.onmessage = event => {
                let parsed = JSON.parse(event.data);
                switch(parsed.method) {
                    case 'Debugger.paused':
                        if (! this.sockets[socket.socket].autoResumedOnce) {
                            socket.ws.send(JSON.stringify({ id: 667+socket.messageIndex++, method: 'Debugger.resume' }));
                            console.log(`Auto resuming debugger from initial 'inspect-brk' state.`);
                            this.sockets[socket.socket].autoResumedOnce = true;
                        }
                        break;
                    case 'Debugger.scriptParsed':
                        if (parsed.url && parsed.url.indexOf('helloworld2.js')) {
                            parsedData.scriptId = parsed.params.scriptId;
                        }
                        break;
                }
                if ($scope.settings.debugVerbosity >= 1) console.log(event);
            }
            return new Promise(resolve => {
                socket.ws.onopen = event => {
                    if ($scope.settings.debugVerbosity >= 1) console.log(event);
                    socket.ws.send(JSON.stringify( { id: 667+socket.messageIndex++, method: 'Debugger.enable' }));
                    //socket.ws.send(JSON.stringify({ id: 667+socket.messageIndex++, method: 'Debugger.resume' }));
                    //if ($scope.settings.debugVerbosity >= 5) console.log(`DevToolsProtocolClient issued protocol command: Debugger.resume`);
                };
                resolve(socket);
            });
        }
    }
    class PubSub {
        constructor() {
            let self = this;
            this.init();
            $scope.$on('brakecode-logged-in', () => {
                self.init();
                self.pubnub.reconnect();
            });
            $scope.$on('brakecode-logged-out', () => {
                self.pubnub.stop();
                self.pubnub = null;
            });
        }
        init() {
            let self = this;
            let authKeyProfileString = DEVEL ? 'http://localhost/pubsub_auth_keys' : 'https://brakecode.com/pubsub_auth_keys';
            this.pubnub = new PubNub({
                subscribeKey: env.PUBNUB_SUBSCRIBE_KEY,
                authKey: localStorage.profile ? JSON.parse(localStorage.profile)[authKeyProfileString] : [],
                ssl: true
            });
            this.pubnub.subscribe({
                channels: this.getChannels()
            });
            this.pubnub.addListener({
                message: function(m) {
                    let msg = m.message;
                    if (msg.report) {
                        msg.report = self.parseReport(msg);
                        $scope.nodeReportMessages.push(msg);
                    }
                    try {
                        Object.values(connections).forEach(c => c.postMessage({ event: 'newNodeReportMessage', report: msg.report }));
                    } catch (error) {
                        if (DEVEL) console.log(`Error ${error}`)
                    }
                    self.sortMessagesByHost();
                    self.pruneMessages();
                }
            });
        }
        getChannels() {
            if (localStorage.profile) {
                let channels = [];
                if (DEVEL && JSON.parse(localStorage.profile)['http://localhost/apikey']) channels.push(`${JSON.parse(localStorage.profile)['http://localhost/apikey']}`);
                else channels.push(`${JSON.parse(localStorage.profile)['https://brakecode.com/apikey']}`);
                return channels;
            }
        }
        parseReport(msg) {
            let reportString = msg.report,
                reportObject = {};

            if (msg.type === 'node-reports') {
                let metrics = [
                        'dump event time',
                        'module load time',
                        'process id',
                        'command line',
                        'node.js version',
                        'os version',
                        'machine',
                        'Total heap memory size',
                        'Total heap committed memory',
                        'Total used heap memory',
                        'Total available heap memory',
                        'Heap memory limit'
                    ];
                    reportObject.string = reportString;
                reportString.split('\n').map(line => {
                    metrics.find((metric, index) => {
                        let regex = new RegExp(`(^${metric}):(.*)`, 'i')
                        reportObject.temp = line.match(regex) ? line.match(regex) : '';
                        if (reportObject.temp) {
                            metrics.splice(index, 1);
                            reportObject[metric] = {
                                title: reportObject.temp[1],
                                value: reportObject.temp[2].trim()
                            }
                            return true;
                        }
                    });
                });
                reportObject.id = reportObject.machine.value + ' ' + reportObject['dump event time'].value;
            } else {
                reportObject = msg.report;
                reportObject.machine = { title: 'machine', value: msg.host || reportObject.header.host };
                reportObject.id = reportObject.machine.value + ' ' + reportObject.header.dumpEventTime;
            }     
            return reportObject;
        }
        sortMessagesByHost() {
            if ($scope.nodeReportMessages.length === 0) return [];
            let hosts = {};
            $scope.nodeReportMessages.map(message => {
                let host = message.report.id.split(' ')[0],
                    report = message.report;
                if (!hosts[host]) {
                    hosts[host] = [ {report} ];
                } else {
                    if (hosts[host].find(message => message.report.id === report.id)) {
                        console.log(`SOMETHING IS WRONG!  found duplicate message`);
                    } else {
                        hosts[host].push({report});
                    }
                }
            });
            $scope.nodeReportSortedMessages = hosts;
        }
        pruneMessages() {
            Object.entries($scope.nodeReportSortedMessages).map((kv, i, groups) => {
                let host = kv[0],
                    messages = kv[1];
                while (messages.length > $scope.settings.diagnosticReports.maxMessages) {
                    messages.shift();
                }
                while ($scope.nodeReportMessages.length > groups.length * $scope.settings.diagnosticReports.maxMessages) {
                    $scope.nodeReportMessages.shift();
                }
                $scope.nodeReportSortedMessages[`${host}`] = messages;
            });
        }
    }
    class NiMSVSCodeConnector {
        constructor () {
        }
        check() {
            $http({
                method: "GET",
                url: 'http://localhost:6607/json',
                responseType: "json"
            })
            .then((json) => {
                json.data.forEach(session => {
                    saveSession(getDevToolsURL(session), 'http://' + session.inspectSocket + '/json', session.id, null, session)
                })
            })
            .catch(error => {
                if ($scope.settings.debugVerbosity >= 1) console.log(error);
            });
        }
    }
    class NotificationService {
        constructor() {
            this.notifications = [];
            if (DEVEL) setTimeout(this.pullNotifications.bind(this), 5000);
            setInterval(this.pullNotifications.bind(this), NOTIFICATION_CHECK_INTERVAL);
            setInterval(this.pushUnpushedNotification.bind(this), NOTIFICATION_PUSH_INTERVAL);
        }
        saveNotifications() {
            let notifications = JSON.stringify(this.notifications);
            chrome.storage.local.set({ 'notifications': notifications }, () => {
                $window._gaq.push(['_trackEvent', 'Program Event', 'Notification Service', 'Saving notifications.', this.notifications.length, true]);
            });
        }
        loadNotifications() {
            chrome.storage.local.get(['notifications'], notifications => {
                if (Object.keys(notifications).length === 0) return;
                this.notifications = notifications;
                $window._gaq.push(['_trackEvent', 'Program Event', 'Notification Service', 'Loading notifications.', this.notifications.length, true]);
            });
        }
        pullNotifications() {
            $http({
                method: "GET",
                url: MESSAGING_SERVICE_URL,
                responseType: "json"
            })
            .then((json) => {
                let gaArray = [];
                gaArray.push(['_trackEvent', 'Program Event', 'Notification Service', 'Pulled Messages', parseInt(json.data.length), true]);
                json.data.forEach(message => {
                    if (this.notifications.find(notification => notification.type + ' ' + notification.id === message.type + ' ' + message.id) === undefined) {
                        gaArray.push(['_trackEvent', 'Program Event', 'Notification Service', 'Pulled ' + message.type + ' ' + message.id, undefined, true]);
                        this.notifications.push(message);
                    }
                });
                $window._gaq.push(gaArray);
                this.removeExpiredNotifications();
                this.saveNotifications();
            })
            .catch(error => {
                if ($scope.settings.debugVerbosity >= 1) console.log(error);
            });
        }
        removeExpiredNotifications() {
            let gaArray = [];
            this.notifications = this.notifications.filter(notification => {
                let remainingTime = Date.now() + NOTIFICATION_LIFETIME - notification.date;
                let expired = (remainingTime > 0) ? false : true;
                if ((DEVEL || $scope.settings.debugVerbosity >= 1) && expired) console.log(`Removing expired ${notification.type} notification ${notification.id}.`);
                if (DEVEL || $scope.settings.debugVerbosity >= 1) console.log(`Notification lifetime for ${notification.type} notification ${notification.id}: ${$scope.moment.duration(remainingTime).humanize()}`);
                gaArray.push(['_trackEvent', 'Program Event', 'Notification Service', 'Expired ' + notification.type + ' ' + notification.id, undefined, true]);
                return !expired;
            });
            $window._gaq.push(gaArray);
        }
        addNotification(notification) {
            let found = this.notifications.find();
            if (found === undefined) this.notifications.push(notification);
        }
        getNotifications() {
            return this.notifications;
        }
        getNotification(chromiumNotificationId) {
            return this.notifications.find(notification => notification.chromiumNotificationId === chromiumNotificationId);
        }
        pushUnpushedNotification() {
            let unpushed = this.notifications.find(notification => notification.pushed === undefined || notification.pushed !== true);
            if (unpushed) {
                if (! $scope.settings.notifications.enabled) {
                    $window._gaq.push(['_trackEvent', 'Program Event', 'Notification Service', 'Push Notifications Disabled ' + unpushed.type + ' ' + unpushed.id, undefined, true]);
                    return;
                }
                pushNotification(unpushed);
                unpushed.pushed = true;
                $window._gaq.push(['_trackEvent', 'Program Event', 'Notification Service', 'Pushed ' + unpushed.type + ' ' + unpushed.id, undefined, true]);
            }
        }
        haveNotifications() {
            let count = parseInt(this.notifications.length);
            $window._gaq.push(['_trackEvent', 'Program Event', 'Notification Service', 'Notifications', count, true]);
            return count > 0 ? true : false;
        }
    }
    class NiMSConnector {
        constructor() {
            let self = this;
            self.PADS_SERVER = DEVEL ? 'https://pads-dev.brakecode.com' : 'https://pads.brakecode.com';
            self.PADS_HOST = DEVEL ? 'pads-dev.brakecode.com' : 'pads.brakecode.com';
            self.NAMESPACE_APIKEY_NAME = DEVEL ? 'namespace-apikey-dev.brakecode.com' : 'namespace-apikey.brakecode.com';
            self.PUBLIC_KEY_NAME = DEVEL ? 'publickey-dev.brakecode.com' : 'publickey.brakecode.com';
            self.settings = {
                remoteTabTimeout: DEVEL ? 7*24*60*60000 : 7*24*60*60000,
                START_PADS_SOCKET_RETRY_INTERVAL: DEVEL ? 10000 : 60000
            }
            self.timeouts = {
                START_PADS_SOCKET_RETRY_INTERVAL: undefined
            }
            this.startPADSSocket();
        }
        async startPADSSocket() {
            let self = this,
                apikey =  await $scope.Auth.getAPIKey(),
                namespaceUUID = await self.lookup(self.NAMESPACE_APIKEY_NAME),
                publicKey = await self.lookup(self.PUBLIC_KEY_NAME);

            if (!apikey) {
                self.timeouts.START_PADS_SOCKET_RETRY_INTERVAL = setTimeout(self.startPADSSocket.bind(self), self.settings.START_PADS_SOCKET_RETRY_INTERVAL);
                return;
            }

            let namespace = uuidv5(apikey, namespaceUUID);
            self.io = $window.io(self.PADS_SERVER + '/' + namespace, { transports: ['websocket'], path: '/nim', query: { apikey: encryptMessage(apikey, publicKey) } })
            .on('connect_error', (error) => {
                console.log('CALLBACK ERROR: ' + error);
                //if (error.message && error.message == 'websocket error') self.reauthenticate();
            })
            .on('metadata', (data) => {
                let date = Date.now();
                data.received = date;
                let found = $scope.remoteTabs.findIndex((element, i, elements) => {
                    if (element.uuid === data.uuid) {
                        elements[i] = data;
                        return true;
                    }
                });
                if (found === -1) $scope.remoteTabs.push(data);
                $scope.remoteTabs = $scope.remoteTabs.filter((tab) => self.remoteTabTimeout(tab.received));
                //$scope.$emit('updatedRemoteTabs', remoteTabs);
                //$scope.remoteTabs = remoteTabs;
            })
        }
        lookup(record) {
            return new Promise((resolve, reject) => {
                $http({
                    method: "GET",
                    url: `https://cloudflare-dns.com/dns-query?name=${record}&type=TXT`,
                    headers: {
                        'Accept': "application/dns-json"
                    }
                })
                .then(response => {
                    if (response.status !== 200) return reject(response.statusText);
                    if (response.data.Status !== 0) return reject(new Error(`Cloudflare query failed with status code: ${response.data.Status}`));
                    let namespaceUUID = response.data.Answer[0].data;
                    if (!namespaceUUID) {
                        reject(new Error(`Error getting ${record}.`));
                    }
                    namespaceUUID = namespaceUUID.replace(/"/g, '');
                    resolve(namespaceUUID);
                });
            });
        }
        remoteTabTimeout(received) {
            return Date.now() - received <= this.settings.remoteTabTimeout;
        }
        startNodeInspect(host, nodePID) {
            let self = this;
            return new Promise((resolve) => {
                let args = { host: host, nodePID: nodePID };
                self.io.emit('inspect', args);
                self.io.on('inspect-response', (rargs) => {
                    if (args.host === rargs.hostname && args.nodePID == rargs.pid) {
                        console.log(rargs);
                        resolve(rargs);
                    }
                });
            });
        }
    }
    class Watchdog {
        constructor() {
            this.STOPPED = false;
            this.MAX_OPENED = 3;
            this.WINDOW = 3;
            this.openTabsOrWindows = 0;
            this.seconds = 0;
            this.failsafeSeconds = 0;
            this.secondsTimerInterval = this.start();
        }
        start() {
            let self = this;
            let secondsTimerInterval = setInterval(() => {
                if (DEVEL && $scope.settings.debugVerbosity >= 3) console.log(JSON.stringify(self));
                self.seconds++;
            }, 1000);
            setInterval(function failsafeTimer() {
                self.failsafeSeconds++;
            }, 1000);
            setInterval(function resetCounters() {
                self.openTabsOrWindows = 0;
                self.failsafeSeconds = 0;
            }, (self.WINDOW + 2) * 1000);
            return secondsTimerInterval;
        }
        stop() {
            clearInterval(this.secondsTimerInterval);
            this.STOPPED = true;
            $scope.settings.auto = false;
            // send user alert and disable auto mode.  Enable auto mode should reset this.
        }
        increment() {
            this.openTabsOrWindows++;
            if (this.openTabsOrWindows > this.MAX_OPENED && this.failsafeSeconds > this.WINDOW) this.stop();
        }
        reset() {
            this.STOPPED = false;
            this.secondsTimerInterval = this.start();
        }
    }
    class Timer {
        constructor(args) {
            let self = this;
            self.sessionID = args.sessionID;
            self.expired = false;
            self.elapsed = 0;
            self.timeout = $scope.settings.localSessionTimeout;
            self.timerID = setTimeout(() => { $scope.updateLocalSessions(self.sessionID) }, self.timeout);
            setInterval(() => {
                self.elapsed = self.elapsed + 1000;
                if (self.getRemainingTime() <= 0) self.expired = true;
            }, 1000);
        }
        clearTimer() {
            let self = this;
            clearInterval(self.timerID);
        }
        getRemainingTime() {
            let self = this;
            return self.timeout - self.elapsed;
        }
    }
    class Lock {
        constructor(instance) {
            this.host = instance.host
            this.port = instance.port
            this.tabStatus = 'loading'
            this.timeout = setTimeout(() => { this.tabStatus = '' }, 5000)
        }
    }
    const DEVEL = true;
    const CHROME_VERSION = /Chrome\/([0-9.]+)/.exec(navigator.userAgent)[1].split('.')[0];
    const VERSION = '0.0.0'; // Filled in by Grunt
    const UPTIME_CHECK_INTERVAL = 60 * 15; // 15 minutes 
    const INSTALL_URL = "https://blog.june07.com/nim-install/?utm_source=nim&utm_medium=chrome_extension&utm_campaign=extension_install&utm_content=1";
    const UNINSTALL_URL = "https://bit.ly/2vUcRNn";
    const JUNE07_ANALYTICS_URL = 'https://analytics.june07.com';
    const SHORTNER_SERVICE_URL = 'https://shortnr.june07.com/api';
    const MESSAGING_SERVICE_URL = 'https://messenger.june07.com/notifications/nim';
    const UPTIME_CHECK_RESOLUTION = 60000; // Check every minute
    const NOTIFICATION_CHECK_INTERVAL = DEVEL ? 60000 : 60 * 60000; // Check every hour
    const NOTIFICATION_PUSH_INTERVAL = DEVEL ? 60000 : 60 * 60000; // Push new notifications no more than 1 every hour if there is a queue.
    const NOTIFICATION_LIFETIME = DEVEL ? 3 * 60000 : 7 * 86400000;
    const DEVTOOLS_SCHEMES = [
        'chrome-devtools://',
        'devtools://'
    ];
    const SOCKET_PATTERN = /((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])):([0-9]+)/;
    const devToolsURL_Regex = /(devtools:\/\/|chrome-devtools:\/\/|https:\/\/chrome-devtools-frontend(.appspot.com|.june07.com)).*(inspector.html|js_app.html)/;

    $window.chrome.management.getSelf((ExtensionInfo) => {
        $scope.ExtensionInfo = ExtensionInfo;
    });
    getChromeIdentity()
    .then(() => {
        restoreNiMSConnectorObject()
        .catch((error) => {
            if (error === 400) {
                $scope.NiMSConnector = new NiMSConnector();
            }
        })
    });
    $scope.intervals = {
        uptime: null,
        checkInterval: null
    };
    $scope.fancytrees = {};
    $scope.NiMSVSCodeConnector = new NiMSVSCodeConnector();
    $scope.notificationService = new NotificationService();
    $scope.loaded = Date.now();
    $scope.timerUptime = 0;
    $scope.timerNotification = 0;
    $scope.VERSION = VERSION;
    $scope.settings = {
        DEVEL: DEVEL,
        host: "localhost",
        port: "9229",
        auto: true,
        checkInterval: 500,
        remoteProbeInterval: 10000,
        localSessionTimeout: DEVEL ? 7*24*60*60000 : 7*24*60*60000,
        debugVerbosity: 0,
        newWindow: false,
        autoClose: false,
        tabActive: true,
        windowFocused: true,
        localDevTools: true,
        notifications: {
            showMessage: true,
            lastHMAC: 0,
            enabled: true
        },
        chromeNotifications: true,
        autoIncrement: {type: 'port', name: 'Port'}, // both | host | port | false
        collaboration: false,
        panelWindowType: false,
        nimsVscode: {
            enabled: true
        },
        devToolsCompat: true,
        localDevToolsOptionsSelectedIndex: 0,
        windowStateMaximized: false,
        scheme: CHROME_VERSION > 75 ? DEVTOOLS_SCHEMES[1] : DEVTOOLS_SCHEMES[0],
        diagnosticReports: {
            enabled: true,
            maxMessages: 10
        },
        autoResumeInspectBrk: false
    };
    $scope.Auth = new Auth();
    $scope.pubsub = new PubSub();
    $scope.devToolsProtocolClient = new DevToolsProtocolClient();
    $scope.nodeReportMessages = [];
    $scope.localDevToolsOptions = [
        /* The url is set as a default to prevent a nasty case where an unset value results in an undefined which further results in runaway tabs opening.
        *  Decided to use the devtoolsFrontendUrlCompat url as currently it's the one that works more fully (see https://blog.june07.com/missing/)
        *  Todo: write a failsafe to prevent that condition too!
        */
        { 'id': '0', 'name': 'default', 'url': $scope.settings.scheme + 'devtools/bundled/inspector.html', 'selected': true }, 
        { 'id': '1', 'name': 'appspot', 'url': 'https://chrome-devtools-frontend.appspot.com/serve_file/@548c459fb7741b83bd517b12882f533b04a5513e/inspector.html' },
        { 'id': '2', 'name': 'june07', 'url': 'https://chrome-devtools-frontend.june07.com/front_end/inspector.html' },
        { 'id': '3', 'name': 'custom', 'url': '' },
    ];
    $scope.remoteTabs = [];
    $scope.localSessions = [];
    $scope.state = {
        popup: {
            selectedTab: undefined
        }
    }
    $scope.devToolsSessions = [];
    $scope.changeObject;
    $scope.userInfo;
    $scope.sessionlessTabs = [];
    $scope.locks = [];
    $scope.moment = $window.moment;
    $scope.getDevToolsOption = function() {
        return $scope.localDevToolsOptions.find((option) => {
            return option.selected;
        });
    };
    $scope.validateCustomDevToolsURL = function() {
        if ($scope.localDevToolsOptions[3].url === undefined)
            $scope.localDevToolsOptions[3].url = $scope.localDevToolsOptions[1].url;
        else if (!$scope.localDevToolsOptions[3].url.match(devToolsURL_Regex))
            $scope.localDevToolsOptions[3].url = $scope.localDevToolsOptions[1].url;
    }
    $scope.devtoolsPanelInstances = 0;

    let tabId_HostPort_LookupTable = [],
        backoffTable = [],
        promisesToUpdateTabsOrWindows = [],
        chrome = $window.chrome,
        SingletonHttpGet = httpGetTestSingleton(),
        SingletonOpenTabInProgress = openTabInProgressSingleton(),
        triggerTabUpdate = false,
        websocketIdLastLoaded = {},
        tabNotificationListeners = [],
        connections = {};
    $scope.tabId_HostPort_LookupTable = tabId_HostPort_LookupTable;
    $scope.watchdog = new Watchdog();
    window.nim = { watchdog: $scope.watchdog };

    restoreSettings()
    .then(updateInternalSettings) // This function is needed for settings that aren't yet configurable via the UI.  Otherwise the new unavailable setting will continue to be reset with whatever was saved vs the defaults.
    .then(function startInterval() {
        // $scope.settings.scheme = 'http://'; // This is for testing runaway tabs only.
        if ($scope.settings.debugVerbosity >= 1) console.log('Starting up.')
        resetInterval();
    });

    $scope.intervals.uptime = setInterval(function() {
        $scope.timerUptime++;
        if (($scope.timerUptime >= UPTIME_CHECK_INTERVAL && $scope.timerUptime % UPTIME_CHECK_INTERVAL === 0) || ($scope.timerUptime === 1)) {
            $window._gaq.push(['_trackEvent', 'Program Event', 'Uptime Check', $scope.moment.duration($scope.timerUptime, 'seconds').humanize(), $scope.timerUptime, true ],
            ['_trackEvent', 'Program Event', 'Version Check', VERSION + " " + $scope.userInfo, undefined, true]);
        }
    }, UPTIME_CHECK_RESOLUTION);

    $scope.updateLocalSessions = function(expired) {
        if (expired) return $scope.localSessions.splice($scope.localSessions.findIndex(session => session.id === expired.id), 1);
        
        let localSessions = $scope.devToolsSessions.filter(session => session.infoUrl.search(/\/\/pads.brakecode.com\/json\//) === -1);
        localSessions = localSessions.map((session) => {
            session.timer = new Timer({sessionID: session.id});
            return session;
        });
        //$scope.localSessions = localSessions.concat($scope.localSessions);
        $scope.localSessions = $scope.localSessions.concat(localSessions);
        localSessions = [];
        return $scope.localSessions = $scope.localSessions.filter((session, i) => {
            if (i === 0) {
                localSessions.push(session);
                return true;
            }
            let match = localSessions.find(s => s.infoUrl === session.infoUrl);
            if (match === undefined) {
                localSessions.push(session);
                return true;
            } else {
                session.timer.clearTimer();
                return false;
            }
        });
    }
    $scope.removeLocalSession = function(id) {
        let index = $scope.localSessions.findIndex(session => session.id == id)
        if (index != -1) $scope.localSessions.splice(index, 1)
        $scope.devToolsSessions.find((session, i) => {
            if (session.id !== null && session.id == id) {
                removeDevToolsSession(session, i)
            }
        })
        
    }
    $scope.localize = function($window, updateUI) {
        Array.from($window.document.getElementsByClassName("i18n")).forEach(function(element, i, elements) {
            var message;
            // Hack until I can figure out how to resize the overlay properly.
            if (chrome.i18n.getUILanguage() == "ja") element.style.fontSize = "small";
            switch (element.id) {
                case "open devtools": message = chrome.i18n.getMessage("openDevtools"); element.value = message; break;
                case "checkInterval-value": message = chrome.i18n.getMessage(element.dataset.badgeCaption); element.dataset.badgeCaption = message; break;
                default: message = chrome.i18n.getMessage(element.innerText.split(/\s/)[0]);
                    element.textContent = message; break;
            }
            if (i === (elements.length-1)) updateUI();
        });
    }
    $scope.save = function(key) {
        //
        write(key, $scope.settings[key]);
    }
    $scope.openTab = function(host, port, padsMetadata, callback) {
        if (typeof padsMetadata === 'function') {
            callback = padsMetadata;
            padsMetadata.wsProto = 'ws';
        }
        SingletonOpenTabInProgress.getInstance(host, port, null)
        .then(function(value) {
            if (value.message !== undefined) {
                return callback(value.message);
            } else {
                SingletonOpenTabInProgress.getInstance(host, port, 'lock')
                .then(function() {
                    var infoUrl = getInfoURL(host, port);
                    chrome.tabs.query({
                        url: [// 'chrome-devtools://*/*',
                            $scope.settings.scheme + '*/*localhost:' + port + '*',
                            $scope.settings.scheme + '*/*' + host + ':' + port + '*',
                            $scope.settings.scheme + '*/*' + host + '/ws/' + port + '*',

                            'https://chrome-devtools-frontend.june07.com/*localhost:' + port + '*',                                
                            'https://chrome-devtools-frontend.june07.com/*' + host + ':' + port + '*',
                            'https://chrome-devtools-frontend.june07.com/*' + host + '/ws/' + port + '*',

                            'https://chrome-devtools-frontend.appspot.com/*localhost:' + port + '*',
                            'https://chrome-devtools-frontend.appspot.com/*' + host + ':' + port + '*',
                            'https://chrome-devtools-frontend.appspot.com/*' + host + '/ws/' + port + '*'
                        ]
                    }, async function(tab) {
                        if ($http.pendingRequests.length !== 0) return
                        let token;
                        if (typeof padsMetadata !== 'function') {
                            if (!$scope.Auth.auth0) return callback(chrome.i18n.getMessage('brakecodeAuthRequired'));
                            token = await $scope.Auth.auth0.getTokenSilently();
                        }
                        //let httpHeaders = (typeof padsMetadata !== 'function') ? {'Authorization': 'Bearer ' + JSON.parse(localStorage.authResult).access_token} : undefined;
                        $http({
                                method: "GET",
                                url: infoUrl,
                                responseType: "json",
                                headers: { 'Authorization': 'Bearer ' + token },
                                timeout: $scope.settings.checkInterval * 3
                        })
                        .then(function openDevToolsFrontend(json) {
                            let url, jsonPayload;
                            if (!json || json.data == null) return callback(chrome.i18n.getMessage("errMsg9"));
                            jsonPayload = browserAgnosticFix(json.data[0]);
                            if (!jsonPayload.devtoolsFrontendUrl) return callback(chrome.i18n.getMessage("errMsg7", [host, port]));
                            setDevToolsURL(json.data[0]);
                            if (padsMetadata.wsProto === 'wss') {
                                url = jsonPayload.devtoolsFrontendUrl.replace(/wss?=(.*)\//, padsMetadata.wsProto + '=' + host + '/ws/' + port + '/');
                            } else {
                                url = jsonPayload.devtoolsFrontendUrl.replace(/wss?=localhost/, 'ws=127.0.0.1');
                                var inspectIP = url.match(SOCKET_PATTERN)[1];
                                var inspectPORT = url.match(SOCKET_PATTERN)[5];
                                url = url
                                    .replace(inspectIP + ":9229", host + ":" + port) // In the event that remote debugging is being used and the infoUrl port (by default 80) is not forwarded take a chance and pick the default.
                                    .replace(inspectIP + ":" + inspectPORT, host + ":" + port) // A check for just the port change must be made.
                            }
                            if ($scope.settings.localDevTools || $scope.settings.devToolsCompat) {
                                let devToolsOptionURL = $scope.getDevToolsOption().url;
                                if (devToolsOptionURL.match(devToolsURL_Regex)) url = url.replace(devToolsURL_Regex, devToolsOptionURL);
                            }
                            if ($scope.settings.bugfix)
                                url = url.replace('', '');
                            var websocketId = jsonPayload.id;
                            /** May be a good idea to put this somewhere further along the chain in case tab/window creation fails,
                            in which case this entry will need to be removed from the array */
                            // The following analytics setting is TOO verbose.
                            //$window._gaq.push(['_trackEvent', 'Program Event', 'openTab', 'Non-existing tab.', undefined, true]);
                            if (tab.length === 0) {
                                createTabOrWindow(infoUrl, url, websocketId, jsonPayload)
                                .then(function(tab) {
                                    var tabToUpdate = tab;
                                    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
                                        if (triggerTabUpdate && tabId === tabToUpdate.id && changeInfo.status === 'complete') {
                                            triggerTabUpdate = false;
                                            saveSession(url, infoUrl, websocketId, tabToUpdate.id, jsonPayload);
                                            callback(tabToUpdate.url);
                                        } else if (!triggerTabUpdate && tabId === tabToUpdate.id) {
                                            if ($scope.settings.debugVerbosity >= 6) console.log('Loading updated tab [' + tabId + ']...');
                                        }
                                    });
                                })
                                .then(callback);
                            } else {
                                // If the tab has focus then issue this... otherwise wait until it has focus (ie event listener for window event.  If another request comes in while waiting, just update the request with the new info but still wait if focus is not present.
                                var promiseToUpdateTabOrWindow = new Promise(function(resolve) {
                                    chrome.tabs.query({
                                        url: [// $scope.settings.scheme + */*',
                                            $scope.settings.scheme + '*/*localhost:' + port + '*',
                                            $scope.settings.scheme + '*/*' + host + ':' + port + '*',
                                            $scope.settings.scheme + '*/*' + host + '/ws/' + port + '*',

                                            'https://chrome-devtools-frontend.june07.com/*localhost:' + port + '*',                                
                                            'https://chrome-devtools-frontend.june07.com/*' + host + ':' + port + '*',
                                            'https://chrome-devtools-frontend.june07.com/*' + host + '/ws/' + port + '*',

                                            'https://chrome-devtools-frontend.appspot.com/*localhost:' + port + '*',
                                            'https://chrome-devtools-frontend.appspot.com/*' + host + ':' + port + '*',
                                            'https://chrome-devtools-frontend.appspot.com/*' + host + '/ws/' + port + '*'
                                        ]
                                    }, function callback(tab) {
                                        // Resolve otherwise let the event handler resolve
                                        tab = tab[0];
                                        if (tab && tab.active) {
                                            chrome.windows.get(tab.windowId, function(window) {
                                                if (window.focused) return resolve();
                                            });
                                        } else if ($scope.settings.windowFocused) {
                                            return resolve();
                                        }
                                        addPromiseToUpdateTabOrWindow(tab, promiseToUpdateTabOrWindow);
                                    });
                                })
                                .then(function() {
                                    updateTabOrWindow(infoUrl, url, websocketId, tab[0], callback);
                                });
                            }
                            //unlock(host, port);
                        })
                        .catch(function(error) {
                            if (error.status === -1) {
                                var message = chrome.i18n.getMessage("errMsg4"); // Connection to DevTools host was aborted.  Check your host and port.
                                callback({ statusText: message });
                            } else if (error.status === 404 && $scope.NiMSConnector && error.config.url.match($scope.NiMSConnector.PADS_HOST_REGEX)) {
                                callback({ statusText: 'chrome.i18n.getMessage("You must login to your Brakecode account.")' });
                            } else {
                                callback(error);
                            }
                        });
                    });
                });
            }
        });
    }
    $scope.$on('options-window-closed', function() {
        //
        saveAll();
    });
    $scope.$on('options-window-focusChanged', function() {
        // Only if an event happened
        saveAll();
    });
    $scope.tabNotification = function(instance) {
        let tabId = $scope.tabId_HostPort_LookupTable.find(r => r.host === instance.host && r.port == instance.port);
        if (tabId === undefined) return;
        tabId = tabId.id;
        
        // Currently not sure if chrome-devtools:// scheme can be injected into
        chrome.tabs.get(tabId, (tab) => {
            if (tab === undefined || $scope.settings.scheme === 0 ? tab.url.match(/chrome-devtools:\/\//) : tab.url.match(/devtools:\/\//)) {
                return
            } else {
                var nodeProgram = $scope.devToolsSessions.find(r => r.id == tabId);
                nodeProgram = (nodeProgram !== undefined) ? nodeProgram.nodeInspectMetadataJSON.title : 'NiM';
                let jsInject = `
                debugger
                window.nimTabNotification = (window.nimTabNotification === undefined) ? {} : window.nimTabNotification;
                function createLinkElement(type) {
                    let link = document.createElement('link')
                    link.type = 'image/x-icon';
                    link.rel = 'shortcut icon';
                    link.id = 'NiMFavicon';
                    if (type === 'nim') link.href = 'https://june07.github.io/image/icon/favicon16.ico';
                    else link.href = 'https://chrome-devtools-frontend.appspot.com/favicon.ico';
                    return link;
                }
                var original = { title: document.URL, link: createLinkElement() }
                var NiM = { title: '` + nodeProgram + `', link: createLinkElement('nim') }

                var icon, title;
                var interval = setInterval(function() {
                    icon = (icon === original.link) ? NiM.link : original.link;
                    title = (title === original.title) ? NiM.title : original.title;
                    document.title = title;
                    var favicon = document.getElementById('NiMFavicon');
                    if (favicon) document.getElementsByTagName('head')[0].removeChild(favicon);
                    document.getElementsByTagName('head')[0].appendChild(icon);
                }, 500);
                setTimeout(() => {
                    window.unBlink(` + tabId + `);
                }, 30000);
                window.unBlink = (tabId) => {
                    clearInterval(nimTabNotification[tabId].interval);
                    document.title = original.title;
                    document.getElementsByTagName('head')[0].appendChild(NiM.link);
                }
                window.nimTabNotification[` + tabId + `] = { interval };
                `;

                chrome.tabs.executeScript(tabId, { code: jsInject, allFrames: true }, () => {
                    tabNotificationListenerManager(tabId);
                    console.log('Blinking tab.');
                });
            }
        })
    }
    $scope.setDevToolsOption = function(optionIndex) {
        $scope.localDevToolsOptions.forEach((option, i) => {
            if (i === optionIndex) {
                option.selected = true;
                $scope.settings.localDevToolsOptionsSelectedIndex = optionIndex;
            } else {
                option.selected = false;
            }
        });
    }
    function setDevToolsURL(nodeJSONMeta) {
        $scope.localDevToolsOptions[0].url = ($scope.settings.devToolsCompat && nodeJSONMeta.devtoolsFrontendUrlCompat) ? nodeJSONMeta.devtoolsFrontendUrlCompat.split('?')[0] : nodeJSONMeta.devtoolsFrontendUrl.split('?')[0];
    }
    function getDevToolsURL(session) {
        let url = session.devtoolsFrontendUrl;
        // The following line is required because normally the host part of the URL is set dynamically in `function openDevToolsFrontend(json)`
        if ($scope.getDevToolsOption() === $scope.settings.scheme + 'devtools/bundled/inspector.html') $scope.localDevToolsOptions[0].url = url.split('?')[0]; 
        if ($scope.settings.localDevTools) url = url.replace(devToolsURL_Regex, $scope.getDevToolsOption().url);
        return url;
    }
    function tabNotificationListenerManager(tabId, action) {
        if (action === undefined) {
            tabNotificationListeners[tabId] = {
                ['fn' + tabId]: function(activeInfo) {
                    if (activeInfo.tabId === tabId) {
                        chrome.tabs.executeScript(tabId, { code: 'window.unBlink(' + tabId + ')' }, () => {
                            tabNotificationListenerManager(tabId, 'remove');
                            console.log('Stopped blinking tab.');
                        });
                    }
                }
            }
            chrome.tabs.onActivated.addListener(tabNotificationListeners[tabId]['fn' + tabId]);
        } else if (action === 'remove') {
            chrome.tabs.onActivated.removeListener(tabNotificationListeners[tabId]);
        }
    }
    function Backoff(instance, min, max) {
        return {
            max: max,
            min: min,
            delay: 0,
            checkCount: 0,
            checkCounts: [ 6, 12, 24, 48, 96, 192, 364, 728, 14056 ],
            instance: instance,
            increment: function() {
                if (this.checkCounts.indexOf(this.checkCount) !== -1) {
                    var nextDelay = this.delay + this.min;
                    if (this.max >= nextDelay) this.delay = nextDelay;
                } else if (this.checkCount > 14056) {
                    this.delay = this.max;
                }              
                this.checkCount++;
                return this;
            },
            reset: function() {
                this.delay = 0;
                this.checkCount = 0;
                return this;
            }
        }
    }
    function resetInterval(timeout) {
        if (timeout) {
            clearInterval(timeout);
        }
        $scope.intervals.checkInterval = setInterval(function() {
            if ($scope.settings.auto && ! isLocked(getInstance())) {
                if ($scope.settings.debugVerbosity >= 6) console.log('resetInterval going thru a check loop...')
                closeDevTools(
                $scope.openTab($scope.settings.host, $scope.settings.port, function(message) {
                    if ($scope.settings.debugVerbosity >= 3) console.log(message);
                }));
            } else if ($scope.settings.auto && isLocked(getInstance())) {
                /** If the isLocked(getInstance()) is set then we still have to check for disconnects on the client side via httpGetTest().
                until there exists an event for the DevTools websocket disconnect.  Currently there doesn't seem to be one
                that we can use simultanous to DevTools itself as only one connection to the protocol is allowed at a time.
                */
                SingletonHttpGet.getInstance({ host: $scope.settings.host, port: $scope.settings.port });
            }
            $scope.localSessions.filter(session => session.auto).forEach(function(localSession) {
                let instance = getInstanceFromInfoURL(localSession.infoUrl)
                if (instance.host === $scope.settings.host && instance.port == $scope.settings.port) return
                if (localSession.auto && ! isLocked(instance)) {
                    if ($scope.settings.debugVerbosity >= 6) console.log('resetInterval going thru a check loop...')
                    closeDevTools(
                        $scope.openTab(instance.host, instance.port, function(message) {
                            if ($scope.settings.debugVerbosity >= 3) console.log(message)
                        })
                    )
                } else if (localSession.auto && isLocked(instance)) {
                    /** If the isLocked(getInstance()) is set then we still have to check for disconnects on the client side via httpGetTest().
                    until there exists an event for the DevTools websocket disconnect.  Currently there doesn't seem to be one
                    that we can use simultaneous to DevTools itself as only one connection to the protocol is allowed at a time.
                    */
                    SingletonHttpGet.getInstance(instance);
                }
            })
            if (DEVEL && $scope.settings.debugVerbosity >= 3) console.dir(JSON.stringify($scope.intervals));
        }, $scope.settings.checkInterval);
    }
    function httpGetTestSingleton() {
        var promise;

        function closeDefunctDevTools(instance) {
            unlock(instance);
            closeDevTools(function() {
                var message = 'Closed defunct DevTools session.';
                if ($scope.settings.debugVerbosity >= 3) console.log(message);
            });
        }
        function createInstance(instance) {
            var host = instance.host,
                port = instance.port;

            if (promise !== undefined) {
                if ($scope.settings.debugVerbosity >= 6) console.log("httpGetTestSingleton promise not settled.");
            } else {
                promise = httpGetTest(host, port)
                .then(function(up) {
                    if ($scope.settings.debugVerbosity >= 7) console.log('Going thru a check loop [2nd]...')
                    var devToolsSession = $scope.devToolsSessions.find(function(session) {
                        if (session.infoUrl === getInfoURL($scope.settings.host, $scope.settings.port)) return true;
                    })
                    if (!up && (devToolsSession !== undefined)) {
                        closeDefunctDevTools(instance);
                    } else if (!up) {
                        if ($scope.settings.debugVerbosity >= 7) console.log('No DevTools instance detected.  Skipping [1st] check loop...')
                    } else if (up && (devToolsSession !== undefined)) {
                        getTabsCurrentSocketId(devToolsSession.infoUrl)
                        .then(function(socketId) {
                            if (devToolsSession.websocketId !== socketId) closeDefunctDevTools(instance);
                        });
                    } else if (up) {
                        unlock(instance);
                    }
                })
                .then(function(value) {
                    promise = value;
                })
                .catch(function(error) {
                    if ($scope.settings.debugVerbosity >= 6) console.log('ERROR: ' + error);
                });
                return promise;
            }
        }
        return {
            getInstance: function(instance) {
                return createInstance(instance);
            },
            isComplete: function() {
                if (promise === undefined) return true;
                return false; 
            },
            closeDefunctDevTools: closeDefunctDevTools
        }
    }
    function delay(milliseconds) {
        return $q(function(resolve) {
            var interval;
            if ($scope.settings.debugVerbosity) {
                interval = setInterval(function() {
                    if ($scope.settings.debugVerbosity >= 7) console.log('.');
                }, 200)
            }
            setTimeout(function() {
                if (interval !== undefined) clearInterval(interval);
                resolve();
            }, milliseconds);
        });
    }
    function getTabsCurrentSocketId(infoUrl) {
        return $http({
            method: "GET",
            url: infoUrl,
            responseType: "json"
        })
        .then(function openDevToolsFrontend(json) {
            return browserAgnosticFix(json.data[0]).id;
        })
        .catch(function(error) {
            return error;
        });
    }
    function closeDevTools(callback) {
        var devToolsSessions = $scope.devToolsSessions;
        devToolsSessions.forEach(function(devToolsSession, index) {
            if (devToolsSession.autoClose) {
                $http({
                        method: "GET",
                        url: devToolsSession.infoUrl,
                        responseType: "json"
                    })
                    .then(function(response) {
                        var activeDevToolsSessionWebsocketId = response.data[0].id;
                        if (devToolsSession.websocketId !== activeDevToolsSessionWebsocketId) {
                            removeDevToolsSession(devToolsSession, index);
                        }
                    })
                    .catch(function(error) {
                        if (error.status === -1) {
                            if ($scope.settings.debugVerbosity >= 9) console.log("ERROR [line 324]");
                            removeDevToolsSession(devToolsSession, index);
                        } else {
                            if ($scope.settings.debugVerbosity >= 9) console.log('<br>' + chrome.i18n.getMessage("errMsg3") + (devToolsSession.isWindow ? 'window' : 'tab') + error);
                        }
                    });
            }
            if (index >= devToolsSessions.length) {
                callback();
            }
        });
    }
    function getInfoURL(host, port, protocol) {
        if ($scope.NiMSConnector && host === $scope.NiMSConnector.PADS_HOST) return $scope.NiMSConnector.PADS_SERVER + '/json/' + port;
        if (protocol === undefined) protocol = 'http';
        return protocol + '://' + host + ':' + port + '/json';
    }
    function getInstanceFromInfoURL(infoURL) {
        infoURL = infoURL.replace(/https?:\/\//, '')
        let host = infoURL.split(':')[0],
            port = infoURL.split(':')[1].split('/')[0]
        return { host, port }
    }
    $scope.getInstanceFromInfoURL = getInstanceFromInfoURL
    function getInstance() {
        return { host: $scope.settings.host, port: $scope.settings.port }
    }
    function backoffDelay(instance, min, max) {
        var backoff = backoffTable.find(function(backoff, index, backoffTable) {
            if (sameInstance(instance, backoff.instance)) {
                backoffTable[index] = backoff.increment();
                return backoff;
            }
        });
        if (backoff === undefined) {
            backoff = Backoff(instance, min,  max);
            backoffTable.push(backoff);
        }
        return backoff.delay;
    }
    function backoffReset(instance) {
        backoffTable.find(function(backoff, index, backoffTable) {
            if (sameInstance(instance, backoff.instance)) {
                backoffTable[index] = backoff.reset();
            }
        });
    }
    function sameInstance(instance1, instance2) {
        if (instance1 === undefined || instance2 === undefined) return false;
        if ((instance1.host === instance2.host) && (instance1.port == instance2.port)) return true;
        return false; 
    }
    function httpGetTest(host, port) {
        return new Promise(function(resolve, reject) {
            $http({
              method: 'GET',
              url: getInfoURL(host, port)
            })
            .then(function successCallback() {
                    delay(backoffDelay({ host: host, port: port }, 500, 5000))
                    .then(function() {
                        return resolve(true);
                    });
                },
                function errorCallback(response) {
                    if ($scope.settings.debugVerbosity >= 6) console.log(response);
                    return resolve(false);
                }
            )
            .catch(function(error) {
                reject(error);
            });
        });
    }
    function openTabInProgressSingleton() {
        var promise = {};

        function createInstance(host, port, action) {
            if (promise[host] === undefined) promise[host] = {};
            if (Object.keys(promise[host]).find(key => key === host) === undefined) {
                promise[host][port] = openTabInProgress(host, port, action)
                .then(function(value) {
                    promise[host][port] = undefined;
                    return value;
                });
            }
            return promise[host][port];
        }
        return {
            getInstance: function(host, port, action) {
                return createInstance(host, port, action);
            }
        }
    }
    function openTabInProgress(host, port, action) {
        return new Promise(function(resolve) {
            var instance = { host: host, port: port };

            if (action !== null && action === 'lock') {
                //$scope.locks.push({ host: instance.host, port: instance.port, tabStatus: 'loading' });
                addLock(instance)
                resolve(true);
            } else if (isLocked(getInstance())) {
                // Test that the DevTools instance is still alive (ie that the debugee app didn't exit.)  If the app did exit, remove the check lock.
                //SingletonHttpGet2.getInstance(instance, callback);                    
                    httpGetTest(instance.host, instance.port)
                    .then(function(up) {
                        var locked = isLocked(instance) || false;
                        if (up && locked) {
                            resolve({ inprogress: true, message: 'Opening tab in progress...' });
                        } else if (!up && !isLocked(instance)) {
                            resolve({ inprogress: false, message: chrome.i18n.getMessage("errMsg7", [host, port]) });
                        } else {
                            unlock(instance);
                            resolve(false);
                        }
                    });
            } else {
                 resolve(false);
            }
        });
    }
    function addLock(instance) {
        if ($scope.locks.find(lock => lock.host === instance.host && lock.port == instance.port) === undefined)
        $scope.locks.push(new Lock(instance))
    }
    function isLocked(instance) {
        return $scope.locks.find(function(lock) {
            if (lock !== undefined) {
                if (lock.host === instance.host && parseInt(lock.port) === parseInt(instance.port)) {
                    if (lock.tabStatus === 'loading') return false
                    if (lock.tabStatus === '') {
                        unlock(instance)
                        return false
                    }
                    return true
                }
            }
        });
    }
    (function unlockStuckLocks() {
        setInterval(() => {
            $scope.locks.forEach((lock, i, locks) => {
                if (lock.tabStatus === '') {
                    locks.splice(i, 1)
                    if (DEVEL) console.log('Removed stuck lock.')
                }
            });
        }, 5000)
    })()
    function unlock(instance) {
        backoffReset(instance);
        if ($scope.locks !== undefined) {
            return $scope.locks.find(function(lock, index, locks) {
                if (lock !== undefined && instance !== undefined) {
                    if (lock.host === instance.host && parseInt(lock.port) === parseInt(instance.port)) {
                        locks.splice(index, 1);
                        return true;
                    }
                }
            });
        } else {
            return true;
        }
    }
    function removeDevToolsSession(devToolsSession, index) {
        $scope.devToolsProtocolClient.closeSocket(devToolsSession.dtpSocket);
        if (!devToolsSession.isWindow) {
            $window._gaq.push(['_trackEvent', 'Program Event', 'removeDevToolsSession', 'window', undefined, true]);
            chrome.tabs.remove(devToolsSession.id, function() {
                if (chrome.runtime.lastError) {
                    if (chrome.runtime.lastError.message.toLowerCase().includes("no window ")) {
                        deleteSession(devToolsSession.id);
                    }
                }
                $scope.devToolsSessions.splice(index, 1);
                if ($scope.settings.debugVerbosity >= 3) console.log(chrome.i18n.getMessage("errMsg2") + JSON.stringify(devToolsSession) + '.');
            });
        } else {
            $window._gaq.push(['_trackEvent', 'Program Event', 'removeDevToolsSession', 'tab', undefined, true]);
            chrome.windows.remove(devToolsSession.id, function() {
                if (chrome.runtime.lastError) {
                    if (chrome.runtime.lastError.message.toLowerCase().includes("no tab ")) {
                        deleteSession(devToolsSession.id);
                    }
                }
                $scope.devToolsSessions.splice(index, 1);
                if ($scope.settings.debugVerbosity >= 3) console.log(chrome.i18n.getMessage("errMsg6") + JSON.stringify(devToolsSession) + '.');
            });
        }
    }
    function updateTabOrWindow(infoUrl, url, websocketId, tab) {
        if (websocketId === websocketIdLastLoaded[infoUrl]) return;
        $window._gaq.push(['_trackEvent', 'Program Event', 'updateTab', 'focused', + $scope.settings.windowFocused, true]);
        chrome.tabs.update(tab.id, {
            url: url,
            active: $scope.settings.tabActive,
        }, function() {
            if (chrome.runtime.lastError) {
                // In the event a tab is closed between the last check and now, just delete the session and wait until the next check loop.
                if (chrome.runtime.lastError.message.toLowerCase().includes("no tab ")) {
                    return deleteSession(tab.id);
                }
            }
            updateSession(url, infoUrl, websocketId, tab.id);
            websocketIdLastLoaded[infoUrl] = websocketId;
            triggerTabUpdate = true;
        });
    }
    function createTabOrWindow(infoUrl, url, websocketId, nodeInspectMetadataJSON) {
        return new Promise(function(resolve) {
            let dtpSocketPromise = $scope.devToolsProtocolClient.setSocket(websocketId, nodeInspectMetadataJSON.webSocketDebuggerUrl, { autoResume: $scope.settings.autoResumeInspectBrk });
            if ($scope.settings.newWindow) {
                $window._gaq.push(['_trackEvent', 'Program Event', 'createWindow', 'focused', + $scope.settings.windowFocused, true]);
                chrome.windows.create({
                    url: url,
                    focused: $scope.settings.windowFocused,
                    type: ($scope.settings.panelWindowType) ? 'panel' : 'normal',
                    state: $scope.settings.windowStateMaximized ? chrome.windows.WindowState.MAXIMIZED : chrome.windows.WindowState.NORMAL
                }, function(window) {
                    $scope.watchdog.increment();
                    /* Is window.id going to cause id conflicts with tab.id?!  Should I be grabbing a tab.id here as well or instead of window.id? */
                    dtpSocketPromise
                    .then(dtpSocket => {
                        saveSession(url, infoUrl, websocketId, window.id, nodeInspectMetadataJSON, dtpSocket);
                        resolve(window);
                    });
                });
            } else {
                $window._gaq.push(['_trackEvent', 'Program Event', 'createTab', 'focused', + $scope.settings.tabActive, true]);
                chrome.tabs.create({
                    url: url,
                    active: $scope.settings.tabActive,
                }, function(tab) {
                    $scope.watchdog.increment();
                    dtpSocketPromise
                    .then(dtpSocket => {
                        saveSession(url, infoUrl, websocketId, tab.id, nodeInspectMetadataJSON, dtpSocket);
                        resolve(tab);
                    });
                });
            }
        });
    }
    function resolveTabPromise(tab) {
        var tabsPromise = promisesToUpdateTabsOrWindows.find(function(tabPromise) {
            if (tab.id === tabPromise.tab.id) return true;
        });
        if (tabsPromise !== undefined) tabsPromise.promise.resolve();
    }
    function addPromiseToUpdateTabOrWindow(tab, promise) {
        var found = promisesToUpdateTabsOrWindows.find(function(tabToUpdate, index, array) {
            if (tabToUpdate.tab.id === tab.id) {
                array[index] = { tab: tab, promise: promise };
                return true;
            }
        });
        if (found === undefined) promisesToUpdateTabsOrWindows.push({ tab: tab, promise: promise });
    }
    function deleteSession(id) {
        var existingIndex;
        var existingSession = $scope.devToolsSessions.find(function(session, index) {
            if (session.id === id) {
                existingIndex = index;
                return session;
            }
        });
        if (existingSession) {
            $scope.devToolsSessions.splice(existingIndex, 1);
            /* Do I need to remove a lock here if it exists?  I think so, see chrome.tabs.onRemoved.addListener(function chromeTabsRemovedEvent(tabId) { */
            unlock(hostPortHashmap(existingSession.id));
        }
    }
    function updateSession(url, infoUrl, websocketId, tabOrWindowId) {
        let existingSession = $scope.devToolsSessions.find(session => {
            if (session.infoUrl === infoUrl) {
                return session;
            }
        }),
            socketUrl = webSocketUrlFromUrl(url);

        if (existingSession) {
            existingSession.websocketId = websocketId;
            $scope.devToolsProtocolClient.updateSocket(websocketId, socketUrl, { autoResume: $scope.settings.autoResumeInspectBrk })
            .then(dtpSocket => {
                existingSession.dtpSocket = dtpSocket;
            });
        } else {
            /** A session will not exist if the tab is reused during a node restart */
            $scope.devToolsProtocolClient.setSocket(websocketId, socketUrl, { autoResume: $scope.settings.autoResumeInspectBrk })
            .then(dtpSocket => {
                $scope.devToolsSessions.push({
                    url: url,
                    auto: (tabOrWindowId === null) ? false : $scope.settings.auto,
                    autoClose: $scope.settings.autoClose,
                    isWindow: $scope.settings.newWindow,
                    infoUrl: infoUrl,
                    id: tabOrWindowId,
                    websocketId: websocketId,
                    dtpSocket
                });
            });
        }
    }
    function webSocketUrlFromUrl(socketUrl) {
        return socketUrl.match(/wss?=(.*)\/(.*)$/)[0].replace('=', '://');
    }
    function saveSession(url, infoUrl, websocketId, id, nodeInspectMetadataJSON, dtpSocket) {
        var existingIndex;
        var existingSession = $scope.devToolsSessions.find(function(session, index) {
            if (session.websocketId === websocketId) {
                existingIndex = index;
                return session;
            }
        });
        if (existingSession) {
            $scope.devToolsSessions.splice(existingIndex, 1, {
                url: url,
                auto: (existingSession.auto) ? existingSession.auto : $scope.settings.auto,
                autoClose: $scope.settings.autoClose,
                isWindow: $scope.settings.newWindow,
                infoUrl: infoUrl,
                id: id,
                websocketId: websocketId,
                nodeInspectMetadataJSON: nodeInspectMetadataJSON,
                dtpSocket: dtpSocket ? dtpSocket : existingSession.dtpSocket
            });
        } else {
            $scope.devToolsSessions.push({
                url: url,
                auto: (id === null) ? false : $scope.settings.auto,
                autoClose: $scope.settings.autoClose,
                isWindow: $scope.settings.newWindow,
                infoUrl: infoUrl,
                id: id,
                websocketId: websocketId,
                nodeInspectMetadataJSON: nodeInspectMetadataJSON,
                dtpSocket
            });
        }
        hostPortHashmap(id, infoUrl);
    }
    /**function getSession(instance) {
        return $scope.devToolsSessions.find(function(session) {
            var instance2 = hostPortHashmap(session.id);
            if (sameInstance(instance, instance2)) return session;
        });
    }*/
    function hostPortHashmap(id, infoUrl) {
        let padsHost = $scope.NiMSConnector ? $scope.NiMSConnector.PADS_HOST : undefined;

        if (infoUrl === undefined) {
            // Lookup a value
            return tabId_HostPort_LookupTable.find(function(item) {
                return (item.id === id);
            })
        } else {
            // Set a value
            // infoUrl = 'http://' + $scope.settings.host + ':' + $scope.settings.port + '/json',
            var host = infoUrl.split(/https?:\/\//)[1].split('/json')[0],
                port = parseInt(infoUrl.split(/https?:\/\//)[1].split('/json')[0].split(':')[1]);
            if (host !== padsHost) host = host.split(':')[0];
            if (host === padsHost) port = parseInt(infoUrl.split('/json/')[1]);
            var index = tabId_HostPort_LookupTable.findIndex(function(item) {
                return (item.host === host && item.port === port);
            });
            if (index !== -1) tabId_HostPort_LookupTable[index] = { host, port, id };
            else tabId_HostPort_LookupTable.push({ host, port, id });
        }
    }
    function write(key, obj) {
        chrome.storage.sync.set({
            [key]: obj
        }, function() {
            if ($scope.settings.debugVerbosity >= 4) console.log("saved key: [" + JSON.stringify(key) + "] obj: [" + obj + ']');
        });
    }
    function restoreSettings() {
        return new Promise(resolve => {
            if ($scope.settings.debugVerbosity >= 1) console.log('Restoring saved settings.');
            chrome.storage.sync.get(function(sync) {
                var keys = Object.keys(sync);
                keys.forEach(function(key, i, keys) {
                    $scope.settings[key] = sync[key];
                    if (i === keys.length-1) {
                        $scope.setDevToolsOption($scope.settings.localDevToolsOptionsSelectedIndex);
                        resolve();
                    }
                });
            });
        });
    }
    function updateInternalSettings() {
        if (DEVEL) {
            $scope.settings.localSessionTimeout = 7*24*60*60000
        }
        return Promise.resolve();
    }
    function restoreNiMSConnectorObject() {
        return new Promise((resolve, reject) => {
            $window.chrome.storage.sync.get(function(sync) {
                if (sync['NiMSConnector'] === undefined) return reject(400);
                Object.assign($scope.NiMSConnector, sync['NiMSConnector']);
                resolve();
            });
        });
    }
    function updateSettings() {
    }
    function saveAll() {
        resetInterval($scope.intervals.checkInterval);
        saveAllToChromeStorage($scope.settings, 'settings');
        Object.values(connections).map(c => c.postMessage({ event: 'options-updated' }));
    }
    function saveAllToChromeStorage(saveme_object, saveme_name) {
        var keys = Object.keys(saveme_object);

        switch (saveme_name) {
            case 'settings': {
                keys.forEach(function(key) {
                    if (!$scope.changeObject || !$scope.changeObject[key] || ($scope.settings[key] !== $scope.changeObject[key].newValue)) {
                        write(key, $scope.settings[key]);
                    }
                });
                setUninstallURL(); break;
            }
        }
    }
    function tinySettingsJSON(callback) {
        let tinySettings = {};
        Object.assign(tinySettings, $scope.settings);
        Object.entries(tinySettings).forEach((entry, index, tinySettings) => {
            if (entry[1] === true) entry[1] = 't';
            if (entry[1] === false) entry[1] = 'f';

            switch(entry[0]) {
                case 'host': entry[0] = 'h'; break;
                case 'port': entry[0] = 'p'; break;
                case 'checkInterval': entry[0] = 'ci'; break;
                case 'debugVerbosity': entry[0] = 'dv'; break;
                case 'newWindow': entry[0] = 'nw'; break;
                case 'autoClose': entry[0] = 'ac'; break;
                case 'tabActive': entry[0] = 'ta'; break;
                case 'windowFocused': entry[0] = 'wf'; break;
                case 'localDevTools': entry[0] = 'ldt'; break;
                case 'notifications': entry[0] = 'n'; break;
                case 'showMessage': entry[0] = 'sm'; break;
                case 'lastHMAC': entry[0] = 'lh'; break;
                case 'chromeNotifications': entry[0] = 'cn'; break;
                case 'autoIncrement': entry[0] = 'ai'; break;
                case 'collaboration': entry[0] = 'c'; break;
                case 'loginRefreshInterval': entry[0] = 'lri'; break;
                case 'tokenRefreshInterval': entry[0] = 'tri'; break;
                case 'remoteProbeInterval': entry[0] = 'r'; break;
                case 'localSessionTimeout': entry[0] = 'l'; break;
                case 'panelWindowType': entry[0] = 'pa'; break;
                case 'nimsVscode': entry[0] = 'n'; break;
                case 'devToolsCompat': entry[0] = 'd'; break;
                case 'localDevToolsOptionsSelectedIndex': entry[0] = 'ld'; break;
                case 'windowStateMaximized': entry[0] = 'w'; break;
            }
            if (index === tinySettings.length-1) {
                tinySettings.splice(tinySettings.findIndex(e => e[0] === 'DEVEL'), 1);
                callback(JSON.stringify(tinySettings));
            }
        });
    }
    function formatParams() {
        return new Promise((resolve) => {
            tinySettingsJSON((tinyJSON) => {
                resolve('s=' + tinyJSON + '&ui=' + encodeURIComponent($scope.userInfo));
            });
        });
    }
    function generateUninstallURL() {
        return new Promise((resolve) => {
            formatParams()
            .then((params) => {
                // This function is needed per chrome.runtime.setUninstallURL limitation: Sets the URL to be visited upon uninstallation. This may be used to clean up server-side data, do analytics, and implement surveys. Maximum 255 characters.
                return generateShortLink(JUNE07_ANALYTICS_URL + '/uninstall?app=nim&redirect=' + btoa(UNINSTALL_URL) + '&a=' + btoa(params))
            })
            .then((shortURL) => {
                resolve(shortURL);
                //return UNINSTALL_URL + encodeURIComponent('app=nim&a=' + btoa(params));
            });
        });
    }
    function generateShortLink(longURL) {
        return new Promise((resolve) => {
            let xhr = new XMLHttpRequest();
            let json = JSON.stringify({
              "url": longURL
            });
            xhr.responseType = 'text';
            xhr.open("POST", SHORTNER_SERVICE_URL);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.onload = function () {
                let returnTEXT = xhr.response;
                if (xhr.readyState == 4 && xhr.status == 200 || xhr.status == 201) {
                    resolve(returnTEXT);
                } else {
                    console.log('ERROR: ' + JSON.stringify(returnTEXT));
                    resolve(UNINSTALL_URL);
                }
            }
            xhr.send(json);
        });
    }
    function setUninstallURL() {
        getChromeIdentity()
        .then(() => { return generateUninstallURL() })
        .then((url) => {
            $scope.uninstallURL = url;
            chrome.runtime.setUninstallURL(url, function() {
                if (chrome.runtime.lastError) {
                    if ($scope.settings.debugVerbosity >= 5) console.log(chrome.i18n.getMessage("errMsg1") + UNINSTALL_URL);
                }
            });
        });
    }
    setUninstallURL();
    function analytics(properties) {
        let xhr = new XMLHttpRequest();
        let json = JSON.stringify({
            'source': 'nim',
            'userInfo': $scope.userInfo,
            'onInstalledReason': properties.onInstalledReason
        });
        let path = (properties.event === 'install') ? '/install' : '/';
        xhr.responseType = 'json';
        xhr.open("POST", JUNE07_ANALYTICS_URL + path);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onload = function () {
            let returnJSON = xhr.response;
            if (xhr.readyState == 4 && xhr.status == "200") {
                console.log('data returned:', returnJSON);
            }
        }
        xhr.send(json);
    }
    function getChromeIdentity() {
        return new Promise((resolve) => {
            $window.chrome.identity.getProfileUserInfo(function(userInfo) {
                $scope.userInfo = encryptMessage(userInfo)
                resolve(userInfo)
            });
        });
    }
    function encryptMessage(message, publicKeyBase64Encoded) {
        let clientPrivateKey = nacl.randomBytes(32),
            publicKey = (publicKeyBase64Encoded !== undefined) ? nacl.util.decodeBase64(publicKeyBase64Encoded) : nacl.util.decodeBase64('cXFjuDdYNvsedzMWf1vSXbymQ7EgG8c40j/Nfj3a2VU='),
            nonce = crypto.getRandomValues(new Uint8Array(24)),
            keyPair = nacl.box.keyPair.fromSecretKey(clientPrivateKey);
        message = nacl.util.decodeUTF8(JSON.stringify(message));
        let encryptedMessage = nacl.box(message, nonce, publicKey, keyPair.secretKey);
        return nacl.util.encodeBase64(nonce) + ' ' + nacl.util.encodeBase64(keyPair.publicKey) + ' ' + nacl.util.encodeBase64(encryptedMessage);
    }
    function isATwitterFollower() {
        return false;
    }
    function pushNotification(notification) {
        let title = notification.type === 'twitter' ? '@june07t Tweeted' : 'NiM Notification',
            button1 = notification.type === 'twitter' ? (isATwitterFollower() ? 'Like' : 'Follow') : '';
        chrome.notifications.create({
            type: 'basic',
            iconUrl:  'icon/icon128.png',
            title: title,
            message: notification.text,
            buttons: [ { title: button1, iconUrl: 'icon/twitter.svg' }, { title: 'Retweet' } ]
        },  function(notificationId) {
            $window._gaq.push(['_trackEvent', 'Notification Event', 'notification_created', notification.type, undefined, true]);
            notification.chromiumNotificationId = notificationId;
            notification.twitterButtonText = { button1 }
            if ($scope.settings.debugVerbosity >= 4) console.log(notificationId);
        });
    }
    function browserAgnosticFix(jsonPayload) {
        if (jsonPayload && jsonPayload.devtoolsFrontendUrlCompat) jsonPayload.devtoolsFrontendUrl = jsonPayload.devtoolsFrontendUrl.replace(/chrome-devtools:\/\//, 'devtools://');
        if (jsonPayload && jsonPayload.devtoolsFrontendUrlCompat) jsonPayload.devtoolsFrontendUrlCompat = jsonPayload.devtoolsFrontendUrlCompat.replace(/chrome-devtools:\/\//, 'devtools://');
        return jsonPayload;
    }
    chrome.notifications.onClicked.addListener(function onClickedHandler(notificationId) {
        let notification = $scope.notificationService.getNotification(notificationId);
        switch (notification.type) {
            case 'twitter':
                $window._gaq.push(['_trackEvent', 'Social Event', 'Link Click', 'https://twitter.com/june07t/status/' + notification.id, undefined, true]);
                chrome.tabs.create({ url: 'https://twitter.com/june07t/status/' + notification.id }); break;
        }
    });
    chrome.notifications.onButtonClicked.addListener(function chromeNotificationButtonClicked(notificationId, buttonIndex) {
        let notification = $scope.notificationService.getNotification(notificationId);
        switch (notification.type) {
            case 'nim':
                if (buttonIndex === 0) {
                    $scope.settings.chromeNotifications = false;
                    $scope.save('chromeNotifications');
                } else if (buttonIndex === 1) {
                    chrome.tabs.create({ url: 'chrome://extensions/configureCommands' });
                } break;
            case 'twitter':
                if (buttonIndex === 0) {
                    if (notification.twitterButtonText.button1 === 'Like') {
                        $window._gaq.push(['_trackEvent', 'Social Event', 'Button Click', 'https://twitter.com/intent/like?tweet_id=' + notification.id, undefined, true]);
                        chrome.tabs.create({ url: 'https://twitter.com/intent/like?tweet_id=' + notification.id, active: true });
                    } else {
                        $window._gaq.push(['_trackEvent', 'Social Event', 'Button Click', 'https://twitter.com/intent/follow?screen_name=june07t', undefined, true]);
                        chrome.tabs.create({ url: 'https://twitter.com/intent/follow?screen_name=june07t', active: true });
                    }
                    break;
                } else if (buttonIndex === 1) {
                    $window._gaq.push(['_trackEvent', 'Social Event', 'Button Click', 'https://twitter.com/intent/retweet?tweet_id=' + notification.id, undefined, true]);
                    chrome.tabs.create({ url: 'https://twitter.com/intent/retweet?tweet_id=' + notification.id, active: true }); break;
                } break;
        }
    });
    chrome.runtime.onInstalled.addListener($scope.notificationService.loadNotifications);
    chrome.runtime.onInstalled.addListener(function installed(details) {
        if (details.reason === 'install') {
            chrome.tabs.create({ url: INSTALL_URL});
        }
        analytics({ event: 'install', 'onInstalledReason': details.reason });
        if (details.reason === 'update') {
            updateSettings();
        }
    });
    chrome.runtime.onConnect.addListener(function portListener(port) {
        let extensionListener = function (message/*, sender, sendResponse*/) {
            if (message.name == "init") {
                connections[message.tabId + '_' + port.name] = port;
                return;
            } else if (message.name == 'hidden') {
                //port.onMessage.removeListener(extensionListener);
            } else if (message.name == 'shown') {
                //port.onMessage.addListener(extensionListener);
            }
        }
        port.onMessage.addListener(extensionListener);
        port.onDisconnect.addListener(function(port) {
            port.onMessage.removeListener(extensionListener);
            let tabs = Object.keys(connections);
            for (let i = 0; i < tabs.length; i++) {
                if (connections[tabs[i]] == port) {
                    delete connections[tabs[i]]
                    break;
                }
            }
        });
    });
    chrome.storage.sync.get("host", function(obj) {
        $scope.settings.host = obj.host || "localhost";
    });
    chrome.storage.sync.get("port", function(obj) {
        $scope.settings.port = obj.port || 9229;
    });
    chrome.storage.onChanged.addListener(function chromeStorageChangedEvent(changes, namespace) {
        $scope.changeObject = changes;
        var key;
        for (key in changes) {
            if (key === 'autoClose') SingletonHttpGet.closeDefunctDevTools({ host: $scope.settings.host, port: $scope.settings.port });
            var storageChange = changes[key];
            if ($scope.settings.debugVerbosity >= 4) console.log(chrome.i18n.getMessage("errMsg5", [key, namespace, storageChange.oldValue, storageChange.newValue]));
        }
    });
    chrome.tabs.onRemoved.addListener(function chromeTabsRemovedEvent(tabId) {
        $window._gaq.push(['_trackEvent', 'Program Event', 'onRemoved', undefined, undefined, true]);
        // Why am I not calling deleteSession() here?
        $scope.devToolsSessions.splice($scope.devToolsSessions.findIndex(function(devToolsSession) {
            if (devToolsSession.id === tabId) {
                $scope.devToolsProtocolClient.closeSocket(devToolsSession.dtpSocket);
                unlock(hostPortHashmap(tabId));
                return true;
            }
        }), 1);
    });
    chrome.tabs.onActivated.addListener(function chromeTabsActivatedEvent(tabId) {
        resolveTabPromise(tabId);
    });
    chrome.commands.onCommand.addListener(function chromeCommandsCommandEvent(command) {
        switch (command) {
            case "open-devtools":
                $scope.save("host");
                $scope.save("port");
                $scope.openTab($scope.settings.host, $scope.settings.port, function (result) {
                    if ($scope.settings.debugVerbosity >= 3) console.log(result);
                });
                if ($scope.settings.chromeNotifications) {
                    chrome.commands.getAll(function(commands) {
                        var shortcut = commands[1];

                        chrome.notifications.create('', {
                            type: 'basic',
                            iconUrl:  'icon/icon128.png',
                            title: 'NiM owns the (' + shortcut.shortcut + ') shortcut.',
                            message: '"' + shortcut.description + '"',
                            buttons: [ { title: 'Disable this notice.' }, { title: 'Change the shortcut.' } ]
                        },  function(notificationId) {
                            $scope.notificationService.addNotification({ chromiumNotificationId: notificationId, type: 'nim' });
                            if ($scope.settings.debugVerbosity >= 4) console.log(notificationId);
                        });
                    });
                }
                $window._gaq.push(['_trackEvent', 'User Event', 'OpenDevTools', 'Keyboard Shortcut Used', undefined, true]);
            break;
        }
    });
}]);

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
var ngApp = angular.module('NimBackgroundApp', []);
ngApp
    .run(function () {})
    .controller('nimController', ['$scope', '$window', '$http', function ($scope, $window, $http) {
        const UPTIME_CHECK_INTERVAL = 1000 * 60 * 15; // 15 minutes
        $scope.loaded = Date.now();
        $scope.timer = 0;
        $scope.auto = false;
        $scope.timerInterval = 1000;
        $scope.checkInterval = 5;
        $scope.checkIntervalTimeout = null;
        $scope.debug = false;
        $scope.newWindow = false;
        $scope.autoClose = true;
        $scope.tabActive = false;
        $scope.windowFocused = false;
        $scope.devToolsSessions = [];

        var chrome = $window.chrome;
        $scope.moment = $window.moment;

        setInterval(function () {
            $scope.timer++;
            if ($scope.timer >= UPTIME_CHECK_INTERVAL && $scope.timer%UPTIME_CHECK_INTERVAL === 0) {
                $window._gaq.push(['_trackEvent', $scope.moment.duration($scope.timer, 'seconds').humanize(), 'Uptime Checked']);
            }
        }, $scope.timerInterval);

        $scope.$on('options-window-closed', function () {
            resetInterval($scope.checkIntervalTimeout);
        });

        function resetInterval(timeout) {
            if (timeout) {
                clearInterval(timeout);
            }
            $scope.checkIntervalTimeout = setInterval(function () {
                if ($scope.auto) {
                    $scope.closeDevTools();
                    $scope.openTab($scope.host, $scope.port, function (result) {
                        $scope.message = result;
                    });
                }
            }, $scope.checkInterval * 1000);
        }
        resetInterval();

        $scope.closeDevTools = function () {
            $scope.devToolsSessions.forEach(function (devToolsSession, index) {
                if (devToolsSession.autoClose) {
                    $http({
                            method: "GET",
                            url: devToolsSession.infoUrl,
                            responseType: "json"
                        })
                        .catch(function (error) {
                            if (error.status === -1) {
                                if (!devToolsSession.isWindow) {
                                    chrome.tabs.remove(devToolsSession.id, function () {
                                        $scope.devToolsSessions.splice(index, 1);
                                        $scope.message += '<br>Closed tab for DevTools session: ' + JSON.stringify(devToolsSession) + '.';
                                    });
                                } else {
                                    chrome.windows.remove(devToolsSession.id, function () {
                                        $scope.devToolsSessions.splice(index, 1);
                                        $scope.message += '<br>Closed window for DevTools session: ' + JSON.stringify(devToolsSession) + '.';
                                    });
                                }
                            } else {
                                $scope.message += '<br>Error while trying to auto close ' + (devToolsSession.isWindow ? 'window' : 'tab') + error;
                            }
                        });
                }
            });
        };
        $scope.openTab = function (host, port, callback) {
            var infoUrl = 'http://' + $scope.host + ':' + $scope.port + '/json';
            chrome.tabs.query({
                url: 'https://chrome-devtools-frontend.appspot.com/*' + host + ':' + port + '*'
            }, function (tab) {
                if (tab.length === 0) {
                    $http({
                            method: "GET",
                            url: infoUrl,
                            responseType: "json"
                        })
                        .then(function openDevToolsFrontend(json) {
                            var url = json.data[0].devtoolsFrontendUrl.replace("localhost:9229", host + ":" + port);
                            /** May be a good idea to put this somewhere further along the chain in case tab/window creation fails,
                            in which case this entry will need to be removed from the array */
                            createTabOrWindow(infoUrl, url, callback);
                        })
                        .catch(function (error) {
                            if (error.status === -1) {
                                var message =
                                    'Connection to DevTools host was aborted.  Check your host and port.';
                                callback(message);
                            } else {
                                callback(error);
                            }
                        });
                } else {
                    callback("DevTools is already open.");
                }
            });
        };

        function createTabOrWindow(infoUrl, url, callback) {
            if ($scope.newWindow) {
                chrome.windows.create({
                    url: url,
                    focused: $scope.windowFocused,
                }, function (window) {
                    saveSession(infoUrl, window.id);
                    callback(window.url);
                });
            } else {
                chrome.tabs.create({
                    url: url,
                    active: $scope.tabActive,
                }, function (tab) {
                    saveSession(infoUrl, tab.id);
                    callback(tab.url);
                });
            }
        }

        function saveSession(infoUrl, id) {
            $scope.devToolsSessions.push({
                autoClose: $scope.autoClose,
                isWindow: $scope.newWindow,
                infoUrl: infoUrl,
                id: id
            });
        }
        $scope.save = function (key, obj) {
            switch (key) {
            case "host":
                chrome.storage.sync.set({
                    host: obj
                }, function () {
                    if ($scope.debug) {
                        console.log("saved host: " + obj);
                    }
                });
                break;
            case "port":
                chrome.storage.sync.set({
                    port: obj
                }, function () {
                    if ($scope.debug) {
                        console.log("saved port: " + obj);
                    }
                });
                break;
            }
        };
        $scope.s = function (key) {
            $scope.save(key, $scope[key]);
        };
        chrome.storage.sync.get("host", function (obj) {
            $scope.host = obj.host || "localhost";
            $scope.$apply();
        });
        chrome.storage.sync.get("port", function (obj) {
            $scope.port = obj.port || 9229;
            $scope.$apply();
        });
  }]);

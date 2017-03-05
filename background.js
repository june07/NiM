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
    .run(function() {})
    .controller('nimController', ['$scope', '$window', '$http', function($scope, $window, $http) {
        const VERSION = ''; // Filled in by Grunt
        const UPTIME_CHECK_INTERVAL = 60 * 15; // 15 minutes
        const UNINSTALL_URL = "http://june07.com/uninstall";
        const UPTIME_CHECK_RESOLUTION = 1000; // Check every second
        /**const NOTIFICATION_CHECK_INTERVAL = 6;// 60; // 60 minutes
        const NOTIFICATION_CHECK_RESOLUTION = 1000; // * 60; // Check every minute
        const HOOKIO_SECRET = "84d6d1fe-af32-4790-884d-04e047adf626";
        const NOTIFICATION_FILE = 'c7bcacbc-2c93-4054-be7d-2541b2a5223e';*/

        $scope.loaded = Date.now();
        $scope.timerUptime= 0;
        $scope.timerNotification = 0;
        $scope.settings = {
            host: "localhost",
            port: "9229",
            auto: false,
            checkInterval: 3,
            checkIntervalTimeout: null,
            debug: false,
            newWindow: false,
            autoClose: false,
            tabActive: true,
            windowFocused: true,
            localDevTools: false,
            notifications: {
                showMessage: false,
                lastHMAC: 0
            },
            autoIncrement: {type: 'port', name: 'Port'} // both | host | port | false
        };
        $scope.notifications;
        $scope.devToolsSessions = [];
        $scope.changeObject;
        $scope.userInfo;
        $scope.sessionlessTabs = [];

        var chrome = $window.chrome;
        chrome.runtime.setUninstallURL(UNINSTALL_URL, function() {
            if (chrome.runtime.lastError && $scope.settings.debug) {
                $scope.message += '<br>' + chrome.i18n.getMessage("errMsg1") + UNINSTALL_URL;
            }
        });
        chrome.identity.getProfileUserInfo(function(userInfo) {
            $scope.userInfo = userInfo;
        });
        $scope.moment = $window.moment;
        
        setInterval(function() {
            $scope.timerUptime++;
            if (($scope.timerUptime >= UPTIME_CHECK_INTERVAL && $scope.timerUptime % UPTIME_CHECK_INTERVAL === 0) || ($scope.timerUptime === 1)) {
                $window._gaq.push(['_trackEvent', 'Program Event', 'Uptime Check', $scope.moment.duration($scope.timerUptime, 'seconds').humanize(), undefined, true ],
                ['_trackEvent', 'Program Event', 'Version Check', VERSION + " " + $scope.userInfo.email + " " + $scope.userInfo.id, undefined, true]);
            }
        }, UPTIME_CHECK_RESOLUTION);

        $scope.$on('options-window-closed', function() {
            resetInterval($scope.settings.checkIntervalTimeout);
        });
        $scope.$on('options-window-focusChanged', function() {
            // Only if an event happened
            $scope.saveAll();
        });

        function resetInterval(timeout) {
            if (timeout) {
                clearInterval(timeout);
            }
            $scope.checkIntervalTimeout = setInterval(function() {
                if ($scope.settings.auto) {
                    $scope.closeDevTools(
                    $scope.openTab($scope.settings.host, $scope.settings.port, function() {
                        //$scope.message += '<br>' + result;
                    }));
                }
            }, $scope.settings.checkInterval * 1000);
        }
        resetInterval();

        $scope.closeDevTools = function(callback) {
            $scope.devToolsSessions.forEach(function(devToolsSession, index) {
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
                                removeDevToolsSession(devToolsSession, index);
                            } else {
                                $scope.message += '<br>' + chrome.i18n.getMessage("errMsg3") + (devToolsSession.isWindow ? 'window' : 'tab') + error;
                            }
                        });
                }
                if (index >= $scope.devToolsSessions.length) {
                    callback();
                }
            });
        };
        $scope.openTab = function(host, port, callback) {
            var infoUrl = 'http://' + $scope.settings.host + ':' + $scope.settings.port + '/json';
            chrome.tabs.query({
                    url: [ 'chrome-devtools://*/*',
                        'https://chrome-devtools-frontend.appspot.com/*' + host + ':' + port + '*' ]
            }, function(tab) {
                $http({
                        method: "GET",
                        url: infoUrl,
                        responseType: "json"
                    })
                    .then(function openDevToolsFrontend(json) {
                        if (!json.data[0].devtoolsFrontendUrl) return callback(chrome.i18n.getMessage("errMsg7", [host, port]));
                        var url = json.data[0].devtoolsFrontendUrl
                        .replace("127.0.0.1:9229", host + ":" + port)
                            .replace("localhost:9229", host + ":" + port)
                            .replace("127.0.0.1:" + port, host + ":" + port) // In the event that remote debugging is being used and the infoUrl port (by default 80) is not forwarded.
                            .replace("localhost:" + port, host + ":" + port)  // A check for just the port change must be made.
                        if ($scope.settings.localDevTools)
                            url = url.replace('https://chrome-devtools-frontend.appspot.com', 'chrome-devtools://devtools/remote');
                        var websocketId = json.data[0].id;
                        /** May be a good idea to put this somewhere further along the chain in case tab/window creation fails,
                        in which case this entry will need to be removed from the array */
                        $window._gaq.push(['_trackEvent', 'Program Event', 'openTab', 'Non-existing tab.', undefined, true]);
                        if (tab.length === 0) {
                            createTabOrWindow(infoUrl, url, websocketId, callback);
                        } else {
                            updateTabOrWindow(infoUrl, url, websocketId, tab, callback);
                        }
                    })
                    .catch(function(error) {
                        if (error.status === -1) {
                            var message =
                                chrome.i18n.getMessage("errMsg4");
                            callback(message);
                        } else if (error.message === "look for error message when nothing is listening at host:port") {
                            callback(chrome.i18n.getMessage("errMsg5"));
                        } else {
                            callback(error);
                        }
                    });
            });
        };

        function removeDevToolsSession(devToolsSession, index) {
            if (!devToolsSession.isWindow) {
                $window._gaq.push(['_trackEvent', 'Program Event', 'removeDevToolsSession', 'window', undefined, true]);
                chrome.tabs.remove(devToolsSession.id, function() {
                    $scope.devToolsSessions.splice(index, 1);
                    $scope.message += '<br>' + chrome.i18n.getMessage("errMsg2") + JSON.stringify(devToolsSession) + '.';
                });
            } else {
                $window._gaq.push(['_trackEvent', 'Program Event', 'removeDevToolsSession', 'tab', undefined, true]);
                chrome.windows.remove(devToolsSession.id, function() {
                    $scope.devToolsSessions.splice(index, 1);
                    $scope.message += '<br>' + chrome.i18n.getMessage("errMsg6") + JSON.stringify(devToolsSession) + '.';
                });
            }
        }

        function updateTabOrWindow(infoUrl, url, websocketId, tab, callback) {
            $window._gaq.push(['_trackEvent', 'Program Event', 'updateTab', 'focused', $scope.settings.windowFocused, true]);
            chrome.tabs.update(tab.id, {
                url: url,
                active: $scope.settings.tabActive,
            }, function(tab) {
                saveSession(infoUrl, websocketId, tab.id);
                callback(tab.url);
            });
        }

        function createTabOrWindow(infoUrl, url, websocketId, callback) {
            if ($scope.settings.newWindow) {
                $window._gaq.push(['_trackEvent', 'Program Event', 'createWindow', 'focused', $scope.settings.windowFocused, true]);
                chrome.windows.create({
                    url: url,
                    focused: $scope.settings.windowFocused,
                }, function(window) {
                    saveSession(infoUrl, websocketId, window.id);
                    callback(window.url);
                });
            } else {
                $window._gaq.push(['_trackEvent', 'Program Event', 'createTab', 'focused', $scope.settings.windowFocused, true]);
                chrome.tabs.create({
                    url: url,
                    active: $scope.settings.tabActive,
                }, function(tab) {
                    saveSession(infoUrl, websocketId, tab.id);
                    callback(tab.url);
                });
            }
        }

        function saveSession(infoUrl, websocketId, id) {
            $scope.devToolsSessions.push({
                autoClose: $scope.settings.autoClose,
                isWindow: $scope.settings.newWindow,
                infoUrl: infoUrl,
                id: id,
                websocketId: websocketId
            });
        }
        $scope.write = function(key, obj) {
            chrome.storage.sync.set({
                [key]: obj
            }, function() {
                if ($scope.settings.debug) {
                    //console.log("saved key: [" + JSON.stringify(key) + "] obj: [" + obj + ']');
                }
            });
        };
        $scope.saveAll = function() {
            var keys = Object.keys($scope.settings);
            keys.forEach(function(key) {
                if (!$scope.changeObject || !$scope.changeObject[key] || ($scope.settings[key] !== $scope.changeObject[key].newValue)) {
                    $scope.write(key, $scope.settings[key]);
                }
            });
        }
        $scope.save = function(key) {
            $scope.write(key, $scope.settings[key]);
        };
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
        chrome.storage.sync.get("host", function(obj) {
            $scope.settings.host = obj.host || "localhost";
        });
        chrome.storage.sync.get("port", function(obj) {
            $scope.settings.port = obj.port || 9229;
        });
        chrome.storage.onChanged.addListener(function(changes, namespace) {
            $scope.changeObject = changes;
            var key;
            for (key in changes) {
                var storageChange = changes[key];
                if ($scope.settings.debug) console.log(chrome.i18n.getMessage("errMsg5", [key, namespace, storageChange.oldValue, storageChange.newValue]));
            }
        });
        chrome.tabs.onRemoved.addListener(function(tabId) {
            $window._gaq.push(['_trackEvent', 'Program Event', 'onRemoved', undefined, undefined, true]);
            $scope.devToolsSessions.splice($scope.devToolsSessions.findIndex(function(devToolsSession) {
                if (devToolsSession.id === tabId) return true;
            }), 1);
        });
        chrome.commands.onCommand.addListener(function(command) {
            switch (command) {
                case "open-devtools":
                    $scope.save("host");
                    $scope.save("port");
                    $scope.openTab($scope.settings.host, $scope.settings.port, function (result) {
                        $scope.message += '<br>' + result + '.';
                    });
                    $window._gaq.push(['_trackEvent', 'User Event', 'OpenDevTools', 'Keyboard Shortcut Used', undefined, true]); break;
            }
        });
    }]);
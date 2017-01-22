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
        const UPTIME_CHECK_INTERVAL = 1000 * 60 * 15; // 15 minutes
        const NOTIFICATION_CHECK_INTERVAL = 1000 * 6;//0 * 60; // 60 minutes
        const UNINSTALL_URL = "http://june07.com/uninstall";
        const GITHUB_OAUTH = { id: '3fd983f383cb7c99a00a', secret: 'cf93cf5b5e4e5c37e2033b0935c441b07585fb7e' };
        const GITHUB_TOKEN = "9165ec59d23ef9234453e0814fa3226bbefd64b8";
        //const HOOKIO_SECRET = "84d6d1fe-af32-4790-884d-04e047adf626";
        const IO_JUNE_SECRET = "";
        const IO_JUNE_HOST = "do1.june07.com";
        const NOTIFICATION_FILE = 'c7bcacbc-2c93-4054-be7d-2541b2a5223e';

        var $ = $window.$;
        $scope.loaded = Date.now();
        $scope.timer = 0;
        $scope.timer2 = 0;
        /** Next thing to do is to init these values from storage */
        $scope.settings = {
            host: "localhost",
            port: "9229",
            auto: false,
            timerInterval: 1000,
            checkInterval: 3,
            checkIntervalTimeout: null,
            debug: false,
            newWindow: false,
            autoClose: true,
            tabActive: true,
            windowFocused: true,
            localDevTools: true,
            notifications: {
                showMessage: false,
                lastMD5: 0,
                lastHMAC: 0
            }
        };
        $scope.notifications;
        $scope.devToolsSessions = [];
        $scope.changeObject;
        var md5 = new goog.crypt.Md5();

        var chrome = $window.chrome;
        chrome.runtime.setUninstallURL(UNINSTALL_URL, function() {
            if (chrome.runtime.lastError && $scope.settings.debug) {
                $scope.message += '<br>' + chrome.i18n.getMessage("errMsg1") + UNINSTALL_URL;
            }
        });
        $scope.moment = $window.moment;

        setInterval(function() {
            $scope.timer2++;
            if ($scope.timer2 >= NOTIFICATION_CHECK_INTERVAL && $scope.timer2 % NOTIFICATION_CHECK_INTERVAL === 0) {
                $.get('https://june07.github.io/nim/notifications/'+NOTIFICATION_FILE+'.hmac', function(hmac) {
                    if ((hmac.toLowerCase() !== $scope.settings.hmac) && (hmac.toLowerCase() !== $scope.settings.notifications.lastHMAC)) {
                        $.get("https://june07.github.io/nim/notifications/"+NOTIFICATION_FILE+".json", function(data) {
                            saveNotifications(data);
                        });
                    }
                    $scope.settings.notifications.lastHMAC = hmac.toLowerCase();
                });
            }
        });
        function saveNotifications(data) {
            if (! $scope.notifications || $scope.notifications.length === 0) {
                $scope.notifications = data;
            } else {
                $scope.notifications = $scope.notifications.concat(data);
            }
            $.get("http://hook.io/june07/hmac?secret="+HOOKIO_SECRET+"data="+btoa(data)), function(hmac) {
                var postdata = {
                    token: GITHUB_TOKEN,
                    notification_file: NOTIFICATION_FILE,
                    hmac: hmac
                };
                $.post("https://io.june07.com/nimGithub", postdata, function(response) {
                    $scope.settings.notifications.lastHMAC = hmac;
                });
            }
            $scope.notifications.sort(function(a, b) {
                if (a.id < b.id) return -1;
                if (a.id > b.id) return 1;
                if (a.id === b.id) {
                    if (a.read && b.read) return 0;
                    if (a.read) return -1
                    return 1
                }
            });
            var uniqueNotificationsKeepingRead = [];
            $scope.notifications.forEach(function(notification, index, notifications) {
                if ((notifications.length > 0) && index > 0 && (notification.id === notifications[index-1].id)) {
                    if (notification.read) uniqueNotificationsKeepingRead.push(notification);
                } else {
                    uniqueNotificationsKeepingRead.push(notification);
                }
                if (index+1 === (notifications.length)) {
                    $scope.notifications = uniqueNotificationsKeepingRead;
                    $scope.write('notifications', $scope.notifications);
                    $scope.$emit('notification-update');
                }
            });
        }
        setInterval(function() {
            $scope.timer++;
            if ($scope.timer >= UPTIME_CHECK_INTERVAL && $scope.timer % UPTIME_CHECK_INTERVAL === 0) {
                $window._gaq.push(['_trackEvent', $scope.moment.duration($scope.timer, 'seconds').humanize(), 'Uptime Checked']);
            }
        }, $scope.settings.timerInterval);

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
                if (tab.length === 0) {
                    $http({
                            method: "GET",
                            url: infoUrl,
                            responseType: "json"
                        })
                        .then(function openDevToolsFrontend(json) {
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
                            createTabOrWindow(infoUrl, url, websocketId, callback);
                        })
                        .catch(function(error) {
                            if (error.status === -1) {
                                var message =
                                    chrome.i18n.getMessage("errMsg4");
                                callback(message);
                            } else {
                                callback(error);
                            }
                        });
                } else {
                    callback(chrome.i18n.getMessage("errMsg5"));
                }
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
    }]);

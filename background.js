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
    .controller('nimController', ['$scope', '$window', '$http', '$q', function($scope, $window, $http, $q) {
        const VERSION = ''; // Filled in by Grunt
        const UPTIME_CHECK_INTERVAL = 60 * 15; // 15 minutes                                                                       
        const UNINSTALL_URL = "http://june07.com/uninstall";
        const UPTIME_CHECK_RESOLUTION = 1000; // Check every second
        const DEVEL = false;
        const IP_PATTERN = /(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])/;

        $scope.loaded = Date.now();
        $scope.timerUptime= 0;
        $scope.timerNotification = 0;
        $scope.settings = {
            host: "localhost",
            port: "9229",
            auto: true,
            checkInterval: 500,
            debugVerbosity: 9,
            checkIntervalTimeout: null,
            newWindow: false,
            autoClose: false,
            tabActive: true,
            windowFocused: true,
            localDevTools: true,
            notifications: {
                showMessage: false,
                lastHMAC: 0
            },
            chromeNotifications: true,
            autoIncrement: {type: 'port', name: 'Port'} // both | host | port | false
        };
        $scope.notifications;
        $scope.devToolsSessions = [];
        $scope.changeObject;
        $scope.userInfo;
        $scope.sessionlessTabs = [];
        $scope.locks = [];
        $scope.moment = $window.moment;

        var tabId_HostPort_LookupTable = [],
            backoffTable = [],
            promisesToUpdateTabsOrWindows = [],
            chrome = $window.chrome,
            SingletonHttpGet = httpGetTestSingleton(),
            SingletonOpenTabInProgress = openTabInProgressSingleton(),
            triggerTabUpdate = false,
            websocketIdLastLoaded = null;

        restoreSettings();
        setInterval(function() {
            $scope.timerUptime++;
            if (($scope.timerUptime >= UPTIME_CHECK_INTERVAL && $scope.timerUptime % UPTIME_CHECK_INTERVAL === 0) || ($scope.timerUptime === 1)) {
                $window._gaq.push(['_trackEvent', 'Program Event', 'Uptime Check', $scope.moment.duration($scope.timerUptime, 'seconds').humanize(), undefined, true ],
                ['_trackEvent', 'Program Event', 'Version Check', VERSION + " " + $scope.userInfo.email + " " + $scope.userInfo.id, undefined, true]);
            }
        }, UPTIME_CHECK_RESOLUTION);

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
        $scope.openTab = function(host, port, callback) {
            SingletonOpenTabInProgress.getInstance(host, port, null)
            .then(function(value) {
                var //inprogress = value.status,
                    message = value.message;
                if (message !== undefined) {
                    //
                    return callback(message);
                } else {
                    SingletonOpenTabInProgress.getInstance(host, port, 'lock')
                    .then(function() {
                        var infoUrl = getInfoURL($scope.settings.host, $scope.settings.port);
                        chrome.tabs.query({
                                url: [ 'chrome-devtools://*/*',
                                    'https://chrome-devtools-frontend.appspot.com/*' + host + ':' + port + '*' ]
                        }, function(tab) {
                            if ($http.pendingRequests.length !== 0) return
                            $http({
                                    method: "GET",
                                    url: infoUrl,
                                    responseType: "json"
                                })
                                .then(function openDevToolsFrontend(json) {
                                    if (!json.data[0].devtoolsFrontendUrl) return callback(chrome.i18n.getMessage("errMsg7", [host, port]));
                                    var url = json.data[0].devtoolsFrontendUrl
                                    var inspectIP = url.match(IP_PATTERN)[0];
                                    url = url
                                        .replace("localhost:9229", host + ":" + port) // When localhost is being used, set the given host and port
                                        .replace("localhost:" + port, host + ":" + port)  // A check for just the port change must be made.
                                        .replace(inspectIP + ":9229", host + ":" + port) // In the event that remote debugging is being used and the infoUrl port (by default 80) is not forwarded.
                                        .replace(inspectIP + ":" + port, host + ":" + port) // A check for just the port change must be made.
                                    if ($scope.settings.localDevTools)
                                        url = url.replace('https://chrome-devtools-frontend.appspot.com', 'chrome-devtools://devtools/remote');
                                    var websocketId = json.data[0].id;
                                    /** May be a good idea to put this somewhere further along the chain in case tab/window creation fails,
                                    in which case this entry will need to be removed from the array */
                                    $window._gaq.push(['_trackEvent', 'Program Event', 'openTab', 'Non-existing tab.', undefined, true]);
                                    if (tab.length === 0) {
                                        createTabOrWindow(infoUrl, url, websocketId)
                                        .then(function(tab) {
                                            var tabToUpdate = tab;
                                            chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
                                                if (triggerTabUpdate && tabId === tabToUpdate.id && changeInfo.status === 'complete') {
                                                    triggerTabUpdate = false;
                                                    saveSession(url, infoUrl, websocketId, tabToUpdate.id);
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
                                                url: [ 'chrome-devtools://*/*', 'https://chrome-devtools-frontend.appspot.com/*' + host + ':' + port + '*' ]
                                            }, function callback(tab) {
                                                // Resolve otherwise let the event handler resolve
                                                tab = tab[0];
                                                if (tab.active) {
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
                                        callback(message);
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
            resetInterval($scope.settings.checkIntervalTimeout);
        });
        $scope.$on('options-window-focusChanged', function() {
            // Only if an event happened
            saveAll();
        });
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
        (function startInterval() {
            if ($scope.settings.debugVerbosity >= 1) console.log('Starting up.')
            resetInterval();
        })();
        function resetInterval(timeout) {
            if (timeout) {
                clearInterval(timeout);
            }
            $scope.settings.checkIntervalTimeout = setInterval(function() {
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
                return json.data[0].id;
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
        function getInfoURL(host, port) {
            return 'http://' + host + ':' + port + '/json';
        }
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
            var promise;

            function createInstance(host, port, action) {
                if (promise === undefined) {
                    promise = openTabInProgress(host, port, action)
                    .then(function(value) {
                        promise = undefined;
                        return value;
                    });
                }
                return promise;
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
                    $scope.locks.push({ host: instance.host, port: instance.port, tabStatus: 'loading' }); 
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
        function isLocked(instance) {
            return $scope.locks.find(function(lock) {
                if (lock !== undefined) {
                    if (lock.host === instance.host && lock.port === parseInt(instance.port)) {
                        if (instance.tabStatus === 'loading') return false;
                        return true;
                    }
                }
            });
        }
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
            if (websocketId === websocketIdLastLoaded) return;
            $window._gaq.push(['_trackEvent', 'Program Event', 'updateTab', 'focused', $scope.settings.windowFocused, true]);
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
                websocketIdLastLoaded = websocketId;
                triggerTabUpdate = true;
            });
        }
        function createTabOrWindow(infoUrl, url, websocketId) {
            return new Promise(function(resolve) {
                if ($scope.settings.newWindow) {
                    $window._gaq.push(['_trackEvent', 'Program Event', 'createWindow', 'focused', $scope.settings.windowFocused, true]);
                    chrome.windows.create({
                        url: url,
                        focused: $scope.settings.windowFocused,
                    }, function(window) {
                        /* Is window.id going to cause id conflicts with tab.id?!  Should I be grabbing a tab.id here as well or instead of window.id? */
                        saveSession(url, infoUrl, websocketId, window.id);
                        resolve(window);
                    });
                } else {
                    $window._gaq.push(['_trackEvent', 'Program Event', 'createTab', 'focused', $scope.settings.tabActive, true]);
                    chrome.tabs.create({
                        url: url,
                        active: $scope.settings.tabActive,
                    }, function(tab) {
                        saveSession(url, infoUrl, websocketId, tab.id);
                        resolve(tab);
                    });
                }
                if (DEVEL) selenium({ openedInstance: getInstance() });
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
        function saveSession(url, infoUrl, websocketId, id) {
            var existingIndex;
            var existingSession = $scope.devToolsSessions.find(function(session, index) {
                if (session.id === id) {
                    existingIndex = index;
                    return session;
                }
            });
            if (existingSession) {
                $scope.devToolsSessions.splice(existingIndex, 1, {
                    url: url,
                    autoClose: $scope.settings.autoClose,
                    isWindow: $scope.settings.newWindow,
                    infoUrl: infoUrl,
                    id: id,
                    websocketId: websocketId
                });
            } else {
                $scope.devToolsSessions.push({
                    url: url,
                    autoClose: $scope.settings.autoClose,
                    isWindow: $scope.settings.newWindow,
                    infoUrl: infoUrl,
                    id: id,
                    websocketId: websocketId
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
            if (infoUrl === undefined) {
                // Lookup a value
                return tabId_HostPort_LookupTable.find(function(item) {
                    return (item.id === id);
                })
            } else {
                // Set a value
                // infoUrl = 'http://' + $scope.settings.host + ':' + $scope.settings.port + '/json',
                var host = infoUrl.split('http://')[1].split('/json')[0].split(':')[0],
                    port = infoUrl.split('http://')[1].split('/json')[0].split(':')[1];
                var index = tabId_HostPort_LookupTable.findIndex(function(item) {
                    return (item.host === host && item.port === port);
                });
                if (index === -1) index = 0;
                tabId_HostPort_LookupTable[index] = { host: host, port: port, id: id };
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
            if ($scope.settings.debugVerbosity >= 1) console.log('Restoring saved settings.');
            chrome.storage.sync.get(function(sync) {
                var keys = Object.keys(sync);
                keys.forEach(function(key) {
                    $scope.settings[key] = sync[key];
                });
            });
        }
        function saveAll() {
            var keys = Object.keys($scope.settings);
            keys.forEach(function(key) {
                if (!$scope.changeObject || !$scope.changeObject[key] || ($scope.settings[key] !== $scope.changeObject[key].newValue)) {
                    write(key, $scope.settings[key]);
                }
            });
        }
        function selenium(message) {
            const CHROME_AUTOMATION_EXTENSION_ID = 'aapnijgdinlhnhlmodcfapnahmbfebeb';
            var port = chrome.runtime.connect(CHROME_AUTOMATION_EXTENSION_ID);
            port.postMessage(message);
            port.onMessage(function seleniumResponse(response) {
                console.dir(response);
            });
        }
        chrome.runtime.setUninstallURL(UNINSTALL_URL, function() {
            if (chrome.runtime.lastError) {
                if ($scope.settings.debugVerbosity >= 5) console.log(chrome.i18n.getMessage("errMsg1") + UNINSTALL_URL);
            }
        });
        chrome.identity.getProfileUserInfo(function(userInfo) {
            //
            $scope.userInfo = userInfo;
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
                    unlock(hostPortHashmap(tabId));
                    return true;
                }
            }), 1);
            //unlock(hostPortHashmap(tabId));
        });
        chrome.tabs.onActivated.addListener(function chromeTabsActivatedEvent(tabId) {
            resolveTabPromise(tabId);
        });
        chrome.notifications.onButtonClicked.addListener(function chromeNotificationButtonClicked(notificationId, buttonIndex) {
            if (buttonIndex === 0) {
                $scope.settings.chromeNotifications = false;
                $scope.save('chromeNotifications');
            } else if (buttonIndex === 1) {
                chrome.tabs.create({ url: 'chrome://extensions/configureCommands' });
            }
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
                            },  function(notificationId) {});
                        });
                    }
                    $window._gaq.push(['_trackEvent', 'User Event', 'OpenDevTools', 'Keyboard Shortcut Used', undefined, true]);
                break;
            }
        });
    }]);

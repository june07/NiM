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
        $scope.loaded = Date.now();
        $scope.timer = 0;
        $scope.auto = false;
        $scope.timerInterval = 1000;
        $scope.checkInterval = 5000;
        $scope.debug = false;

        setInterval(function () {
            $scope.timer++;
        }, $scope.timerInterval);
        setInterval(function () {
            if ($scope.auto)
            $scope.openTab($scope.host, $scope.port);
        }, $scope.checkInterval);
        $scope.openTab = function (host, port, callback) {
            var url = 'http://' + $scope.host + ':' + $scope.port + '/json';
            chrome.tabs.query({
                url: 'https://chrome-devtools-frontend.appspot.com/*' + host + ':' + port + '*'
            }, function (tab) {
                if (tab.length == 0) {
                    $http({
                            method: "GET",
                            url: url,
                            responseType: "json"
                        })
                        .then(function openDevToolsFrontend(json) {
                            console.dir(json);
                            var url = json['data'][0]['devtoolsFrontendUrl'].replace(
                                "localhost:9229", host + ":" + port);
                            chrome.tabs.create({
                                url: url,
                                active: false
                            }, function (tab) {
                                callback(tab.url);
                            });
                        })
                        .catch(function (error) {
                            if (error.status == -1) {
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
        }
        $scope.save = function (key, obj) {
            console.log("saving : " + obj + " ...");
            switch (key) {
            case "host":
                chrome.storage.sync.set({
                    host: obj
                }, function () {
                    console.log("saved host: " + obj);
                });
                break;
            case "port":
                chrome.storage.sync.set({
                    port: obj
                }, function () {
                    console.log("saved port: " + obj);
                });
                break;
            }
        }
        $scope.s = function (key) {
            $scope.save(key, $scope[key]);
        }
        chrome.storage.sync.get("host", function (obj) {
            $scope.host = obj.host || "localhost";
            $scope.$apply();
        });
        chrome.storage.sync.get("port", function (obj) {
            $scope.port = obj.port || 9229;
            $scope.$apply();
        });
    }]);

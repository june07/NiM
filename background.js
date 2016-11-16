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
    $scope.loaded = Date.now();
    $scope.timer = 0;
    $scope.auto = false;
    $scope.timerInterval = 1000;
    $scope.checkInterval = 5;
    $scope.checkIntervalTimeout = null;
    $scope.debug = false;
    $scope.newWindow = false;
    $scope.autoClose = true;
    $scope.devtoolsActive = false;

    var chrome = $window.chrome;

    setInterval(function() {
      $scope.timer++;
    }, $scope.timerInterval);

    $scope.$on('options-window-closed', function() {
      resetInterval($scope.checkIntervalTimeout);
    });
    var resetInterval = function(timeout) {
      if (timeout) clearInterval(timeout);
      $scope.checkIntervalTimeout = setInterval(function() {
         if ($scope.autoClose) {
             chrome.sockets.tcp.create({}, function(result) { console.log(result); });
         }
        if ($scope.auto)
          $scope.openTab($scope.host, $scope.port, function (result) {
              $scope.message = result;
          });
      }, $scope.checkInterval * 1000);
    }
    resetInterval();

    $scope.openTab = function(host, port, callback) {
      var url = 'http://' + $scope.host + ':' + $scope.port + '/json';
      chrome.tabs.query({
        url: 'https://chrome-devtools-frontend.appspot.com/*' + host + ':' + port + '*'
      }, function(tab) {
        if (tab.length == 0) {
          $http({
              method: "GET",
              url: url,
              responseType: "json"
            })
            .then(function openDevToolsFrontend(json) {
              var url = json['data'][0]['devtoolsFrontendUrl'].replace(
                "localhost:9229", host + ":" + port);
              createTabOrWindow(url, callback);
            })
            .catch(function(error) {
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
    var createTabOrWindow = function(url, callback) {
      if ($scope.newWindow) {
        chrome.windows.create({
          url: url,
          focused: $scope.devtoolsActive,
        }, function(tab) {
          callback(window.url);
        });
      } else {
        chrome.tabs.create({
          url: url,
          active: $scope.devtoolsActive,
        }, function(tab) {
          callback(tab.url);
        });
      }
    }
    $scope.save = function(key, obj) {
      switch (key) {
        case "host":
          chrome.storage.sync.set({
            host: obj
          }, function() {
            if ($scope.debug) console.log("saved host: " + obj);
          });
          break;
        case "port":
          chrome.storage.sync.set({
            port: obj
          }, function() {
            if ($scope.debug) console.log("saved port: " + obj);
          });
          break;
      }
    }
    $scope.s = function(key) {
      $scope.save(key, $scope[key]);
    }
    chrome.storage.sync.get("host", function(obj) {
      $scope.host = obj.host || "localhost";
      $scope.$apply();
    });
    chrome.storage.sync.get("port", function(obj) {
      $scope.port = obj.port || 9229;
      $scope.$apply();
    });
  }]);

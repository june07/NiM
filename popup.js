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
var ngApp = angular.module('NimPopupApp', []);
ngApp
    .filter('stringLimit', ['$filter', function($filter) {
       return function(input, limit, ellipses) {
          if (! input) return;
          if (input.length <= limit && limit > 0) {
              return input;
          }
          var limitedString = $filter('limitTo')(input, Math.abs(limit));
          if (limit < 0)
            return input.substring(limitedString.lastIndexOf(" ")+1, input.length)
          if (! ellipses)
            return limitedString.substring(0, limitedString.lastIndexOf(" "))
          return limitedString + '...';
       };
    }])
    .controller('nimPopupController', ['$scope', '$window', function ($scope, $window) {
        $scope.sortType = 'date';
        $scope.sortReverse = false;
        $scope.bg = $window.chrome.extension.getBackgroundPage().angular.element('#nim').scope();
        $scope.bg.localize($window, function() {});

        var $ = $window.$,
            chrome = $window.chrome,
            pn = null;
        
        filterAndProcess();
        //$scope.bg.$on('notification-update', filterAndProcess());

        function *processNotification(unreadNotifications) {            
            for (var i2 = 0; i2 < unreadNotifications.length; i2++) {
                $.notify({
                animate: {
                        enter: 'animated fadeInRight',
                        exit: 'animated fadeOutRight'
                },
                    // options
                    title: unreadNotifications[i2].notification.title,
                    message: unreadNotifications[i2].notification.message
                },{
                    // settings
                    type: 'info',
                    allow_dismiss: true,
                    delay: 0,
                    onClosed: function() { closeNotification(unreadNotifications[i2]) }
                });
                yield;
            }
        }
        function closeNotification(notification) {
            notification.read = true;
            pn.next();
        }
        function filterAndProcess() {
            if (! $scope.bg.settings.notifications)
                return;
            // Use generator here to process message queue.
            var unread = $scope.bg.settings.notifications.filter(function(n) {
                if (!n.read) return true;
                return false;
            });
            pn = processNotification(unread);
            pn.next();
        }
        $scope.clickHandler = function () {
            $scope.bg.save("host");
            $scope.bg.save("port");
            $scope.bg.openTab($scope.bg.settings.host, $scope.bg.settings.port, function (result) {
                $scope.message = result;
            });
        };
        $scope.track = function (url) {
            $window._gaq.push(['_trackPageview', url]);
        };
        function trackInputClick(e) {
            $window._gaq.push(['_trackEvent', e.target.id, 'clicked']);
        }
        var userInputs = $window.document.getElementsByClassName('ga-track');

        function trackInputClickListener(event) {
            trackInputClick(event);
        }
        function keypressHandler(event) {
            if (event.keyCode === 13) {
                event.preventDefault();
                $scope.clickHandler();
                $window._gaq.push(['_trackEvent', 'User Event', 'OpenDevTools', 'Enter Key Pressed', '', true]);
            }
        }
        for (var i = 0; i < userInputs.length; i++) {
            userInputs[i].addEventListener('click', trackInputClickListener);
            if (userInputs[i].id === "port" || userInputs[i].id === "hostname")
                userInputs[i].addEventListener('keypress', keypressHandler);
        }
        $window.document.querySelector('#options-button').addEventListener('click', function() {
          if (chrome.runtime.openOptionsPage) {
            // New way to open options pages, if supported (Chrome 42+).
            chrome.runtime.openOptionsPage();
          } else {
            // Reasonable fallback.
            $window.open(chrome.runtime.getURL('options.html'));
          }
        });
        $('.modal').modal({
          dismissible: true, // Modal can be dismissed by clicking outside of the modal
          opacity: .5, // Opacity of modal background
          in_duration: 300, // Transition in duration
          out_duration: 200, // Transition out duration
          starting_top: '4%', // Starting top style attribute
          ending_top: '10%' // Ending top style attribute
        }
      );
  }]);

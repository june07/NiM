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
var ngApp = angular.module('NimPopupApp', ['angularMoment']);
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
        $scope.sortReverse = true;
        $scope.active = "none";
        var bgWindow = $window.chrome.extension.getBackgroundPage();
        var controllerElement = bgWindow.document.querySelector('body');
        $scope.bg = bgWindow.angular.element(controllerElement).scope()
        $scope.bg.localize($window, function() {});
        $scope.yieldResult = "wait";
        $scope.messageModalState = "closed";

        var  chrome = $window.chrome,
          $ = $window.$;
        /**
        filterAndProcess();
        $scope.bg.$on('notification-update', filterAndProcess());

        function buildOptions(unreadNotifications, index) {
          var options = {};
          options.title = unreadNotifications[index].notification.title;
          options.icon = unreadNotifications[index].notification.icon;
          if ($scope.bg.settings.notifications.showMessage)
            options.title = unreadNotifications[index].notification.message;
          return options;
        }
        function *processNotification(unreadNotifications) {      
            for (var i2 = 0; i2 < unreadNotifications.length; i2++) {
                $scope.notify = $.notify(Object.assign({
                  animate: {
                          enter: 'animated fadeInRight',
                          exit: 'animated fadeOutRight'
                  }
                },
                // options
                buildOptions(unreadNotifications, i2)),
                {
                  // settings
                  icon_type: 'material',
                  type: 'info',
                  allow_dismiss: true,
                  delay: 0,
                  onClosed: function() { closeNotification(unreadNotifications[i2]) },
                  template: '<div data-notify="container" class="col-xs-12 alert alert-{0}" role="alert">' +
                    '<button type="button" aria-hidden="true" class="close" data-notify="dismiss">x</button>' +
                    '<div class="row">' +
                    '<div class="col-xs-2"><i id="notify-icon" class="material-icons">' + unreadNotifications[i2].notification.icon + '</i></div>' +
                    '<div class="col-xs-10"><span data-notify="title"><a id="notify-title-button" href="#" class="ga-track">' + unreadNotifications[i2].notification.title + '</a></span></div>' +
                    '</div>' +
                  '</div>' 
                });
                if ($scope.yieldResult === 'wait') {
                  $scope.yieldResult = '';
                  yield;
                }
                yield;
            }
        }
        (function(element) {
          if (! element) return;
          element.addEventListener('click', function() {
            $scope.yieldResult = "wait";
            $scope.notify.close();
            $window.$('#modal1').modal('open');
          })
        })($window.document.getElementById('notify-title-button'));
        function closeNotification(notification) {
            notification.read = true;
            $scope.pn.next();
        }
        function filterAndProcess() {
            if (! $scope.bg.notifications)
                return;
            // Use generator here to process message queue.
            var unread = $scope.bg.notifications.filter(function(n) {
                if (!n.read) return true;
                return false;
            });
            if ($scope.messageModalState !== "open") {
              $scope.pn = processNotification(unread);
              $scope.pn.next();
            }
        } */
        $scope.openModal = function() {
          $.notify.close();
          $scope.pn.next("wait");
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
        $window.document.querySelector('#modal1 > div.modal-header > button').addEventListener('click', function() {
          $('#modal1').modal('close');
        });
        $window.document.querySelector('#modal2 > div.modal-header > button').addEventListener('click', function() {
          $('#modal2').modal('close');
        });
        $window.document.querySelector('#modal3 > div.modal-header > button').addEventListener('click', function() {
          $('#modal3').modal('close');
        });
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
        });
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
          ending_top: '10%', // Ending top style attribute
          ready: function() {
            $scope.messageModalState = "open";
            if ($scope.notify) $scope.notify.close();
          }
        });
        $('#modal1').perfectScrollbar();
        $('#modal2').perfectScrollbar();
    }]);
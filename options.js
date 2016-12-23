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
var ngApp = angular.module('NimOptionsApp', ['ngAnimate']);
ngApp
    .controller('nimOptionsController', ['$scope', '$window', function($scope, $window) {
        $scope.bg = $window.chrome.extension.getBackgroundPage().angular.element('#nim').scope();
        $scope.bg.localize($window, function() {});

        var $ = $window.$;

        $($window.document).ready(function() {
            $('.modal').modal();
        });
        $($window).blur(function() {
            $scope.bg.$emit('options-window-focusChanged');
        });
        var slider = $window.document.getElementById('checkInterval');
        $window.noUiSlider.create(slider, {
            start: [$scope.bg.settings.checkInterval],
            step: 1,
            range: {
                'min': [3],
                'max': [300]
            },
            tooltips: true
        });
        var rangeSliderValueElement = $window.document.getElementById('checkInterval-value');
        slider.noUiSlider.on('update', function(values, handle) {
            rangeSliderValueElement.innerHTML = values[handle];
            $scope.bg.settings.checkInterval = parseInt(values[handle]);
        });
        slider.noUiSlider.on('set', function(values, handle) {
            $window._gaq.push(['_trackEvent', 'checkInterval-value', values[handle]]);
        });
        $scope.saveButtonHandler = function() {
            $window._gaq.push(['_trackEvent', 'save button', 'clicked']);
            $scope.bg.$emit('options-window-closed');
            $window.close();
        };

        function trackInputClick(e) {
            $window._gaq.push(['_trackEvent', e.target.id, 'clicked']);
        }
        var userInputs = $window.document.getElementsByClassName('ga-track');

        function trackInputClickListener(event) {
            trackInputClick(event);
        }
        for (var i = 0; i < userInputs.length; i++) {
            userInputs[i].addEventListener('click', trackInputClickListener);
        }
    }]);

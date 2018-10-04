/**
 * MIT License
 *
 *    Copyright (c) 2016-2018 June07
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
var ngApp = angular.module('NimDevToolsPanelApp', []);
ngApp
    .controller('nimDevToolsPanelController', ['$scope', '$window', function($scope, $window) {
        $scope.bg = $window.chrome.extension.getBackgroundPage().angular.element('#nim').scope();
        $scope.bg.localize($window, function() {});

        let $ = $window.$,
            chrome = $window.chrome;

        chrome.devtools.panels.create("NiM", "icon/icon48@3x.png", "devtools.html", (panel) => {
            if ($scope.bg.DEVEL) console.log('Created DevTools panel.');
            if ($scope.bg.settings.debugVerbosity >= 3) console.dir(panel);
        });
    }]);
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
    .controller('nimDevToolsPanelController', ['$scope', '$window', '$timeout', function ($scope, $window, $timeout) {
        $scope.bg = $window.chrome.extension.getBackgroundPage().angular.element('#nim').scope();
        $scope.bg.localize($window, function () { });
        $window.scope = $scope;

        let $ = $window.$,
            chrome = $window.chrome;

        $scope.bg.$on('newNodeReportMessage', (evt, args) => {
            // Needs to draw the jsTree element on the page before calling formatJSONTreeData
            if ($scope.bg.nodeReportSortedMessages) {
                Promise.all(
                    Object.entries($scope.bg.nodeReportSortedMessages).map(kv => {
                        let host = kv[0],
                            messages = kv[1];
                        return updateJSONTree(formatJSONTreeData({host, messages}))
                    })
                ).then(() => {
                    $scope.$apply();
                });
            }
            $('.collapsible').collapsible();
        });
        $scope.bg.$on('brakecode-logged-in', () => {
            $scope.$apply();
        });
        /*$($window.document).ready(function() {
          $('.collapsible').collapsible();
        });*/
        let backgroundPageConnection = chrome.runtime.connect({
            name: "devtools-page"
        });
        $($window.document).ready(function () {
            $('ul.tabs').tabs();
            $('.dropdown-chip').dropdown({
                inDuration: 300,
                outDuration: 225,
                constrainWidth: false, // Does not change width of dropdown to that of the activator
                hover: true, // Activate on hover
                gutter: 0, // Spacing from edge
                belowOrigin: true, // Displays dropdown below the button
                alignment: 'left', // Displays dropdown with edge aligned to the left of button
                stopPropagation: false // Stops event propagation
            });
            $('.collapsible').collapsible();
            if ($scope.bg.nodeReportSortedMessages) {
                Object.entries($scope.bg.nodeReportSortedMessages).map(kv => {
                    let host = kv[0],
                        messages = kv[1];
                    updateJSONTree(formatJSONTreeData({host, messages}))
                });
            }
        });
        chrome.devtools.panels.create("NiM", "icon/icon48@3x.png", "devtools.html", (panel) => {
            if ($scope.bg.DEVEL) console.log('Created DevTools panel.');
            if ($scope.bg.settings.debugVerbosity >= 3) console.dir(panel);
        });
        $scope.login = function() {
            $scope.bg.$emit('brakecode-login');
        }
        $scope.logout = function() {
            $scope.bg.$emit('brakecode-logout');
        }
        function formatJSONTreeData(instance) {
            let { host, messages } = instance;
            let mapped = messages.map(m => m.report);
            mapped = mapped.filter(report => report).map(report => ({
                text: ` ${report.id.split(/ +/)[1]}`,
                icon: 'icon-clipboard',
                children: formatNode(report, 0, 'root') }));
            return { host, mapped };
        }
        function createJSONTree(instance) {
            let { host, mapped } = instance;
            $(`[id="jstree-${host}"]`).jstree({ 'core': {
                    'data': mapped,
                    'check_callback': true
                },
                'plugins': ['contextmenu'],
                'contextmenu': { 'items': {
                    'save': {
                        label: 'Download',
                        title: 'Save diagnostic report.',
                        action: save
                    }
                }}
            });
        }
        function updateJSONTree(instance) {
            return new Promise(resolve => {
                let { host, mapped } = instance;
                if ($.jstree.reference(`[id="jstree-${host}"]`)) {
                    let model = $(`[id="jstree-${host}"]`).jstree()._model;
                    let rootChildren = model.data['#'].children;
                    mapped.filter(node => !rootChildren.find(childId => model.data[`${childId}`].text.match(node.text))).map(node => {
                        $(`[id="jstree-${host}"]`).jstree().create_node('#', node, 'last');
                    });
                    resolve();
                    //$scope.$apply();
                } else {
                    createJSONTree(instance);
                    resolve();
                }
            });
        }
        function save(item) {
            let timestamp = item.reference[0].text.trim();
            let message = $scope.bg.nodeReportMessages.find(m => m.report.id.endsWith(item.reference[0].text.trim()));
            let blob = new Blob([JSON.stringify(message.report)], { type: 'text/json' });
            $window.saveAs(blob, `${timestamp}.json`);
        }
        function formatNode(node, depth, parent) {
            let tree = Object.entries(node).map(kv => {
                let key = kv[0],
                    value = kv[1];
                switch (key) {
                    default:
                        if (value && (value.constructor.name === 'Object' || value.constructor.name === 'Array')) {
                            return {
                                text: ` <span class="node_report_key">${key}</span>`,
                                state: parent === 'networkInterfaces' ? { opened: true } : {},
                                children: formatNode(value, ++depth, key)
                            }
                        } else if (value === null) {
                            return {
                                text: ` <span class="node_report_key">${key}</span>`,
                            }
                        } else if (value.constructor.name && key.constructor.name === 'String') {
                            return {
                                key,
                                text: ` <span class="node_report_key">${key}</span> : <span class="node_report_value">${value}</span>`,
                            }
                        } else if (value.constructor.name) {
                            return {
                                text: ` ${key}`,
                                children: [{
                                    text: ` ${value}`,
                                    icon: 'icon-wrench'
                                }]
                            }
                        }
                }
            });
            return tree;
        }
    }]);
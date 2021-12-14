/**
 * MIT License
 *
 *    Copyright (c) 2016-2022 June07
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
'use strict'

let ngApp = angular.module('NimDevToolsPanelApp', []);
ngApp
    .directive('onError', function() {  
        return {
        restrict:'A',
        link: function(scope, element, attr) {
            element.on('error', function() {
            element.attr('src', attr.onError);
            })
        }
        }
    })
    .controller('nimDevToolsPanelController', ['$scope', '$window', function ($scope, $window) {
        $scope.bg = $window.chrome.extension.getBackgroundPage().angular.element('#nim').scope();
        $scope.bg.localize($window, function () { });

        let $ = $window.$,
            chrome = $window.chrome;

        let backgroundPageConnection = chrome.runtime.connect({
            name: "devtools-panel"
        });
        backgroundPageConnection.postMessage({
            name: 'init',
            tabId: chrome.devtools.inspectedWindow.tabId
        });
        window.addEventListener('message', event => {
            backgroundPageConnection.postMessage({
                name: event.data.name,
                tabId: event.data.tabId
            });
        });
        backgroundPageConnection.onMessage.addListener(message => {
            function loadMessages() {
                if ($scope.bg.nodeReportSortedMessages) {
                    $scope.$apply();
                    Promise.all(
                        Object.entries($scope.bg.nodeReportSortedMessages).map(kv => {
                            let host = kv[0],
                                messages = kv[1];
                            return updateJSONTree(formatJSONTreeData({host, messages}))
                        })
                    ).then(() => {
                        $('.collapsible').collapsible();
                        $scope.$apply();
                    });
                }
            }
            switch (message.event) {
                case 'newNodeReportMessage':
                    loadMessages(); break;
                case 'brakecode-logged-in':
                    $scope.$apply();
                    $('ul.tabs').tabs();
                    $('.dropdown-chip').dropdown({
                        inDuration: 300,
                        outDuration: 225,
                        constrainWidth: false, // Does not change width of dropdown to that of the activator
                        hover: true, // Activate on hover
                        coverTrigger: false, // Displays dropdown below the button
                        alignment: 'left' // Displays dropdown with edge aligned to the left of button
                    });
                    loadMessages(); break;
                case 'brakecode-login-cancelled':
                    $scope.$apply(); break;
                case 'options-updated':
                    $scope.$apply();
                    loadMessages(); break;
            }
        });
        $($window.document).ready(function () {
            $('ul.tabs').tabs();
            $('.dropdown-chip').dropdown({
                inDuration: 300,
                outDuration: 225,
                constrainWidth: false, // Does not change width of dropdown to that of the activator
                hover: true, // Activate on hover
                coverTrigger: false, // Displays dropdown below the button
                alignment: 'left' // Displays dropdown with edge aligned to the left of button
            });
            if ($scope.bg.nodeReportSortedMessages) {
                $scope.$apply();
                Promise.all(
                    Object.entries($scope.bg.nodeReportSortedMessages).map(kv => {
                        let host = kv[0],
                            messages = kv[1];
                        return updateJSONTree(formatJSONTreeData({host, messages}))
                    })
                ).then(() => {
                    $('.collapsible').collapsible();
                    $scope.$apply();
                });
            }
            $.contextMenu({
                selector: 'span.fancytree-title',
                items: {
                    download: {
                        name: 'Download Diagnostic Report(s)',
                        className: 'icon-download',
                        callback: function(key, opt) {
                            let nodes = getSelectedReports();
                            if (nodes.length > 0) {
                                save(nodes);
                            } else {
                                let node = $.ui.fancytree.getNode(opt.$trigger);
                                save(node);
                            }
                        }
                    }
                }
            })
        });
        $scope.login = function() {
            $scope.bg.$emit('brakecode-login');
        }
        $scope.logout = function() {
            $scope.bg.$emit('brakecode-logout');
        }
        $scope.openOptionsPage = function() {
            chrome.runtime.openOptionsPage();
        }
        function formatJSONTreeData(instance) {
            let { host, messages } = instance;
            let mapped = messages.map(m => m.report);
            mapped = mapped.filter(report => report).map(report => ({
                title: ` ${report.id.split(/ +/)[1]}`,
                icon: 'icon-clipboard',
                children: formatNode(report, 0, 'root') }));
            return { host, mapped };
        }
        function createJSONTree(instance) {
            let { host, mapped } = instance;
            $scope.bg.fancytrees[`jstree-${host}`] = $(`[id="jstree-${host}"]`).fancytree({
                checkbox: true,
                checkboxAutoHide: true,
                source: mapped
            });
        }
        function getSelectedReports() {
            let selected = Object.keys($scope.bg.nodeReportSortedMessages).map(host => {
                let selected = $.ui.fancytree.getTree($(`[id="jstree-${host}"]`)).getSelectedNodes();
                return selected.length > 0 ? { host, selected } : null;
            }).filter(item => item);
            return selected;
        }
        function updateJSONTree(instance) {
            return new Promise(resolve => {
                let { host, mapped } = instance;
                let tree = $.ui.fancytree.getTree($(`[id="jstree-${host}"]`));

                if (tree) {
                    let root = tree.getRootNode();
                    let rootChildren = root ? root.getChildren() : [];
                    if (rootChildren) {
                        // filter out the children already part of the tree, and only add new children 
                        mapped.filter(node => !rootChildren.find(child => child.title.match(node.title)))
                        .map(node => {
                            root.addChildren(node);
                        });
                        while (root.countChildren(false) >= $scope.bg.settings.diagnosticReports.maxMessages) {
                            root.getFirstChild().remove();
                        }
                    }
                    resolve();
                } else {
                    createJSONTree(instance);
                    resolve();
                }
            });
        }
        function save(nodes) {
            let timestamp, message, blob;
            if (!(nodes instanceof Array)) {
                timestamp = nodes.title.trim();
                message = $scope.bg.nodeReportMessages.find(m => m.report.id.endsWith(timestamp));
                blob = new Blob([JSON.stringify(message.report)], { type: 'text/json' });
                $window.saveAs(blob, `NodeJSDiagnosticReport-${timestamp}.json`);
            } else {
                nodes.map(node => {
                    node.selected.map(payload => {
                        timestamp = payload.title.trim();
                        message = $scope.bg.nodeReportMessages.find(m => m.report.id.endsWith(timestamp));
                        blob = new Blob([JSON.stringify(message.report)], { type: 'text/json' });
                        $window.saveAs(blob, `NodeJSDiagnosticReport-${node.host}-${timestamp}.json`);
                    });
                });
            }
        }
        function formatNode(node, depth, parent) {
            let tree = Object.entries(node).map(kv => {
                let key = kv[0],
                    value = kv[1];
                switch (key) {
                    default:
                        if (value && (value.constructor.name === 'Object' || value.constructor.name === 'Array')) {
                            return {
                                title: ` <span class="node_report_key">${key}</span>`,
                                expanded: parent.match(/networkInterfaces|inspect/) ? true : false,
                                children: formatNode(value, ++depth, key)
                            }
                        } else if (value === null) {
                            return {
                                title: ` <span class="node_report_key">${key}</span>`,
                            }
                        } else if (value.constructor.name && key.constructor.name === 'String') {
                            return {
                                key,
                                title: ` <span class="node_report_key">${key}</span> : <span class="node_report_value">${value}</span>`,
                            }
                        } else if (value.constructor.name) {
                            return {
                                title: ` ${key}`,
                                children: [{
                                    title: ` ${value}`,
                                    icon: 'icon-wrench'
                                }]
                            }
                        }
                }
            });
            return tree;
        }
    }]);
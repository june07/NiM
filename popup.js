/* eslint-disable no-undef */

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
var ngApp = angular.module('NimPopupApp', ['angularMoment']);
ngApp
    .config([
        '$compileProvider',
        function ($compileProvider) {
            $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension):/);
            $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension):/);
        }
    ])
    .filter('stringLimit', ['$filter', function ($filter) {
        return function (input, limit, wordBoundry) {
            if (!input) return;
            if (input.length <= limit && limit > 0) {
                return input;
            }
            var limitedString = $filter('limitTo')(input, Math.abs(limit));
            if (limit < 0)
                return input.substring(limitedString.lastIndexOf(" ") + 1, input.length)
            if (wordBoundry)
                return limitedString.substring(0, limitedString.lastIndexOf(" "))
            return limitedString + '...';
        };
    }])
    .filter('nodeProgram', function () {
        return (cmd) => {
            return cmd;
            /*
            if (!cmd) return '';
            let parts = cmd.match(/([^\s\\\/:*?\"<>|]+).js/);
            if (!parts) {
                parts = cmd.match(/node\s+([^\s:*?\"<>|]+)/);
                parts = parts ? parts[0].match(/([^\s\\\/:*?\"<>|]+)$/) : parts;
            }
            let filename = parts ? parts[0] : cmd;
            return filename;*/
        };
    })
    .controller('nimPopupController', ['$scope', '$window', '$interval', function ($scope, $window, $interval) {
        let staticTooltips = {},
            activeTooltips = {},
            dynamicTooltips = {};
        let bgWindow = $window.chrome.extension.getBackgroundPage();
        let controllerElement = bgWindow.document.querySelector('body');
        let chrome = $window.chrome,
            $ = $window.$;
        $scope.bg = bgWindow.angular.element(controllerElement).scope();
        $scope.sortType = 'date';
        $scope.sortReverse = true;
        $scope.active = "none";
        $scope.bg.localize($window, function () { });
        $scope.messageModalState = "closed";
        $window.$scope = $scope;

        function startTabUpdateWatcher() {
            $scope.tabUpdateWatcher = $interval(() => {
                $scope.bg.updatePopupSessionsTabs();
            }, 5000);
        }
        $scope.openModal = function () {
            $.notify.close();
            $scope.pn.next("wait");
        }
        $scope.clickHandler = function () {
            $scope.bg.save("host");
            $scope.bg.save("port");
            $scope.bg.openTab($scope.bg.settings.host, $scope.bg.settings.port, function (error, result) {
                if (error && typeof error === "string") {
                    showErrorMessage({error});
                    if (error === 'DevTools is already open.') $scope.bg.tabNotification({ host: $scope.bg.settings.host, port: $scope.bg.settings.port });
                } else if (error && typeof error === "object" && error.message) {
                    showErrorMessage({message: error.message});
                } else if (error && error.statusText) {
                    showErrorMessage({statusText: error.statusText});
                } else if (error && error.status) {
                    showErrorMessage({status: error.status});
                } else {
                    $scope.message = result;
                }
            });
        };
        $scope.clickHandlerOpenRemoteDevTools = function (tunnelPort) {
            $scope.bg.openTab($scope.bg.NiMSConnector.PADS_HOST, tunnelPort, { wsProto: 'wss', port: tunnelPort }, function (error, result) {
                if (error && typeof error === "string") {
                    showErrorMessage({error});
                    if (error === 'DevTools is already open.') $scope.bg.tabNotification({ host: $scope.bg.NiMSConnector.PADS_HOST, port: tunnelPort });
                } else if (error && typeof error === "object" && error.message) {
                    showErrorMessage({message: error.message});
                } else if (error && error.statusText) {
                    showErrorMessage({statusText: error.statusText});
                } else if (error && error.status) {
                    showErrorMessage({status: error.status});
                } else {
                    $scope.message = result;
                }
            });
        }
        $scope.clickHandlerOpenLocalDevTools = function (translatedURL) {
            let localHost = translatedURL.split(/ws=(.*)\//)[1].split(':')[0];
            let localPort = translatedURL.split(/ws=(.*)\//)[1].split(':')[1];
            $scope.bg.openTab(localHost, localPort, function (error, result) {
                if (error && typeof error === "string") {
                    showErrorMessage(error);
                    if (error === 'DevTools is already open.') $scope.bg.tabNotification({ host: localHost, port: localPort });
                }
                if (error && typeof error === "object" && error.message) showErrorMessage(error.message);
                if (error) showErrorMessage(`${error.status} ${error.statusText}`);
                else $scope.message = result;
            });
        }
        $scope.waiting = (conn, bool) => {
            conn.waiting = bool ? { running: 'Signaling Node Process...' } : '';
            return conn;
        }
        $scope.clickHandlerStartNodeInspect = function (host, conn) {
            $scope.waiting(conn, true);
            return $scope.bg.NiMSConnector.startNodeInspect(host, conn.pid)
                .then((response) => {
                    $window.setTimeout(() => {
                        // Timeout is there for show
                        conn = $scope.waiting(conn, false);
                        conn.inspectPort = response.socket.split(':')[1];
                        $scope.$apply();
                    }, 1000);
                });
        }
        $scope.bg.$on('updatedRemoteTabs', () => {
            if (angular.equals($scope.remoteTabs, $scope.bg.remoteTabs)) return;
            $scope.remoteTabs = $scope.bg.remoteTabs;
            updateRemoteConnectionSettings();
            //$scope.$apply();
            initTooltips();
            //$scope.$apply();
        });
        $scope.bg.$on('updateLocalTabSessions', () => {
            if (angular.equals($scope.localTabs, $scope.bg.localSessions)) return;
            $scope.localTabs = $scope.bg.localSessions;
            //$scope.$apply();
            initTooltips();
            //$scope.$apply();
        });
        $scope.bg.$on('updateBrakeCodeTabSessions', () => {
            if ($scope.remoteTabs && $scope.bg.remoteTabs && angular.equals($scope.remoteTabs[0], $scope.bg.remoteTabs[0])) return;
            if (!$scope.remoteTabs) $scope.remoteTabs = [ $scope.bg.remoteTabs[0] ];
            else $scope.remoteTabs[0] = $scope.bg.remoteTabs[0];
            //$scope.$apply();
        });
        $scope.bg.$on('brakecode-logged-in', () => {
            $scope.$apply();
            initDropdown();
        });
        $scope.clickHandlerRemoveLocalDevToolsSession = function (sessionID) {
            $scope.bg.removeLocalSession(sessionID)
        }
        $scope.clickHandlerRemoveRemoteDevToolsSession = function (cid) {
            $scope.bg.removeRemoteSession(cid);
        }
        $scope.autoSwitchHandler = function () {
            $scope.bg.save("auto");
            if ($scope.bg.auto) $scope.bg.watchdog.reset();
        }
        $scope.track = function (url) {
            $window._gaq.push(['_trackPageview', url]);
        };
        $scope.trackTwitterClicks = function (id) {
            $window._gaq.push(['_trackEvent', 'Social Event', 'Link Click', 'https://twitter.com/june07t/status/' + id, undefined, true]);
        };
        $scope.getPADSURL = function (tunnelSocket) {
            if (!tunnelSocket) return '';
            return tunnelSocket.cid ? `${$scope.bg.NiMSConnector.PADS_SERVER}/json/${tunnelSocket.cid}` : '';
        }
        $scope.activeRemoteSession = function (cid) {
            let session = $scope.bg.brakeCodeSessions.find(session => session.infoUrl.match($scope.bg.UUID_Regex) && (session.infoUrl.match($scope.bg.UUID_Regex)[0] === cid));
            return session;
        }
        function showErrorMessage(error) {
            let { status, statusText, message } = error,
                html;
            
            if (message) {
                html = `<i class="icon-alert"></i><br>${message}`;
            } else if (statusText) {
                html = `<i class="icon-alert"></i><br>
                    ${statusText}<br>
                    <span class="statusCode">Code: ${status}<span>`
            } else if (status) {
                html = `<i class="icon-alert"></i><br>${status}`;
            } else if (error) {
                html = `<i class="icon-alert"></i><br>${error}`;
            }
            $window.document.querySelector('#site-href').style.display = "none";
            M.toast({
                html,
                displayLength: 5000,
                completeCallback: () => {
                    $window.document.querySelector('#site-href').style.display = "inline";
                }
            });
        }
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
        $window.document.querySelector('#modal1 > div.modal-header > span.close-x').addEventListener('click', function () {
            $('#modal1').modal('close');
        });
        $window.document.querySelector('#modal2 > div.modal-header > span.close-x').addEventListener('click', function () {
            $('#modal2').modal('close');
        });
        $window.document.querySelector('#modal3 > div.modal-header > span.close-x').addEventListener('click', function () {
            $('#modal3').modal('close');
        });
        $window.document.querySelector('#modal4 > div.modal-header > span.close-x').addEventListener('click', function () {
            $('#modal4').modal('close');
        });
        $window.document.querySelector('#options-button').addEventListener('click', function () {
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
            ready: function () {
                $scope.bg.localize($window, function () { });
                $scope.messageModalState = "open";
                if ($scope.notify) $scope.notify.close();
            }
        });
        new PerfectScrollbar('#modal1');
        new PerfectScrollbar('#modal2');
        $scope.openOptionsPage = function () {
            if (chrome.runtime.openOptionsPage) {
                // New way to open options pages, if supported (Chrome 42+).
                chrome.runtime.openOptionsPage();
            } else {
                // Reasonable fallback.
                $window.open(chrome.runtime.getURL('options.html'));
            }
        };
        function updateRemoteConnectionSettings() {
            $scope.remoteTabs.map(tab => {
                let connections = Object.values(tab.connections).length > 0 ? Object.values(tab.connections) : [];
                connections.map(connection => {
                    if (connection.tunnelSocket && connection.tunnelSocket.cid && !$scope.bg.remoteConnectionSettings[connection.tunnelSocket.cid]) {
                        $scope.bg.remoteConnectionSettings[connection.tunnelSocket.cid] = {
                            auto: false
                        }
                    }
                });
            });
        }
        function initTooltips() {
            let tooltipElements = document.querySelectorAll('.tooltipped');
            $scope.tooltips = Array.from(tooltipElements)
                .filter(tooltipElement => !tooltipElement.M_Tooltip || tooltipElement.M_Tooltip && tooltipElement.M_Tooltip.options.exitDelay != 667000)
                .filter(tooltipElement => !staticTooltips[tooltipElement.dataset.tooltip || tooltipElement.dataset.tooltipHtml])
                .filter(tooltipElement => !dynamicTooltips[tooltipElement.dataset.tooltip || tooltipElement.dataset.tooltipHtml]).map(tooltipElement => {
                let tip = M.Tooltip.init(tooltipElement, {
                    position: 'top',
                    opacity: 0.9,
                    html: tooltipElement.dataset.tooltipHtml ? document.querySelector(`[id='${tooltipElement.dataset.tooltipHtml}']`).innerHTML : undefined
                });
                tip.tooltipEl.id = tooltipElement.id
                tip.el.addEventListener('click', tooltipClickHandler);
                if (tooltipElement.classList.contains('staticTooltip')) {
                    staticTooltips[tooltipElement.dataset.tooltip] = tooltipElement;
                } else {
                    dynamicTooltips[tooltipElement.dataset.tooltipHtml] = tooltipElement;
                }
                return tip;
            });
        }
        function initDropdown() {
            $('.dropdown-chip').dropdown({
                inDuration: 300,
                outDuration: 225,
                constrainWidth: false, // Does not change width of dropdown to that of the activator
                hover: true, // Activate on hover
                coverTrigger: false, // Displays dropdown below the button
                alignment: 'left' // Displays dropdown with edge aligned to the left of button
            });
        }
        function tooltipClickHandler(event) {
            let tip = event.currentTarget.M_Tooltip;
            activeTooltips[tip.tooltipEl.id] = tip;
            event.currentTarget.M_Tooltip.tooltipEl.style.pointerEvents = 'all';
            tip.options.exitDelay = 667000;
            tip.tooltipEl.addEventListener("mouseleave", tooltipMouseleaveHandler);
        }
        function tooltipMouseleaveHandler(event) {
            let tip = activeTooltips[event.currentTarget.id];
            tip.tooltipEl.style.pointerEvents = 'none';
            tip.options.exitDelay = 0;
            tip.open();
            tip.close();
            tip.tooltipEl.removeEventListener('mouseleave', tooltipMouseleaveHandler);
        }
        angular.element(function () {
            var navigation = document.querySelector('.fixed-action-btn');
            M.FloatingActionButton.init(navigation, {
                direction: 'left',
                hoverEnabled: false
            });
            initTooltips();
            
        });
        $scope.getTooltipContent = function (tooltipElement) {
            let message;
            switch (tooltipElement) {
                case 'tooltip_githubNodejsNodeIssues24085': message = chrome.i18n.getMessage("githubNodejsNodeIssues24085"); break;
                case 'tooltip_templateAutoResumeSwitch': message = chrome.i18n.getMessage("autoStepping"); break;
                case 'tooltip_templateAutoSwitchAlert': message = chrome.i18n.getMessage("runawayTabs"); break;
            }
            return message;
        }
        $($window.document).ready(() => {
            startTabUpdateWatcher();
            if ($scope.bg.settings.nimsVscode.enabled) $scope.bg.NiMSVSCodeConnector.check();
            $('ul.tabs').tabs({
                onShow: tab => {
                    $scope.bg.state.popup.selectedTab = tab.id;
                    $scope.$apply();
                    if ($scope.bg.localSessions.length === 0) $scope.initConnectionErrorMessage();
                }
            });
            if ($scope.bg.localSessions.length === 0) $scope.initConnectionErrorMessage();
            initDropdown();
        });
        $scope.initConnectionErrorMessage = function () {
            $('.ml11').each((i, el) => {
                if (!el.classList.contains('pretty')) {
                    $(el).addClass('pretty');
                    $('.ml11 .letters').each(function () {
                        let untranslated = $(this).text().split(' ');
                        let translated = untranslated[0] + ' ' + $window.chrome.i18n.getMessage(untranslated[1]);
                        $(this).html(translated.replace(/([^\x00-\x80]|\w)/g, "<span class='letter'>$&</span>").replace(/(^\| )/, "<blink class='carat'>$&</blink>"));
                    });
                    $window.anime.timeline({ loop: true })
                        .add({
                            targets: '.ml11 .line',
                            scaleY: [0, 1],
                            opacity: [0.5, 1],
                            easing: "easeOutExpo",
                            duration: 700
                        })
                        .add({
                            targets: '.ml11 .line',
                            translateX: [0, $(".ml11 .letters").width()],
                            easing: "easeOutExpo",
                            duration: 700,
                            delay: 100
                        })
                        .add({
                            targets: '.ml11 .letter',
                            opacity: [0, 1],
                            easing: "easeOutExpo",
                            duration: 600,
                            offset: '-=775',
                            delay: function (el, i) {
                                return 34 * (i + 1)
                            }
                        })
                        .add({
                            targets: '.ml11',
                            opacity: 0,
                            duration: 1000,
                            easing: "easeOutExpo",
                            delay: 1000
                        });
                }
            });
        }
        $scope.logout = function() {
            $scope.bg.$emit('brakecode-logout');
        }
        $scope.login = function() {
            $scope.bg.$emit('brakecode-login');
        }
    }]);
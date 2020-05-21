/**
 * MIT License
 *
 *    Copyright (c) 2016-2020 June07
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
  function($compileProvider) {   
    $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension):/);
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension):/);
  } 
])
.filter('stringLimit', ['$filter', function($filter) {
   return function(input, limit, wordBoundry) {
      if (! input) return;
      if (input.length <= limit && limit > 0) {
          return input;
      }
      var limitedString = $filter('limitTo')(input, Math.abs(limit));
      if (limit < 0)
        return input.substring(limitedString.lastIndexOf(" ")+1, input.length)
      if (wordBoundry)
        return limitedString.substring(0, limitedString.lastIndexOf(" "))
      return limitedString + '...';
   };
}])
.filter('nodeProgram', function() {
    return (cmd) => {
      let parts = cmd.split(' ');
      return parts[parts.length-1];
    };
})
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
    
    $scope.openModal = function() {
      $.notify.close();
      $scope.pn.next("wait");
    }
    $scope.clickHandler = function () {
        $scope.bg.save("host");
        $scope.bg.save("port");
        $scope.bg.openTab($scope.bg.settings.host, $scope.bg.settings.port, function (error, result) {
            if (error && typeof error === "string") {
              showErrorMessage(error);
              if (error === 'DevTools is already open.') $scope.bg.tabNotification({host: $scope.bg.settings.host, port: $scope.bg.settings.port});
            }
            if (error) showErrorMessage(error.statusText);
            else
              $scope.message = result;
        });
    };
    $scope.clickHandlerOpenRemoteDevTools = function(port, tunnelPort) {
      $scope.bg.openTab($scope.bg.NiMSConnector.N2P_SOCKET, tunnelPort, { wsProto: 'wss', port: port }, function (error, result) {
        if (error && typeof error === "string") {
          showErrorMessage(error);
          if (error === 'DevTools is already open.') $scope.bg.tabNotification({host: $scope.bg.NiMSConnector.N2P_SOCKET.split(':')[0], port: tunnelPort});
        }
        if (error && typeof error === "object" && error.message) showErrorMessage(error.message);
        if (error) showErrorMessage(error.statusText);
        else $scope.message = result;
      });
    }
    $scope.clickHandlerOpenLocalDevTools = function(translatedURL) {
      let localHost = translatedURL.split(/ws=(.*)\//)[1].split(':')[0];
      let localPort = translatedURL.split(/ws=(.*)\//)[1].split(':')[1];
      $scope.bg.openTab(localHost, localPort, function (error, result) {
        if (error && typeof error === "string") {
          showErrorMessage(error);
          if (error === 'DevTools is already open.') $scope.bg.tabNotification({host: localHost, port: localPort});
        }
        if (error && typeof error === "object" && error.message) showErrorMessage(error.message);
        if (error) showErrorMessage(error.statusText);
        else $scope.message = result;
      });
    }
    $scope.waiting = (conn, bool) => {
      conn.waiting =  bool ? { running: 'Signaling Node Process...' }: '';
      return conn;
    }
    $scope.clickHandlerStartNodeInspect = function(host, conn) {
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
    $scope.bg.$on('updatedRemoteTabs', (args) => {
      //console.dir(args);
      $scope.remoteTabs = $scope.bg.remoteTabs;
      $scope.$apply();
      $scope.tippyTips = $window.tippy('.tippy');
    });
    $scope.clickHandlerRemoveLocalDevToolsSession = function(sessionID) {
      $scope.bg.removeLocalSession(sessionID)
    }
    $scope.switchHandler = function() {
        $scope.bg.save("auto");
    }
    $scope.track = function (url) {
        $window._gaq.push(['_trackPageview', url]);
    };
    $scope.trackTwitterClicks = function (id) {
        $window._gaq.push(['_trackEvent', 'Social Event', 'Link Click', 'https://twitter.com/june07t/status/' + id, undefined, true]);
    };
    function showErrorMessage(error) {
      $window.document.querySelector('#site-href').style.display = "none";
      $window.Materialize.toast(error, 5000);
      var siteHrefTimeout;
      if (siteHrefTimeout) clearTimeout(siteHrefTimeout);
      siteHrefTimeout = setTimeout(function() {
        $window.document.querySelector('#site-href').style.display = "inline";
      }, 5050)
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
    $window.document.querySelector('#modal1 > div.modal-header > button').addEventListener('click', function() {
      $('#modal1').modal('close');
    });
    $window.document.querySelector('#modal2 > div.modal-header > button').addEventListener('click', function() {
      $('#modal2').modal('close');
    });
    $window.document.querySelector('#modal3 > div.modal-header > button').addEventListener('click', function() {
      $('#modal3').modal('close');
    });
    $window.document.querySelector('#modal4 > div.modal-header > button.close').addEventListener('click', function() {
      $('#modal4').modal('close');
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
        $scope.bg.localize($window, function() {});
        $scope.messageModalState = "open";
        if ($scope.notify) $scope.notify.close();
      }
    });
    $('#modal1').perfectScrollbar();
    $('#modal2').perfectScrollbar();
    $scope.openOptionsPage = function() {
      if (chrome.runtime.openOptionsPage) {
        // New way to open options pages, if supported (Chrome 42+).
        chrome.runtime.openOptionsPage();
      } else {
        // Reasonable fallback.
        $window.open(chrome.runtime.getURL('options.html'));
      }
    };
    $($window.document).ready(() => {
      if ($scope.bg.settings.nimsVscode.enabled) $scope.bg.NiMSVSCodeConnector.check();
      $('ul.tabs').tabs({ onShow: (tab) => {
        $scope.bg.updateLocalSessions();
        $scope.bg.state.popup.selectedTab = tab[0].id;
        $scope.$apply();
        $scope.initTippyTips();
        $scope.initConnectionErrorMessage();
      }});
      $window.tippy.setDefaultProps({
        allowHTML: true,
        theme: 'nim',
        placement: 'bottom',
        interactive: false,
        hideOnClick: 'toggle'
      })
      $scope.initTippyTips();
      $scope.initConnectionErrorMessage();
    });
    $scope.initTippyTips = function() {
      $scope.tippyTips = $window.tippy('.tippy');
      $scope.tippyTips.forEach((tip) => {
        let el = document.querySelector('[id^=' + tip.props.content.substring(1) + ']');
        switch (tip.props.content) {
          case '#tippyTemplateGithubNodejsNodeIssues24085':
            tip.setProps({
              trigger: 'click',
              theme: 'githubNodejsNodeIssues24085',
              placement: 'top',
              size: 'large'
            });
            tip.setContent(el); break;
          case '#tippyTemplateAutoResumeSwitch':
            tip.setProps({
              placement: 'top',
              theme: 'short',
              content: `Will auto resume stepping when <i>--inspect-brk</i> flag is used.`
            }); break;
          default: tip.setContent(el);
        }
      });
    }
    $scope.showTippy = function(event) {
      let parent = event.currentTarget;
      let tip = parent._tippy;
      tip.setProps({interactive: true});
      tip.popper.addEventListener("mouseleave", (event) => {
        event.currentTarget._tippy.hide();
        event.currentTarget._tippy.set({interactive: false});
      });
    }
    $scope.initConnectionErrorMessage = function() {
      $('.ml11').each((i, el) => {
        if (!el.classList.contains('pretty')) {
          $(el).addClass('pretty');
          $('.ml11 .letters').each(function(){
            $(this).html($(this).text().replace(/([^\x00-\x80]|\w)/g, "<span class='letter'>$&</span>").replace(/(^\| )/, "<blink class='carat'>$&</blink>"));
          });
          $window.anime.timeline({loop: true})
          .add({
            targets: '.ml11 .line',
            scaleY: [0,1],
            opacity: [0.5,1],
            easing: "easeOutExpo",
            duration: 700
          })
          .add({
            targets: '.ml11 .line',
            translateX: [0,$(".ml11 .letters").width()],
            easing: "easeOutExpo",
            duration: 700,
            delay: 100
          }).add({
            targets: '.ml11 .letter',
            opacity: [0,1],
            easing: "easeOutExpo",
            duration: 600,
            offset: '-=775',
            delay: function(el, i) {
              return 34 * (i+1)
            }
          }).add({
            targets: '.ml11',
            opacity: 0,
            duration: 1000,
            easing: "easeOutExpo",
            delay: 1000
          });
        }
      });
    }
}]);
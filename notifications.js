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
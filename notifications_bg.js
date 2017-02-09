/**
        setInterval(function() {
            $scope.timerNotification++;
            if ($scope.timerNotification >= NOTIFICATION_CHECK_INTERVAL && $scope.timerNotification % NOTIFICATION_CHECK_INTERVAL === 0) {
                $.get('https://june07.github.io/nim/notifications/'+NOTIFICATION_FILE+'.hmac', function(hmac) {
                    if (hmac.toLowerCase() !== $scope.settings.notifications.lastHMAC) {
                        $.get("https://june07.github.io/nim/notifications/"+NOTIFICATION_FILE+".json", function(data) {
                            saveNotifications(data);
                        });
                    }
                });
            }
        }, NOTIFICATION_CHECK_RESOLUTION);

        function saveNotifications(data, callback) {
            if (! $scope.notifications || $scope.notifications.length === 0) {
                $scope.notifications = data;
            } else {
                $scope.notifications = $scope.notifications.concat(data);
            }
            $.get("http://hook.io/june07/hmac?key="+HOOKIO_SECRET+"&data="+btoa(JSON.stringify(data)), function(response) {
                $scope.settings.notifications.lastHMAC = response.split(':')[1].trim();
            });
            $scope.notifications.sort(function(a, b) {
                if (a.id < b.id) return -1;
                if (a.id > b.id) return 1;
                if (a.id === b.id) {
                    if (a.read && b.read) return 0;
                    if (a.read) return -1
                    return 1
                }
            });
            var uniqueNotificationsKeepingRead = [];
            var unreadFlag = true;
            $scope.notifications.forEach(function(notification, index, notifications) {
                if (((notifications.length > 0) && (index === 0)) || ((notifications.length > 0) && (index > 0) && (notification.id === notifications[index-1].id))) {
                    if (notification.read) uniqueNotificationsKeepingRead.push(notification);
                    else unreadFlag = false;
                } else {
                    uniqueNotificationsKeepingRead.push(notification);
                }
                if (index+1 === (notifications.length)) {
                    if (unreadFlag) chrome.browserAction.setBadgeText({ text:"note" });
                    else chrome.browserAction.setBadgeText({ text:"" });
                    $scope.notifications = uniqueNotificationsKeepingRead;
                    $scope.write('notifications', $scope.notifications);
                    $scope.$emit('notification-update');
                }
            });
        } */
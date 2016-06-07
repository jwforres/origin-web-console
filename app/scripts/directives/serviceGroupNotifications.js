'use strict';

angular.module('openshiftConsole')
  .directive('serviceGroupNotifications', function($filter, Navigate) {
    return {
      restrict: 'E',
      scope: {
        service: '=',
        childServices: '=',
        deploymentConfigsByService: '=',
        deploymentsByService: '=',
        podsByDeployment: '='
      },
      templateUrl: '/views/directives/service-group-notifications.html',
      link: function($scope) {
        var hasHealthChecks = $filter('hasHealthChecks');
        var alerts = $scope.alerts = {};
        var svcs = [];
        var setDCNotifications = function() {
           _.each(svcs, function(svc) {
            // Get notifications for DCs in this service group
            if ($scope.deploymentConfigsByService) {
              _.each($scope.deploymentConfigsByService[svc.metadata.name], function(dc) {
                if (!hasHealthChecks(dc.spec.template)) {
                  alerts["health_checks" + dc.metadata.uid] = {
                    type: "info",
                    message: dc.metadata.name + " has containers without health checks, which ensure your application is running correctly.",
                    links: [{
                      href: Navigate.healthCheckURL(dc.metadata.namespace, "DeploymentConfig", dc.metadata.name),
                      label: "Add health checks"
                    }]
                  };
                }
                else {
                  delete alerts["health_checks" + dc.metadata.uid];
                }
              });
            }
          });         
        };
        
        var setDeploymentNotifications = function() {
          var groupedPodWarnings = {};
          // clear out pod warning alerts
          _.each(alerts, function(alert, alertId) {
            if (alertId.indexOf("pod_warning") >= 0) {
              delete alert[alertId];
            }
          });
          _.each(svcs, function(svc) {
            // Get notifications for deployments in this service group
            if ($scope.deploymentsByService && $scope.podsByDeployment) {
              _.each($scope.deploymentsByService[svc.metadata.name], function(deployment) {
                $filter('groupedPodWarnings')($scope.podsByDeployment[deployment.metadata.name], groupedPodWarnings);
              });
            }        
          });
          _.each(groupedPodWarnings, function(podWarnings, groupId) {
            if (podWarnings.length) {
              alerts["pod_warning"+groupId] = {
                type: "warning",
                message: podWarnings[0].message
              };
            }
          });
        };
        
        // TODO worried about how this will perform
        $scope.$watchGroup(['service', 'childServices'], function() {
          svcs = ($scope.childServices || []).concat([$scope.service]);
          setDCNotifications();
          setDeploymentNotifications();
        });
        $scope.$watch('deploymentConfigsByService', function() {
          setDCNotifications();
        });
        $scope.$watchGroup(['podsByDeployment', 'deploymentsByService'], function() {
          setDeploymentNotifications();
        });
      }
    };
  });
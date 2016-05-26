'use strict';

angular.module("openshiftConsole")
  .factory("DeploymentsService", function(DataService, $filter, LabelFilter){
    function DeploymentsService() {}

    DeploymentsService.prototype.startLatestDeployment = function(deploymentConfig, context, $scope) {
      // increase latest version by one so starts new deployment based on latest
      var req = {
        kind: "DeploymentConfig",
        apiVersion: "v1",
        metadata: deploymentConfig.metadata,
        spec: deploymentConfig.spec,
        status: deploymentConfig.status
      };
      if (!req.status.latestVersion) {
        req.status.latestVersion = 0;
      }
      req.status.latestVersion++;

      // update the deployment config
      DataService.update("deploymentconfigs", deploymentConfig.metadata.name, req, context).then(
        function() {
          $scope.alerts = $scope.alerts || {};
          $scope.alerts["deploy"] =
            {
              type: "success",
              message: "Deployment #" + req.status.latestVersion + " of " + deploymentConfig.metadata.name + " has started.",
            };
        },
        function(result) {
          $scope.alerts = $scope.alerts || {};
          $scope.alerts["deploy"] =
            {
              type: "error",
              message: "An error occurred while starting the deployment.",
              details: $filter('getErrorDetails')(result)
            };
        }
      );
    };

    DeploymentsService.prototype.retryFailedDeployment = function(deployment, context, $scope) {
      var req = angular.copy(deployment);
      var deploymentName = deployment.metadata.name;
      var deploymentConfigName = $filter('annotation')(deployment, 'deploymentConfig');
      // TODO: we need a "retry" api endpoint so we don't have to do this manually

      // delete the deployer pod as well as the deployment hooks pods, if any
      DataService.list("pods", context, function(list) {
        var pods = list.by("metadata.name");
        var deleteDeployerPod = function(pod) {
          var deployerPodForAnnotation = $filter('annotationName')('deployerPodFor');
          if (pod.metadata.labels[deployerPodForAnnotation] === deploymentName) {
            DataService.delete("pods", pod.metadata.name, $scope).then(
              function() {
                Logger.info("Deployer pod " + pod.metadata.name + " deleted");
              },
              function(result) {
                $scope.alerts = $scope.alerts || {};
                $scope.alerts["retrydeployer"] =
                  {
                    type: "error",
                    message: "An error occurred while deleting the deployer pod.",
                    details: $filter('getErrorDetails')(result)
                  };
              }
            );
          }
        };
        angular.forEach(pods, deleteDeployerPod);
      });

      // set deployment to "New" and remove statuses so we can retry
      var deploymentStatusAnnotation = $filter('annotationName')('deploymentStatus');
      var deploymentStatusReasonAnnotation = $filter('annotationName')('deploymentStatusReason');
      var deploymentCancelledAnnotation = $filter('annotationName')('deploymentCancelled');
      req.metadata.annotations[deploymentStatusAnnotation] = "New";
      delete req.metadata.annotations[deploymentStatusReasonAnnotation];
      delete req.metadata.annotations[deploymentCancelledAnnotation];

      // update the deployment
      DataService.update("replicationcontrollers", deploymentName, req, context).then(
        function() {
          $scope.alerts = $scope.alerts || {};
          $scope.alerts["retry"] =
            {
              type: "success",
              message: "Retrying deployment " + deploymentName + " of " + deploymentConfigName + ".",
            };
        },
        function(result) {
          $scope.alerts = $scope.alerts || {};
          $scope.alerts["retry"] =
            {
              type: "error",
              message: "An error occurred while retrying the deployment.",
              details: $filter('getErrorDetails')(result)
            };
        }
      );
    };

    DeploymentsService.prototype.rollbackToDeployment = function(deployment, changeScaleSettings, changeStrategy, changeTriggers, context, $scope) {
      var deploymentName = deployment.metadata.name;
      var deploymentConfigName = $filter('annotation')(deployment, 'deploymentConfig');
      // put together a new rollback request
      var req = {
        kind: "DeploymentConfigRollback",
        apiVersion: "v1",
        spec: {
          from: {
            name: deploymentName
          },
          includeTemplate: true,
          includeReplicationMeta: changeScaleSettings,
          includeStrategy: changeStrategy,
          includeTriggers: changeTriggers
        }
      };

      // TODO: we need a "rollback" api endpoint so we don't have to do this manually

      // create the deployment config rollback
      DataService.create("deploymentconfigrollbacks", null, req, context).then(
        function(newDeploymentConfig) {
          // update the deployment config based on the one returned by the rollback
          DataService.update("deploymentconfigs", deploymentConfigName, newDeploymentConfig, context).then(
            function(rolledBackDeploymentConfig) {
              $scope.alerts = $scope.alerts || {};
              $scope.alerts["rollback"] =
                {
                  type: "success",
                  message: "Deployment #" + rolledBackDeploymentConfig.status.latestVersion + " is rolling back " + deploymentConfigName + " to " + deploymentName + ".",
                };
            },
            function(result) {
              $scope.alerts = $scope.alerts || {};
              $scope.alerts["rollback"] =
                {
                  type: "error",
                  message: "An error occurred while rolling back the deployment.",
                  details: $filter('getErrorDetails')(result)
                };
            }
          );
        },
        function(result) {
          $scope.alerts = $scope.alerts || {};
          $scope.alerts["rollback"] =
            {
              type: "error",
              message: "An error occurred while rolling back the deployment.",
              details: $filter('getErrorDetails')(result)
            };
        }
      );
    };

    DeploymentsService.prototype.cancelRunningDeployment = function(deployment, context, $scope) {
      var deploymentName = deployment.metadata.name;
      var deploymentConfigName = $filter('annotation')(deployment, 'deploymentConfig');
      var req = angular.copy(deployment);

      // TODO: we need a "cancel" api endpoint so we don't have to do this manually

      // set the cancellation annotations
      var deploymentCancelledAnnotation = $filter('annotationName')('deploymentCancelled');
      var deploymentStatusReasonAnnotation = $filter('annotationName')('deploymentStatusReason');
      req.metadata.annotations[deploymentCancelledAnnotation] = "true";
      req.metadata.annotations[deploymentStatusReasonAnnotation] = "The deployment was cancelled by the user";

      // update the deployment with cancellation annotations
      DataService.update("replicationcontrollers", deploymentName, req, context).then(
        function() {
          $scope.alerts = $scope.alerts || {};
          $scope.alerts["cancel"] =
            {
              type: "success",
              message: "Cancelling deployment " + deploymentName + " of " + deploymentConfigName + ".",
            };
        },
        function(result) {
          $scope.alerts = $scope.alerts || {};
          $scope.alerts["cancel"] =
            {
              type: "error",
              message: "An error occurred while cancelling the deployment.",
              details: $filter('getErrorDetails')(result)
            };
        }
      );
    };

    // deploymentConfigs is optional
    // filter will run the current label filter against any deployments whose DC is deleted, or any RCs
    DeploymentsService.prototype.associateDeploymentsToDeploymentConfig = function(deployments, deploymentConfigs, filter) {
      var deploymentsByDeploymentConfig = {};
      var labelSelector = LabelFilter.getLabelSelector();
      angular.forEach(deployments, function(deployment, deploymentName) {
        var deploymentConfigName = $filter('annotation')(deployment, 'deploymentConfig');
        if (!filter || deploymentConfigs && deploymentConfigs[deploymentConfigName] || labelSelector.matches(deployment)) {
          deploymentConfigName = deploymentConfigName || '';
          deploymentsByDeploymentConfig[deploymentConfigName] = deploymentsByDeploymentConfig[deploymentConfigName] || {};
          deploymentsByDeploymentConfig[deploymentConfigName][deploymentName] = deployment;
        }
      });
      // Make sure there is an empty map for every dc we know about even if there is no deployment currently
      angular.forEach(deploymentConfigs, function(deploymentConfig, deploymentConfigName) {
        deploymentsByDeploymentConfig[deploymentConfigName] = deploymentsByDeploymentConfig[deploymentConfigName] || {};
      });
      return deploymentsByDeploymentConfig;
    };

    DeploymentsService.prototype.deploymentBelongsToConfig = function(deployment, deploymentConfigName) {
      if (!deployment || !deploymentConfigName) {
        return false;
      }
      return deploymentConfigName === $filter('annotation')(deployment, 'deploymentConfig');
    };

    DeploymentsService.prototype.associateRunningDeploymentToDeploymentConfig = function(deploymentsByDeploymentConfig) {
      var deploymentConfigDeploymentsInProgress = {};
      angular.forEach(deploymentsByDeploymentConfig, function(deploymentConfigDeployments, deploymentConfigName) {
        deploymentConfigDeploymentsInProgress[deploymentConfigName] = {};
        angular.forEach(deploymentConfigDeployments, function(deployment, deploymentName) {
          var status = $filter('deploymentStatus')(deployment);
          if (status === "New" || status === "Pending" || status === "Running") {
            deploymentConfigDeploymentsInProgress[deploymentConfigName][deploymentName] = deployment;
          }
        });
      });
      return deploymentConfigDeploymentsInProgress;
    };

    // Gets the latest in progress or complete deployment among deployments.
    // Deployments are assumed to be from the same deployment config.
    DeploymentsService.prototype.getActiveDeployment = function(deployments) {
      var isInProgress = $filter('deploymentIsInProgress');
      var annotation = $filter('annotation');

      /*
       * Note: This is a hotspot in our code. We call this function frequently
       *       on the overview page.
       */

      // Iterate over the list to find the most recent active deployment.
      var activeDeployment = null;
      _.each(deployments, function(deployment) {
        if (isInProgress(deployment)) {
          // If any deployment is in progress, there is no current active deployment (disable scaling).
          // Break out of the loop and return null.
          activeDeployment = null;
          return false;
        }

        if (annotation(deployment, 'deploymentStatus') !== 'Complete') {
          return;
        }

        // The deployment must be more recent than the last we've found.
        // The date format can be compared using straight string comparison.
        // Compare as strings for performance.
        // Example Date: 2016-02-02T21:53:07Z
        if (!activeDeployment || activeDeployment.metadata.creationTimestamp < deployment.metadata.creationTimestamp) {
          activeDeployment = deployment;
        }
      });

      return activeDeployment;
    };

    DeploymentsService.prototype.scaleDC = function(dc, replicas) {
      var scale = {
        apiVersion: "extensions/v1beta1",
        kind: "Scale",
        metadata: {
          name: dc.metadata.name,
          namespace: dc.metadata.namespace,
          creationTimestamp: dc.metadata.creationTimestamp
        },
        spec: {
          replicas: replicas
        }
      };
      return DataService.update("deploymentconfigs/scale", dc.metadata.name, scale, {
        namespace: dc.metadata.namespace
      });
    };

    DeploymentsService.prototype.scaleRC = function(rc, replicas) {
      var req = angular.copy(rc);
      req.spec.replicas = replicas;
      return DataService.update("replicationcontrollers", rc.metadata.name, req, {
        namespace: rc.metadata.namespace
      });
    };

    var getLabels = function(deployment) {
      return _.get(deployment, 'spec.template.metadata.labels', {});
    };

    var isDCAutoscaled = function(name, hpaByDC) {
      var hpaArray = _.get(hpaByDC, [name]);
      return !_.isEmpty(hpaArray);
    };

    var isRCAutoscaled = function(name, hpaByRC) {
      var hpaArray = _.get(hpaByRC, [name]);
      return !_.isEmpty(hpaArray);
    };
    
    DeploymentsService.prototype.isScalable = function(deployment, deploymentConfigs, hpaByDC, hpaByRC, scalableDeploymentByConfig) {
      // If this RC has an autoscaler, don't allow manual scaling.
      if (isRCAutoscaled(deployment.metadata.name, hpaByRC)) {
        return false;
      }
      
      var deploymentConfigId = $filter('annotation')(deployment, 'deploymentConfig');

      // Otherwise allow scaling of RCs with no deployment config.
      if (!deploymentConfigId) {
        return true;
      }

      // Wait for deployment configs to load before allowing scaling of
      // a deployment with a deployment config.
      if (!deploymentConfigs) {
        return false;
      }

      // Allow scaling of deployments whose deployment config has been deleted.
      if (!deploymentConfigs[deploymentConfigId]) {
        return true;
      }

      // If the deployment config has an autoscaler, don't allow manual scaling.
      if (isDCAutoscaled(deploymentConfigId, hpaByDC)) {
        return false;
      }

      // Otherwise, check the map to find the most recent deployment that's scalable.
      return scalableDeploymentByConfig[deploymentConfigId].metadata.name === deployment.metadata.name;
    };

    DeploymentsService.prototype.groupByService = function(/* deployments or deployment configs */ resources, services) {
      var byService = {};

      _.each(resources, function(resource) {
        var selector = new LabelSelector(getLabels(resource));
        _.each(services, function(service) {
          var serviceSelector = new LabelSelector(service.spec.selector);
          if (serviceSelector.covers(selector)) {
            _.set(byService,
                  [service.metadata.name, resource.metadata.name],
                  resource);
          }
        });
      });

      return byService;
    };
    
    DeploymentsService.prototype.groupByDeploymentConfig = function(deployments) {
      var byDC = {};

      _.each(deployments, function(deployment) {
        var deploymentConfigId = $filter('annotation')(deployment, 'deploymentConfig') || '';
        _.set(byDC, [deploymentConfigId, deployment.metadata.name], deployment);
      });

      return byDC;
    };    

    return new DeploymentsService();
  });

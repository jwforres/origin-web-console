# Adds some additional dependencies to the nodejs S2I builder so that the console integration tests
# can be run against any openshift console (server must have auth set to AllowAllPasswordIdentityProvider)
FROM centos/nodejs-44-centos7
# install java, xvbf, and Firefox for headless browser testing with selenium
# Firefox requires a machine-id exist so just go ahead and generate a bogus one
USER root
RUN yum install -y java-1.?.0-openjdk Xvfb xorg-x11-utils firefox && \
    yum clean all -y  && \
    dbus-uuidgen > /etc/machine-id
ENV PATH="${PATH}:/opt/app-root/src/node_modules/bower/bin:/opt/app-root/src/node_modules/grunt-cli/bin"
USER 1001

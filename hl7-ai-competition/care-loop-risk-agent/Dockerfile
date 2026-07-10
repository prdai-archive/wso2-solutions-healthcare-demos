# Base images come from the AMP in-cluster registry (ballerina-warm carries the
# Central package cache); override both for environments with working egress.
ARG BUILDER_IMAGE=host.k3d.internal:10082/ballerina-warm:2201.13.4
ARG RUNTIME_IMAGE=host.k3d.internal:10082/temurin:21-jre
FROM ${BUILDER_IMAGE} AS builder
WORKDIR /home/ballerina/build
COPY --chown=100:1000 . .
RUN bal build --offline

FROM ${RUNTIME_IMAGE}
WORKDIR /home/ballerina
COPY --from=builder /home/ballerina/build/target/bin/care_loop_risk_agent.jar .
USER 10001
EXPOSE 8000
CMD ["java", "-jar", "care_loop_risk_agent.jar"]

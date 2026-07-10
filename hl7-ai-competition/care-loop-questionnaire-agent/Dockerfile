# Pre-warmed builder from the AMP in-cluster registry; override for environments
# with working egress to Ballerina Central.
ARG BUILDER_IMAGE=host.k3d.internal:10082/ballerina-warm:2201.13.4
FROM ${BUILDER_IMAGE} AS builder
WORKDIR /home/ballerina/build
COPY --chown=100:1000 . .
RUN bal build --offline

FROM eclipse-temurin:21-jre
WORKDIR /home/ballerina
COPY --from=builder /home/ballerina/build/target/bin/care_loop_questionnaire_agent.jar .
USER 10001
EXPOSE 8000
CMD ["java", "-jar", "care_loop_questionnaire_agent.jar"]

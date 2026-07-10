FROM ballerina/ballerina:2201.13.4 AS builder
WORKDIR /home/ballerina/build
COPY --chown=100:1000 . .
RUN bal build --offline=false

FROM eclipse-temurin:21-jre
WORKDIR /home/ballerina
COPY --from=builder /home/ballerina/build/target/bin/care_loop_task_agent.jar .
EXPOSE 8000
CMD ["java", "-jar", "care_loop_task_agent.jar"]

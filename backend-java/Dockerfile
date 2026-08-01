FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn -DskipTests clean package && rm -rf /root/.m2 ~/.m2

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup --system appgroup && adduser --system -G appgroup appuser
COPY --from=builder /app/target/backend-java-0.0.1-SNAPSHOT.jar app.jar
RUN chown appuser:appgroup app.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=70.0", \
  "-XX:InitialRAMPercentage=40.0", \
  "-XX:TieredStopAtLevel=1", \
  "-XX:+UseSerialGC", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-Dspring.jmx.enabled=false", \
  "-Dspring.backgroundpreinitializer.ignore=true", \
  "-jar", "app.jar"]

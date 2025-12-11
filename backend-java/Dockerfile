FROM maven:3.9.11-eclipse-temurin-21 AS builder
WORKDIR /build
COPY pom.xml .
COPY src ./src
RUN mvn -DskipTests package -q

FROM eclipse-temurin:21-alpine
WORKDIR /app
COPY --from=builder /build/target/ai-gatekeeper-backend-0.0.1-SNAPSHOT.jar /app/ai-gatekeeper-backend.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/ai-gatekeeper-backend.jar"]

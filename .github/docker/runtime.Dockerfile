# syntax=docker/dockerfile:1.22

FROM eclipse-temurin:25.0.2_10-jdk-jammy AS build

WORKDIR /workspace

COPY gradlew gradle.properties settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle

RUN chmod +x ./gradlew

COPY src ./src

RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --no-daemon installDist

FROM eclipse-temurin:25.0.2_10-jre-jammy

WORKDIR /app

RUN groupadd --system app \
    && useradd --system --gid app --create-home --home-dir /app app

COPY --from=build /workspace/build/install/ChoseiQun /opt/choseiqun

ENV PORT=8080

RUN chown -R app:app /app /opt/choseiqun

USER app

EXPOSE 8080

ENTRYPOINT ["/opt/choseiqun/bin/ChoseiQun"]

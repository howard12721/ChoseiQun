# syntax=docker/dockerfile:1.25

FROM eclipse-temurin:21.0.11_10-jdk-jammy AS build

WORKDIR /workspace

COPY gradlew gradle.properties settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle

RUN chmod +x ./gradlew

COPY src ./src

RUN --mount=type=cache,target=/root/.gradle \
    --mount=type=cache,target=/root/.konan \
    ./gradlew --no-daemon serverTest linkReleaseExecutableServer

FROM ubuntu:26.04

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates zlib1g \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --create-home --home-dir /app app

COPY --from=build /workspace/build/bin/server/releaseExecutable/choseiqun.kexe /usr/local/bin/choseiqun

ENV PORT=8080

RUN chown -R app:app /app

USER app

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/choseiqun"]

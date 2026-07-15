plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.plugin.serialization)
}

group = "jp.xhw"
version = "0.0.1"

kotlin {
    val hostOs = System.getProperty("os.name")
    val hostArch = System.getProperty("os.arch")
    val nativeTarget =
        when (hostOs) {
            "Mac OS X" if hostArch == "aarch64" -> macosArm64("server")
            "Linux" if hostArch in setOf("x86_64", "amd64") -> linuxX64("server")
            "Linux" if hostArch == "aarch64" -> linuxArm64("server")
            else -> throw GradleException("Unsupported Kotlin/Native host: $hostOs/$hostArch")
        }

    nativeTarget.binaries {
        executable {
            baseName = "choseiqun"
            entryPoint = "jp.xhw.choseiqun.main"
        }
    }

    nativeTarget.compilations.getByName("main").defaultSourceSet.apply {
        kotlin.srcDir("src/main/kotlin")
        dependencies {
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.datetime)
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.ktor.serialization.kotlinx.json)
            implementation(libs.ktor.server.body.limit)
            implementation(libs.ktor.server.cio)
            implementation(libs.ktor.server.content.negotiation)
            implementation(libs.ktor.server.cors)
            implementation(libs.ktor.server.core)
            implementation(libs.ktor.server.default.headers)
            implementation(libs.ktor.server.status.pages)
            implementation(libs.sqlx4k.mysql)
            implementation(libs.trakt.bot)
        }
    }

    nativeTarget.compilations.getByName("test").defaultSourceSet.apply {
        kotlin.srcDir("src/test/kotlin")
        dependencies {
            implementation(kotlin("test"))
            implementation(libs.ktor.server.test.host)
        }
    }
}

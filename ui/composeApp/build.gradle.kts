import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl
import com.android.build.api.dsl.KotlinMultiplatformAndroidLibraryExtension
import org.jetbrains.compose.desktop.application.dsl.TargetFormat

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.kotlinSerialization)
}

val androidEnabled = gradle.extra["aeon.androidEnabled"] as Boolean
if (androidEnabled) apply(plugin = "com.android.kotlin.multiplatform.library")

kotlin {
    jvm("desktop")

    if (androidEnabled) {
        // The plugin is applied conditionally, so there is no generated accessor: configure its extension by name.
        (this as ExtensionAware).extensions.configure<KotlinMultiplatformAndroidLibraryExtension>("android") {
            namespace = "dev.aeon.ui.shared"
            compileSdk = 37
            minSdk = 26
        }
    }

    @OptIn(ExperimentalWasmDsl::class)
    wasmJs {
        outputModuleName.set("aeon-ui")
        browser {
            commonWebpackConfig {
                outputFileName = "aeon-ui.js"
            }
        }
        binaries.executable()
    }

    sourceSets {
        commonMain.dependencies {
            // Plugin accessors resolve the matching Material3 version (it is versioned separately from Compose).
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.components.resources)
            implementation(compose.animation)
            implementation("org.jetbrains.compose.material:material-icons-core:1.7.3")
            implementation(compose.material3)
            implementation(compose.ui)
            implementation(libs.ktor.client.core)
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.serialization.json)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
            implementation(libs.kotlinx.coroutines.test)
        }
        val desktopMain = getByName("desktopMain").apply {
            dependencies {
                implementation(compose.desktop.currentOs)
                implementation(libs.ktor.client.cio)
                implementation(libs.kotlinx.coroutines.swing)
            }
        }
        val desktopTest = getByName("desktopTest").apply {
            dependencies {
                implementation(libs.ktor.client.cio)
            }
        }
        if (androidEnabled) {
            getByName("androidMain").dependencies {
                implementation(libs.ktor.client.cio)
                implementation(libs.kotlinx.coroutines.android)
                implementation(libs.androidx.activity.compose)
            }
        }
        wasmJsMain.dependencies {
            implementation(libs.ktor.client.js)
        }
    }
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    // Lets the integration tests start the real Node server from the repository root.
    systemProperty("aeon.repoRoot", rootDir.parentFile.absolutePath)
    testLogging { events("passed", "failed", "skipped"); showStandardStreams = false; exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL }
}

compose.resources {
    packageOfResClass = "dev.aeon.ui.generated.resources"
}

// The agent that the desktop installer carries (decision D36): the compiled server and a Node.js runtime, so the desktop app starts
// its own agent and nobody has to install Node.js or open a terminal. tools/package-agent.mjs makes the folder; Compose copies
// it next to the app and the app finds it through compose.application.resources.dir. It is made only when asked for
// (-PbundleAgent, as the release workflow does for Windows), so an ordinary build or test run needs no npm and no download.
// -PagentNode=PATH uses a Node.js that is already on the machine instead of downloading the pinned one.
val hostOsDir = System.getProperty("os.name").let { os -> if (os.startsWith("Windows")) "windows" else if (os.startsWith("Mac")) "macos" else "linux" }
val hostArchDir = System.getProperty("os.arch").let { if (it == "aarch64" || it == "arm64") "arm64" else "x64" }
val agentResources = layout.buildDirectory.dir("agent-resources")
val prepareAgent = tasks.register<Exec>("prepareAgent") {
    group = "aeon"
    description = "Puts the agent and a Node.js runtime where the desktop installer picks them up."
    workingDir = rootDir.parentFile
    val out = agentResources.get().dir("$hostOsDir-$hostArchDir/agent").asFile
    val node = findProperty("agentNode") as String?
    commandLine(listOf("node", "tools/package-agent.mjs", "--out", out.absolutePath) + (if (node != null) listOf("--node", node) else emptyList()))
    outputs.upToDateWhen { false }
}
if (findProperty("bundleAgent") != null) {
    tasks.matching { it.name == "prepareAppResources" }.configureEach { dependsOn(prepareAgent) }
}

compose.desktop {
    application {
        mainClass = "dev.aeon.ui.MainKt"
        nativeDistributions {
            // Only when the agent is asked for: a plain build must not pick up an old, left-over agent folder.
            if (findProperty("bundleAgent") != null) appResourcesRootDir.set(agentResources)
            // jpackage builds only for the machine it runs on: Windows x64/ARM64 give msi/exe, Linux gives deb/rpm.
            targetFormats(TargetFormat.Msi, TargetFormat.Exe, TargetFormat.Deb, TargetFormat.Rpm)
            packageName = "Aeon"
            // The release workflow passes the numeric part of the tag (-PappVersion=1.2.3); jpackage accepts only MAJOR.MINOR.PATCH.
            packageVersion = (findProperty("appVersion") as String?) ?: "0.1.0"
        }
    }
}

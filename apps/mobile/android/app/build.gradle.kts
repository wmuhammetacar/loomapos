import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.loomapos.mobile"
    compileSdk = flutter.compileSdkVersion

    val keystorePropertiesFile = rootProject.file("key.properties")
    val keystoreProperties = Properties()
    val hasReleaseSigning = keystorePropertiesFile.exists()
    if (hasReleaseSigning) {
        FileInputStream(keystorePropertiesFile).use { stream ->
            keystoreProperties.load(stream)
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.loomapos.mobile"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseSigning) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

val allowDebugSigning = providers.environmentVariable("LOOMAPOS_ALLOW_DEBUG_SIGNING")
    .orNull
    ?.equals("true", ignoreCase = true) == true

tasks.register("validateReleaseSigning") {
    doLast {
        if (!file("$projectDir/../key.properties").exists() && !allowDebugSigning) {
            throw GradleException(
                "Release signing missing: android/key.properties bulunamadi. " +
                    "CI/local dry-run icin LOOMAPOS_ALLOW_DEBUG_SIGNING=true kullanin."
            )
        }
    }
}

tasks.matching { it.name == "assembleRelease" || it.name == "bundleRelease" }.configureEach {
    dependsOn("validateReleaseSigning")
}

flutter {
    source = "../.."
}

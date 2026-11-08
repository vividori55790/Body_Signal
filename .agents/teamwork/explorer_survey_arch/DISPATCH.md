# Task Assignment: Architecture & Build Explorer (Survey)

**Working Directory**: `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_survey_arch`
**Identity**: `survey_codebase_arch` (Type: `teamwork_explorer`)
**Parent**: Top-level Project Orchestrator (`c0c096b2-e043-4359-9001-d946fccdf4ac`)

## Objective
Read `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\ORIGINAL_REQUEST.md` and explore the entire repository root and subdirectories to determine:
1. Technical stack (Android Native / Kotlin / Jetpack Compose / XML / Flutter / React Native / Gradle wrapper / Kotlin version / targetSdk / compileSdk).
2. Project directory structure and module layout (where the app source code lives, e.g. `body-signal` or root or android app module).
3. Build system, build commands, and APK output paths:
   - Identify existing Gradle build scripts (`build.gradle`, `build.gradle.kts`, `settings.gradle`, etc.).
   - Exact commands for assembleRelease / assembleDebug / test.
   - APK output directory and naming conventions.
   - Existing CI/build scripts or environment prerequisites.
4. Core application architecture:
   - Application class, MainActivity, Navigation framework (Compose Navigation / Jetpack Navigation / Fragment / etc.).
   - State management, Dependency Injection (Hilt / Koin / manual), local database / storage (Room / DataStore / SharedPreferences / SQLite / Realm).
   - Theme and styling framework (Material3 / Material2 / custom theme, dynamic color).
   - System environment integration (Configuration changes, Dark Mode handling, FontScale handling, Haptics / Vibrator APIs).
5. Potential build blockers or environment issues to be aware of.

## Output Requirements
Write your detailed architectural and build system survey report to:
`c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_survey_arch\handoff.md`
and notify the orchestrator via `send_message`.


## 2026-11-07T02:12:58Z
You are survey_codebase_arch, operating in c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_survey_arch.
Your parent orchestrator is c0c096b2-e043-4359-9001-d946fccdf4ac.

Read the following instructions carefully:
1. Read ORIGINAL_REQUEST.md at:
   c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\ORIGINAL_REQUEST.md
2. Read your task assignment in DISPATCH.md at:
   c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_survey_arch\DISPATCH.md
3. Investigate the codebase structure, tech stack, Android/Kotlin/Compose versions, SDK versions, build system (Gradle scripts, tasks), build commands for release/debug APK, APK output paths, Application/MainActivity entry points, navigation, theme architecture, state management, storage, and vibrator/haptics APIs.
4. You are READ-ONLY. DO NOT modify any application code or build files.
5. Create and update progress.md in your working directory to signal liveness.
6. Write your comprehensive architectural and build system report to:
   c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_survey_arch\handoff.md
7. When done, notify your parent (c0c096b2-e043-4359-9001-d946fccdf4ac) via send_message with a summary and reference to your handoff.md.

# � Build Android App (.apk) with Capacitor

Since you want to build the app directly without deploying to a website first, we use **Capacitor**. This bundles your web code directly into the Android app.

### Prerequisite: Upload Code to GitHub

To build the APK automatically, you need to push your code to GitHub.

#### 1. Create a Repository

Go to **[GitHub New Repository](https://github.com/new)** and create a repository named `body-signal`.
_Note: Do not add README, .gitignore, or license during creation._

#### 2. Push Your Code

Run the following commands in your terminal (one by one):

```bash
# 1. Stage all changes
git add .

# 2. Commit your changes
git commit -m "Initial commit for Android build"

# 3. Rename branch to main
git branch -M main

# 4. Connect to GitHub (Replace URL with your own!)
git remote add origin https://github.com/<YOUR-USERNAME>/body-signal.git

# 5. Push code
git push -u origin main
```

Once pushed, go to the **Actions** tab in your GitHub repository to see the build progress. After about 3-5 minutes, you can download the `body-signal-apk` artifact.

---

## 🚀 Steps to Generate APK

### 1. Update Web Code

Whenever you make changes to your React app, run these commands to update the Android project:

```bash
npm run build
npx cap sync
```

_This updates the `dist` folder and copies it into the `android` folder._

### 2. Open in Android Studio

Run this command to open the project in Android Studio:

```bash
npx cap open android
```

### 3. Build the APK

1. In Android Studio, wait for Gradle sync to finish (bottom bar).
2. Go to the menu: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
3. Once finished, a popup will appear. Click **locate** to find your `.apk` file.
   - Typically located at: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🤖 Install on Phone

1. Transfer the `.apk` file to your Android phone (via USB, Drive, etc.).
2. Open the file on your phone and tap **Install**.
   - _Note: You may need to allow installation from unknown sources._

---

## 🌐 (Optional) F-Droid

To publish to F-Droid later:

1. You will need to build a **Signed Release APK** (Build > Generate Signed Bundle / APK).
2. F-Droid builds from source, so you would submit this entire project (including the `android` folder) to a public GitHub repo eventually.

# KSRTC Smart Bus — Android APK build

This project ZIP is configured to build an Android **debug APK** using GitHub Actions.
It is not itself an APK file; GitHub's Android build runner compiles the APK.

## Build online
1. Extract this ZIP.
2. Upload all files and folders (including the hidden `.github` folder) to the root of your GitHub repository.
3. Commit the files to the `main` branch.
4. Open the repository's **Actions** tab.
5. Choose **Build KSRTC Smart Bus APK** from the left side.
6. Click **Run workflow** and confirm.
7. When the run finishes with a green check, open it and download the
   `ksrtc-smart-bus-debug-apk` artifact.
8. Extract the downloaded artifact ZIP. The file inside is `app-debug.apk`.

## Important
- This is a debug/testing APK, not a Play Store-signed release.
- Add any required API keys/secrets in GitHub repository Settings before building.
- A web frontend packaged in the APK does not automatically provide server-side
  Express routes. Features that require `server.ts`, live bus GPS feeds, ticket
  payments, authentication, or booking databases need a separately deployed
  backend and valid provider/API integrations.

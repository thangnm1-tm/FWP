# FwP Android demo

Open this `android/` folder in Android Studio. The project targets API 35 and uses Jetpack Compose.

## Run locally

1. Start the backend and its services from the repository root: `docker compose up --build`.
2. Open this folder in Android Studio and choose an emulator with API 26+.
3. Run the `app` configuration. Debug builds call `http://10.0.2.2:3000/`, which is the emulator address for the host computer.

For a physical device, replace `API_BASE_URL` in `app/build.gradle.kts` with your computer's LAN address such as `http://192.168.1.20:3000/`. The backend must be reachable on that network.

## Seeded demo login

The demo seed contains 42 synthetic accounts. To start with a fresh recommendation feed, use `demo.student24@stu.ptit.edu.vn` / `Demo@123456` (or another `demo.studentNN@stu.ptit.edu.vn` account). Existing demo accounts may already have swipe history and can show an empty feed. If an account is already signed in, open **Hồ sơ → Đăng xuất** before switching accounts. Never use these seeded credentials in production.

## Demo flow

Register with a PTIT email, enter the SMTP-delivered OTP, finish the profile and upload an image, swipe, then use the anonymous real-time chat and Reveal button after a mutual match. For a reliable demo prepare two accounts and a few completed profiles in Postgres.

`local.properties` only points to this computer's Android SDK; Android Studio can regenerate it on another machine.

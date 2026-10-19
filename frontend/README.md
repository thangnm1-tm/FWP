# FwP Web demo

Serve this folder with any static server (for example `npx serve .`) and open the printed URL. It uses the Nest backend at `http://localhost:3000`; update `API` in `app.js` for a deployed backend.

It covers registration/OTP, profile/photo upload, swipe UI, and realtime rooms/messages/typing. Matched profiles are visible in chat immediately. The swipe cards are intentionally demo data; actual feed integration remains behind `/recommendations`.

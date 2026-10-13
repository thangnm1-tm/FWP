# FwP API Documentation

Base URL: `http://localhost:3000`
Swagger UI: `http://localhost:3000/api/docs`

## Authentication

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "b21dccn001@stu.ptit.edu.vn",
  "password": "StrongP@ss123"
}
```

Response:
```json
{
  "message": "Đăng ký thành công. Vui lòng xác thực email bằng OTP.",
  "userId": "uuid"
}
```

OTP is sent exclusively by the configured SMTP provider and is never returned by the API.

### Verify OTP
```http
POST /auth/verify-otp/:userId
Content-Type: application/json

{
  "otpCode": "123456"
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "b21dccn001@stu.ptit.edu.vn",
  "password": "StrongP@ss123"
}
```

Response:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "tokenType": "Bearer"
}
```

## Profile

### Get Profile
```http
GET /profile
Authorization: Bearer {token}
```

### Upload Profile Photo
```http
POST /profile/photos
Authorization: Bearer {token}
Content-Type: multipart/form-data

photo: <JPEG, PNG, or WebP; max 8 MB>
```

The response contains the Cloudinary `url` and the updated `photos` array.

## Realtime chat

Connect Socket.IO to `http://localhost:3000/chat` with `auth: { token: "<JWT>" }`.
Use `room:join`, `message:send`, `typing:start`, and `typing:stop`; listen to
`message:new`, `typing`, `presence`, and `match:new`.

## Push notifications

Register a device after login:
```http
POST /notifications/device-token
Authorization: Bearer {token}
Content-Type: application/json

{"token":"fcm-token", "platform":"android"}
```

### Update Profile
```http
PUT /profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "displayName": "Nguyễn Văn A",
  "dateOfBirth": "2002-01-15",
  "gender": "male",
  "bio": "Sinh viên CNTT, thích AI và gym",
  "gpa": 3.5,
  "universityId": "uuid",
  "facultyId": "uuid",
  "academicYear": 3,
  "purpose": "friendship"
}
```

## Recommendations

### Get Swipe Feed
```http
GET /recommendations?limit=20
Authorization: Bearer {token}
```

Response:
```json
{
  "requestId": "uuid",
  "candidates": [
    {"candidateId": "uuid", "rank": 1, "distanceKm": 2.3},
    {"candidateId": "uuid", "rank": 2, "distanceKm": 5.1}
  ]
}
```

## Swipe

### Swipe Like/Pass
```http
POST /swipe
Authorization: Bearer {token}
Content-Type: application/json

{
  "candidateId": "uuid",
  "action": "LIKE",
  "impressionId": "uuid"
}
```

Response (if matched):
```json
{
  "matched": true,
  "matchId": "uuid"
}
```

## ML Service

### Rank Candidates (Internal)
```http
POST http://localhost:8000/v1/rank
Content-Type: application/json

{
  "viewer_id": "uuid",
  "candidate_ids": ["uuid1", "uuid2"]
}
```

### Health Check
```http
GET http://localhost:8000/health
```

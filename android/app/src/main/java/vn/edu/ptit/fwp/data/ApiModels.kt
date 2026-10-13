package vn.edu.ptit.fwp.data

data class RegisterRequest(val email: String, val password: String)
data class VerifyOtpRequest(val otpCode: String)
data class LoginRequest(val email: String, val password: String)
data class RegisterResponse(val userId: String, val message: String, val devOtp: String? = null)
data class TokenResponse(val accessToken: String, val refreshToken: String)

data class Profile(
    val id: String? = null, val userId: String? = null, val displayName: String? = null,
    val dateOfBirth: String? = null, val gender: String? = null, val bio: String? = null,
    val photos: List<String> = emptyList(), val gpa: Double? = null,
    val universityId: String? = null, val facultyId: String? = null, val academicYear: Int? = null,
    val purpose: String? = null, val profileCompleted: Boolean = false,
    val discoverable: Boolean = false,
)

data class ProfileUpdate(
    val displayName: String? = null, val dateOfBirth: String? = null, val gender: String? = null,
    val bio: String? = null, val gpa: Double? = null, val universityId: String? = null,
    val facultyId: String? = null, val academicYear: Int? = null, val purpose: String? = null,
    val discoverable: Boolean? = null,
)
data class PhotoUploadResponse(val url: String, val photos: List<String>)
data class University(val id: String, val name: String, val shortName: String)
data class Faculty(val id: String, val universityId: String, val name: String, val code: String)
data class ProfileOptions(val universities: List<University>, val faculties: List<Faculty>)
data class RecommendationResponse(val requestId: String, val candidates: List<Candidate>)
data class Preferences(
    val genderPreference: String? = "all", val minAge: Int = 18, val maxAge: Int = 30,
    val maxDistanceKm: Int = 20, val sameUniversityOnly: Boolean = false,
)
data class Candidate(
    val candidateId: String, val rank: Int, val distanceKm: Double?,
    val impressionId: String? = null, val displayName: String? = null, val age: Int? = null,
    val bio: String? = null, val photos: List<String> = emptyList(),
    val interests: List<String> = emptyList(), val faculty: String? = null,
    val university: String? = null, val gpaBucket: Int? = null,
)
data class SwipeRequest(val candidateId: String, val action: String, val impressionId: String? = null)
data class SwipeResponse(val matched: Boolean, val matchId: String? = null)
data class Match(val id: String, val userAId: String, val userBId: String, val matchedAt: String, val active: Boolean)
data class ChatRoom(val id: String, val matchId: String, val identityRevealed: Boolean = false)
data class ChatMessage(val id: String, val chatRoomId: String, val senderId: String, val content: String, val createdAt: String)
data class SendMessageRequest(val content: String)
data class DeviceTokenRequest(val token: String, val platform: String = "android")

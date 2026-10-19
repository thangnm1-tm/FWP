package vn.edu.ptit.fwp.data

import okhttp3.MultipartBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface FwpApi {
    @POST("auth/register") suspend fun register(@Body request: RegisterRequest): RegisterResponse
    @POST("auth/verify-otp/{userId}") suspend fun verifyOtp(@Path("userId") userId: String, @Body request: VerifyOtpRequest): TokenResponse
    @POST("auth/login") suspend fun login(@Body request: LoginRequest): TokenResponse
    @GET("profile") suspend fun profile(): Profile
    @GET("profile/options") suspend fun profileOptions(): ProfileOptions
    @PUT("profile") suspend fun updateProfile(@Body profile: ProfileUpdate): Profile
    @Multipart @POST("profile/photos") suspend fun uploadPhoto(@Part photo: MultipartBody.Part): PhotoUploadResponse
    @GET("recommendations") suspend fun recommendations(@Query("limit") limit: Int = 20): RecommendationResponse
    @GET("preferences") suspend fun preferences(): Preferences
    @PUT("preferences") suspend fun updatePreferences(@Body preferences: Preferences): Preferences
    @POST("swipe") suspend fun swipe(@Body request: SwipeRequest): SwipeResponse
    @GET("matches") suspend fun matches(): List<Match>
    @GET("chat/rooms") suspend fun chatRooms(): List<ChatRoom>
    @GET("chat/{roomId}/messages") suspend fun messages(@Path("roomId") roomId: String): List<ChatMessage>
    @POST("chat/{roomId}/messages") suspend fun sendMessage(@Path("roomId") roomId: String, @Body request: SendMessageRequest): ChatMessage
    @POST("notifications/device-token") suspend fun registerDevice(@Body request: DeviceTokenRequest): Any
}

package vn.edu.ptit.fwp.data

import android.content.Context
import android.net.Uri
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.OkHttpClient
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import vn.edu.ptit.fwp.BuildConfig
import java.io.File
import com.google.gson.Gson
import com.google.gson.JsonObject

class FwpRepository(private val context: Context, private val session: SessionStore) {
    private val api: FwpApi
    init {
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            val token = kotlinx.coroutines.runBlocking { session.accessToken() }
            chain.proceed(chain.request().newBuilder().apply { if (token != null) header("Authorization", "Bearer $token") }.build())
        }.authenticator(object : Authenticator {
            override fun authenticate(route: Route?, response: Response): Request? {
                if (responseCount(response) >= 2 || response.request.url.encodedPath.endsWith("/auth/refresh")) return null
                val refresh = kotlinx.coroutines.runBlocking { session.refreshToken() } ?: return null
                return try {
                    val body = Gson().toJson(mapOf("refreshToken" to refresh)).toRequestBody("application/json".toMediaType())
                    val refreshClient = OkHttpClient.Builder().build()
                    refreshClient.newCall(Request.Builder().url(BuildConfig.API_BASE_URL + "auth/refresh").post(body).build()).execute().use { result ->
                        if (!result.isSuccessful) { kotlinx.coroutines.runBlocking { session.clear() }; return null }
                        val tokens = Gson().fromJson(result.body?.string(), TokenResponse::class.java)
                        kotlinx.coroutines.runBlocking { session.save(tokens) }
                        response.request.newBuilder().header("Authorization", "Bearer ${tokens.accessToken}").build()
                    }
                } catch (_: Exception) { null }
            }
            private fun responseCount(response: Response): Int { var count = 1; var prior = response.priorResponse; while (prior != null) { count++; prior = prior.priorResponse }; return count }
        }).addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }).build()
        api = Retrofit.Builder().baseUrl(BuildConfig.API_BASE_URL).client(client).addConverterFactory(GsonConverterFactory.create()).build().create(FwpApi::class.java)
    }
    suspend fun register(email: String, password: String) = api.register(RegisterRequest(email, password))
    suspend fun verifyOtp(userId: String, code: String): TokenResponse = api.verifyOtp(userId, VerifyOtpRequest(code)).also { session.save(it) }
    suspend fun login(email: String, password: String): TokenResponse = api.login(LoginRequest(email, password)).also { session.save(it) }
    suspend fun profile() = api.profile()
    suspend fun profileOptions() = api.profileOptions()
    suspend fun updateProfile(update: ProfileUpdate) = api.updateProfile(update)
    suspend fun uploadPhoto(uri: Uri): PhotoUploadResponse {
        val file = File(context.cacheDir, "profile-photo-${System.currentTimeMillis()}")
        try {
            val input = context.contentResolver.openInputStream(uri) ?: error("Không thể đọc ảnh đã chọn")
            input.use { source -> file.outputStream().use { source.copyTo(it) } }
            val body = file.asRequestBody(context.contentResolver.getType(uri)?.toMediaTypeOrNull())
            return api.uploadPhoto(MultipartBody.Part.createFormData("photo", file.name, body))
        } finally { file.delete() }
    }
    suspend fun recommendations() = api.recommendations()
    suspend fun preferences() = api.preferences()
    suspend fun updatePreferences(preferences: Preferences) = api.updatePreferences(preferences)
    suspend fun swipe(candidate: Candidate, action: String) = api.swipe(SwipeRequest(candidate.candidateId, action, candidate.impressionId))
    suspend fun rooms() = api.chatRooms()
    suspend fun messages(roomId: String) = api.messages(roomId).reversed()
    suspend fun sendMessage(roomId: String, content: String) = api.sendMessage(roomId, SendMessageRequest(content))
    suspend fun reveal(matchId: String) = api.requestReveal(matchId)
    suspend fun token() = session.accessToken()
    suspend fun logout() = session.clear()
}

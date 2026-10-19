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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.launch

class FwpRepository(private val context: Context, private val session: SessionStore) {
    private val gson = Gson()
    private val refreshScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    @Volatile private var cachedAccessToken: String? = null
    @Volatile private var cachedRefreshToken: String? = null
    private val sessionReady: Deferred<Unit> = refreshScope.async {
        cachedAccessToken = session.accessToken()
        cachedRefreshToken = session.refreshToken()
    }
    private val refreshLock = Any()
    private val api: FwpApi

    init {
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            val token = cachedAccessToken
            chain.proceed(chain.request().newBuilder().apply { if (token != null) header("Authorization", "Bearer $token") }.build())
        }.authenticator(object : Authenticator {
            override fun authenticate(route: Route?, response: Response): Request? {
                if (responseCount(response) >= 2 || response.request.url.encodedPath.endsWith("/auth/refresh")) return null
                val failedToken = response.request.header("Authorization")?.removePrefix("Bearer ")
                val token = refreshAccessToken(failedToken) ?: return null
                return response.request.newBuilder().header("Authorization", "Bearer $token").build()
            }
            private fun responseCount(response: Response): Int { var count = 1; var prior = response.priorResponse; while (prior != null) { count++; prior = prior.priorResponse }; return count }
        }).addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }).build()
        api = Retrofit.Builder().baseUrl(BuildConfig.API_BASE_URL).client(client).addConverterFactory(GsonConverterFactory.create()).build().create(FwpApi::class.java)
    }
    suspend fun register(email: String, password: String) = api.register(RegisterRequest(email, password))
    suspend fun verifyOtp(userId: String, code: String): TokenResponse = api.verifyOtp(userId, VerifyOtpRequest(code)).also { saveTokens(it) }
    suspend fun login(email: String, password: String): TokenResponse = api.login(LoginRequest(email, password)).also { saveTokens(it) }
    suspend fun profile() = authenticated { api.profile() }
    suspend fun profileOptions() = authenticated { api.profileOptions() }
    suspend fun updateProfile(update: ProfileUpdate) = authenticated { api.updateProfile(update) }
    suspend fun uploadPhoto(uri: Uri): PhotoUploadResponse {
        awaitSessionReady()
        val file = File(context.cacheDir, "profile-photo-${System.currentTimeMillis()}")
        try {
            val input = context.contentResolver.openInputStream(uri) ?: error("Không thể đọc ảnh đã chọn")
            input.use { source -> file.outputStream().use { source.copyTo(it) } }
            val body = file.asRequestBody(context.contentResolver.getType(uri)?.toMediaTypeOrNull())
            return api.uploadPhoto(MultipartBody.Part.createFormData("photo", file.name, body))
        } finally { file.delete() }
    }
    suspend fun recommendations() = authenticated { api.recommendations() }
    suspend fun preferences() = authenticated { api.preferences() }
    suspend fun updatePreferences(preferences: Preferences) = authenticated { api.updatePreferences(preferences) }
    suspend fun swipe(candidate: Candidate, action: String) = authenticated { api.swipe(SwipeRequest(candidate.candidateId, action, candidate.impressionId)) }
    suspend fun rooms() = authenticated { api.chatRooms() }
    suspend fun messages(roomId: String) = authenticated { api.messages(roomId).sortedWith(compareBy<ChatMessage> { it.createdAt }.thenBy { it.id }) }
    suspend fun sendMessage(roomId: String, content: String) = authenticated { api.sendMessage(roomId, SendMessageRequest(content)) }
    suspend fun token(): String? { awaitSessionReady(); return cachedAccessToken }
    suspend fun logout() { awaitSessionReady(); cachedAccessToken = null; cachedRefreshToken = null; session.clear() }

    private suspend fun awaitSessionReady() {
        sessionReady.await()
    }

    private suspend fun <T> authenticated(request: suspend () -> T): T {
        awaitSessionReady()
        return request()
    }

    private suspend fun saveTokens(tokens: TokenResponse) {
        cachedAccessToken = tokens.accessToken
        cachedRefreshToken = tokens.refreshToken
        session.save(tokens)
    }

    private fun refreshAccessToken(failedToken: String?): String? = synchronized(refreshLock) {
        val current = cachedAccessToken
        if (!current.isNullOrBlank() && current != failedToken) return@synchronized current
        val refresh = cachedRefreshToken ?: return@synchronized null
        val body = gson.toJson(mapOf("refreshToken" to refresh)).toRequestBody("application/json".toMediaType())
        val refreshClient = OkHttpClient.Builder().build()
        try {
            refreshClient.newCall(Request.Builder().url(BuildConfig.API_BASE_URL + "auth/refresh").post(body).build()).execute().use { result ->
                if (!result.isSuccessful) {
                    cachedAccessToken = null
                    cachedRefreshToken = null
                    refreshScope.launch { session.clear() }
                    return@synchronized null
                }
                val tokens = gson.fromJson(result.body?.string(), TokenResponse::class.java)
                cachedAccessToken = tokens.accessToken
                cachedRefreshToken = tokens.refreshToken
                refreshScope.launch { session.save(tokens) }
                tokens.accessToken
            }
        } catch (_: Exception) {
            null
        }
    }
}

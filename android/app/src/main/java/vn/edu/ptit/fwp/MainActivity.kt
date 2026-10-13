package vn.edu.ptit.fwp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.composed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import kotlinx.coroutines.launch
import org.json.JSONObject
import vn.edu.ptit.fwp.data.*
import vn.edu.ptit.fwp.realtime.ChatSocket
import vn.edu.ptit.fwp.ui.FwpTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); setContent { FwpTheme { FwpApp() } } }
}

private enum class Tab { DISCOVER, PROFILE, CHAT }
@Composable private fun FwpApp() {
    val context = androidx.compose.ui.platform.LocalContext.current
    val session = remember { SessionStore(context) }
    val repository = remember { FwpRepository(context, session) }
    val scope = rememberCoroutineScope()
    var signedIn by remember { mutableStateOf(false) }
    var checkingSession by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) { signedIn = session.accessToken() != null; checkingSession = false }
    if (checkingSession) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    else if (signedIn) Home(repository, onLogout = { scope.launch { repository.logout(); signedIn = false } })
    else Auth(repository, onAuthenticated = { signedIn = true })
}

@Composable private fun Auth(repository: FwpRepository, onAuthenticated: () -> Unit) {
    val scope = rememberCoroutineScope(); var mode by remember { mutableStateOf("register") }; var pendingId by remember { mutableStateOf<String?>(null) }; var demoOtp by remember { mutableStateOf<String?>(null) }
    var email by remember { mutableStateOf("") }; var password by remember { mutableStateOf("") }; var otp by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }; var error by remember { mutableStateOf("") }
    Surface(Modifier.fillMaxSize()) { Column(Modifier.padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text("fwp ♥", style = MaterialTheme.typography.displaySmall, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Black)
        Spacer(Modifier.height(12.dp)); Text(if (mode == "login") "Chào mừng trở lại" else "Tìm người cùng tần số", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(24.dp))
        if (mode == "otp") {
            Text(if (demoOtp == null) "Mã OTP đã được gửi tới $email" else "Chế độ demo — mã OTP: $demoOtp", textAlign = TextAlign.Center); Field("Mã OTP 6 số", otp) { otp = it }
            PrimaryButton("Xác thực", loading) { scope.launch { runUi({ repository.verifyOtp(pendingId!!, otp); onAuthenticated() }, { error = it }, { loading = it }) } }
        } else {
            Field("Email PTIT", email) { email = it }; Field("Mật khẩu", password, password = true) { password = it }
            PrimaryButton(if (mode == "login") "Đăng nhập" else "Tạo tài khoản & gửi OTP", loading) {
                scope.launch { runUi({ if (mode == "login") { repository.login(email, password); onAuthenticated() } else { val result = repository.register(email, password); pendingId = result.userId; demoOtp = result.devOtp; mode = "otp" } }, { error = it }, { loading = it }) }
            }
            TextButton(onClick = { mode = if (mode == "login") "register" else "login" }) { Text(if (mode == "login") "Chưa có tài khoản? Đăng ký" else "Đã có tài khoản? Đăng nhập") }
        }
        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
    } }
}

@Composable private fun Home(repository: FwpRepository, onLogout: () -> Unit) {
    var tab by remember { mutableStateOf(Tab.DISCOVER) }
    Scaffold(bottomBar = { NavigationBar { listOf(Triple(Tab.DISCOVER, Icons.Default.Favorite, "Khám phá"), Triple(Tab.PROFILE, Icons.Default.Person, "Hồ sơ"), Triple(Tab.CHAT, Icons.Default.Chat, "Chat")).forEach { (item, icon, label) -> NavigationBarItem(selected = tab == item, onClick = { tab = item }, icon = { Icon(icon, label) }, label = { Text(label) }) } } }) { padding ->
        Box(Modifier.padding(padding)) { when (tab) { Tab.DISCOVER -> Discover(repository, onOpenProfile = { tab = Tab.PROFILE }, onOpenChat = { tab = Tab.CHAT }); Tab.PROFILE -> ProfileScreen(repository, onLogout); Tab.CHAT -> ChatScreen(repository) } }
    }
}

@Composable private fun Discover(repository: FwpRepository, onOpenProfile: () -> Unit, onOpenChat: () -> Unit) {
    val scope = rememberCoroutineScope()
    var candidates by remember { mutableStateOf<List<Candidate>>(emptyList()) }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var swiping by remember { mutableStateOf(false) }
    var matchId by remember { mutableStateOf<String?>(null) }
    var preferences by remember { mutableStateOf(Preferences()) }
    var showFilters by remember { mutableStateOf(false) }
    suspend fun load() {
        loading = true; error = ""
        try { preferences = repository.preferences(); candidates = repository.recommendations().candidates }
        catch (e: Exception) { error = e.userMessage() }
        finally { loading = false }
    }
    suspend fun swipe(candidate: Candidate, action: String) {
        if (swiping) return
        swiping = true
        try {
            val result = repository.swipe(candidate, action)
            candidates = candidates.filterNot { it.candidateId == candidate.candidateId }
            if (result.matched) matchId = result.matchId
        } catch (e: Exception) { error = e.userMessage() }
        finally { swiping = false }
    }
    LaunchedEffect(Unit) { load() }
    if (loading) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(Modifier.size(38.dp)); Spacer(Modifier.height(14.dp)); Text("Đang tìm người cùng tần số…")
        }
    } else if (candidates.isEmpty()) Box(Modifier.fillMaxSize().padding(28.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (error.isNotBlank()) error else "Bạn đã xem hết gợi ý hiện tại. Hoàn thiện hồ sơ hoặc tải lại để khám phá thêm nhé.", textAlign = TextAlign.Center)
            Spacer(Modifier.height(14.dp)); OutlinedButton(onClick = { scope.launch { load() } }) { Text("Tải gợi ý") }
            TextButton(onClick = onOpenProfile) { Text("Mở Hồ sơ để đổi tài khoản") }
        }
    } else {
        val candidate = candidates.first()
        Column(Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Khám phá", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Text("${candidates.size} gợi ý", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                IconButton(onClick = { showFilters = true }) { Icon(Icons.Default.Tune, contentDescription = "Bộ lọc") }
            }
            Spacer(Modifier.height(8.dp))
            Card(
                Modifier.fillMaxWidth().weight(1f)
                    .swipeCard(candidate.candidateId, onSwipe = { action -> scope.launch { swipe(candidate, action) } }),
                shape = RoundedCornerShape(28.dp), elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            ) {
                var photoIndex by remember(candidate.candidateId) { mutableIntStateOf(0) }
                Box(Modifier.fillMaxSize()) {
                    val photo = candidate.photos.getOrNull(photoIndex)
                    if (photo != null) SubcomposeAsyncImage(
                        model = photo, contentDescription = "Ảnh ${candidate.displayName ?: "thành viên FwP"}",
                        modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop,
                    ) {
                        when (painter.state) {
                            is coil.compose.AsyncImagePainter.State.Loading -> Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFFBBA9FF), Color(0xFF5140A3)))), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Color.White) }
                            is coil.compose.AsyncImagePainter.State.Error -> Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFFBBA9FF), Color(0xFF5140A3)))), contentAlignment = Alignment.Center) { Text("Ảnh hồ sơ chưa tải được", color = Color.White, style = MaterialTheme.typography.titleMedium) }
                            else -> SubcomposeAsyncImageContent()
                        }
                    } else Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFFBBA9FF), Color(0xFF5140A3)))), contentAlignment = Alignment.Center) { Text("FwP", color = Color.White, style = MaterialTheme.typography.displayLarge, fontWeight = FontWeight.Black) }
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent, Color(0xDD15121D)))))
                    Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        repeat(maxOf(candidate.photos.size, 1)) { index ->
                            LinearProgressIndicator(progress = { if (index <= photoIndex) 1f else 0f }, modifier = Modifier.weight(1f).height(3.dp).clip(CircleShape), color = Color.White, trackColor = Color.White.copy(alpha = .38f))
                        }
                    }
                    if (candidate.photos.size > 1) {
                        Row(Modifier.fillMaxWidth().fillMaxHeight(.76f)) {
                            Box(Modifier.weight(1f).fillMaxHeight().clickable { photoIndex = (photoIndex - 1).coerceAtLeast(0) })
                            Box(Modifier.weight(1f).fillMaxHeight().clickable { photoIndex = (photoIndex + 1).coerceAtMost(candidate.photos.lastIndex) })
                        }
                    }
                    Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(20.dp)) {
                        Text("${candidate.displayName ?: "Bạn cùng tần số"}${candidate.age?.let { ", $it" } ?: ""}", style = MaterialTheme.typography.headlineMedium, color = Color.White, fontWeight = FontWeight.Bold)
                        Text(listOfNotNull(candidate.faculty, candidate.university, candidate.distanceKm?.let { "%.1f km".format(it) }).joinToString(" · ").ifBlank { "Sinh viên PTIT" }, color = Color.White.copy(alpha = .9f), style = MaterialTheme.typography.bodyMedium)
                        if (!candidate.bio.isNullOrBlank()) { Spacer(Modifier.height(8.dp)); Text(candidate.bio, color = Color.White, maxLines = 3, style = MaterialTheme.typography.bodyMedium) }
                        if (candidate.interests.isNotEmpty()) {
                            Spacer(Modifier.height(10.dp)); Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                candidate.interests.take(3).forEach { interest -> Surface(color = Color.White.copy(alpha = .2f), shape = CircleShape) { Text(interest, Modifier.padding(horizontal = 10.dp, vertical = 5.dp), color = Color.White, style = MaterialTheme.typography.labelMedium) } }
                            }
                        }
                    }
                    if (swiping) Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .25f)), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Color.White) }
                }
            }
            Row(Modifier.fillMaxWidth().padding(vertical = 14.dp), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                OutlinedButton(onClick = { scope.launch { swipe(candidate, "PASS") } }, enabled = !swiping, shape = CircleShape, modifier = Modifier.size(58.dp), contentPadding = PaddingValues(0.dp)) { Icon(Icons.Default.Close, "Bỏ qua", tint = MaterialTheme.colorScheme.error) }
                Button(onClick = { scope.launch { swipe(candidate, "LIKE") } }, enabled = !swiping, shape = CircleShape, modifier = Modifier.size(64.dp), contentPadding = PaddingValues(0.dp)) { Icon(Icons.Default.Favorite, "Thích", tint = Color.White) }
            }
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }
    if (matchId != null) AlertDialog(onDismissRequest = { matchId = null }, title = { Text("It's a Match! 💜") }, text = { Text("Hai bạn cùng thích nhau. Hãy bắt đầu trò chuyện và chỉ Reveal khi cả hai đồng ý.") }, confirmButton = { TextButton(onClick = { matchId = null; onOpenChat() }) { Text("Nhắn tin") } })
    if (showFilters) {
        var minAge by remember(preferences) { mutableStateOf(preferences.minAge.toString()) }
        var maxAge by remember(preferences) { mutableStateOf(preferences.maxAge.toString()) }
        var distance by remember(preferences) { mutableStateOf(preferences.maxDistanceKm.toString()) }
        var genderPreference by remember(preferences) { mutableStateOf(preferences.genderPreference ?: "all") }
        var sameUniversity by remember(preferences) { mutableStateOf(preferences.sameUniversityOnly) }
        var saving by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { if (!saving) showFilters = false },
            title = { Text("Bộ lọc khám phá") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Hiển thị", style = MaterialTheme.typography.labelLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("all" to "Tất cả", "female" to "Nữ", "male" to "Nam").forEach { (value, label) ->
                            FilterChip(selected = genderPreference == value, onClick = { genderPreference = value }, label = { Text(label) })
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = minAge, onValueChange = { minAge = it.filter(Char::isDigit).take(2) }, label = { Text("Tuổi từ") }, modifier = Modifier.weight(1f), singleLine = true)
                        OutlinedTextField(value = maxAge, onValueChange = { maxAge = it.filter(Char::isDigit).take(2) }, label = { Text("Đến") }, modifier = Modifier.weight(1f), singleLine = true)
                    }
                    OutlinedTextField(value = distance, onValueChange = { distance = it.filter(Char::isDigit).take(3) }, label = { Text("Khoảng cách tối đa (km)") }, singleLine = true)
                    Row(verticalAlignment = Alignment.CenterVertically) { Text("Chỉ cùng PTIT", modifier = Modifier.weight(1f)); Switch(checked = sameUniversity, onCheckedChange = { sameUniversity = it }) }
                }
            },
            confirmButton = { TextButton(enabled = !saving, onClick = {
                val low = minAge.toIntOrNull() ?: 18; val high = maxAge.toIntOrNull() ?: 30; val km = distance.toIntOrNull() ?: 20
                if (low < 18 || high < low || km !in 1..100) { error = "Tuổi hợp lệ từ 18 trở lên; khoảng cách từ 1–100 km."; return@TextButton }
                scope.launch {
                    saving = true
                    try {
                        preferences = repository.updatePreferences(Preferences(genderPreference, low, high, km, sameUniversity))
                        showFilters = false; load()
                    } catch (e: Exception) { error = e.userMessage() }
                    finally { saving = false }
                }
            }) { Text(if (saving) "Đang lưu…" else "Áp dụng") } },
            dismissButton = { TextButton(enabled = !saving, onClick = { showFilters = false }) { Text("Hủy") } },
        )
    }
}

private fun Modifier.swipeCard(key: String, onSwipe: (String) -> Unit): Modifier = composed {
    var dragX by remember(key) { mutableFloatStateOf(0f) }
    graphicsLayer { translationX = dragX; rotationZ = dragX / 30f }
        .pointerInput(key) {
            detectDragGestures(onDragEnd = {
                when { dragX > 120f -> onSwipe("LIKE"); dragX < -120f -> onSwipe("PASS") }
                dragX = 0f
            }) { change, amount -> change.consume(); dragX += amount.x }
        }
}

@Composable private fun ProfileScreen(repository: FwpRepository, onLogout: () -> Unit) {
    val scope = rememberCoroutineScope(); var profile by remember { mutableStateOf<Profile?>(null) }; var options by remember { mutableStateOf<ProfileOptions?>(null) }; var name by remember { mutableStateOf("") }; var bio by remember { mutableStateOf("") }; var birth by remember { mutableStateOf("2004-01-01") }; var gpa by remember { mutableStateOf("3.0") }; var faculty by remember { mutableStateOf("") }; var gender by remember { mutableStateOf("other") }; var discoverable by remember { mutableStateOf(false) }; var message by remember { mutableStateOf("") }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null) scope.launch { try { repository.uploadPhoto(uri); profile = repository.profile(); message = "Đã tải ảnh lên" } catch (e: Exception) { message = e.userMessage() } } }
    LaunchedEffect(Unit) { try { profile = repository.profile(); options = repository.profileOptions(); name = profile?.displayName.orEmpty(); bio = profile?.bio.orEmpty(); birth = profile?.dateOfBirth ?: birth; gpa = profile?.gpa?.toString() ?: gpa; faculty = profile?.facultyId ?: options?.faculties?.firstOrNull()?.id.orEmpty(); gender = profile?.gender ?: "other"; discoverable = profile?.discoverable ?: false } catch (e: Exception) { message = e.userMessage() } }
    LazyColumn(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { item {
        Text("Hồ sơ", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text("Hồ sơ chỉ xuất hiện khi bạn chủ động bật Khám phá.", color = Color.Gray)
        if (!profile?.photos.isNullOrEmpty()) { AsyncImage(model = profile?.photos?.firstOrNull(), contentDescription = "Ảnh đại diện", modifier = Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(20.dp)), contentScale = ContentScale.Crop) }
        Field("Tên hiển thị", name) { name = it }; Field("Giới thiệu", bio) { bio = it }; Field("Ngày sinh (YYYY-MM-DD)", birth) { birth = it }; Field("GPA", gpa) { gpa = it }
        Text("Giới tính", style = MaterialTheme.typography.labelLarge)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("female" to "Nữ", "male" to "Nam", "other" to "Khác").forEach { (value, label) -> FilterChip(selected = gender == value, onClick = { gender = value }, label = { Text(label) }) } }
        Text("Khoa", style = MaterialTheme.typography.labelLarge)
        options?.faculties?.sortedByDescending { it.id == faculty }?.distinctBy { "${it.universityId}:${it.code}" }?.forEach { option ->
            FilterChip(selected = faculty == option.id, onClick = { faculty = option.id }, label = { Text(option.name) })
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text("Xuất hiện trong Khám phá", fontWeight = FontWeight.SemiBold); Text("Người khác sẽ thấy ảnh và thông tin công khai của bạn.", style = MaterialTheme.typography.bodySmall, color = Color.Gray) }; Switch(checked = discoverable, onCheckedChange = { discoverable = it }) }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { picker.launch("image/*") }, modifier = Modifier.weight(1f)) { Text("Thêm ảnh") }
            Button(onClick = { scope.launch { try { repository.updateProfile(ProfileUpdate(displayName = name, bio = bio, dateOfBirth = birth, gender = gender, gpa = gpa.toDoubleOrNull(), universityId = options?.universities?.firstOrNull()?.id ?: "a0000000-0000-0000-0000-000000000001", facultyId = faculty.ifBlank { null }, academicYear = 3, purpose = "friendship", discoverable = discoverable)); profile = repository.profile(); message = "Đã lưu hồ sơ" } catch (e: Exception) { message = e.userMessage() } } }, modifier = Modifier.weight(1f)) { Text("Lưu hồ sơ") }
        }
        if (message.isNotBlank()) Text(message, color = if (message.contains("lỗi", true)) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
        OutlinedButton(onClick = onLogout) { Text("Đăng xuất") }
    } }
}

@Composable private fun ChatScreen(repository: FwpRepository) {
    val scope = rememberCoroutineScope(); var rooms by remember { mutableStateOf<List<ChatRoom>>(emptyList()) }; var room by remember { mutableStateOf<ChatRoom?>(null) }; var messages by remember { mutableStateOf<List<ChatMessage>>(emptyList()) }; var text by remember { mutableStateOf("") }; var info by remember { mutableStateOf("") }; var peerTyping by remember { mutableStateOf(false) }; var socket by remember { mutableStateOf<ChatSocket?>(null) }
    fun select(selected: ChatRoom) { room = selected; peerTyping = false; scope.launch { try { messages = repository.messages(selected.id); val token = repository.token() ?: return@launch; socket?.disconnect(); socket = ChatSocket(BuildConfig.API_BASE_URL, token).also { ws -> ws.connect(onMessage = { json: JSONObject -> if (json.optString("chatRoomId") == selected.id) messages = (messages + ChatMessage(json.optString("id"), selected.id, json.optString("senderId"), json.optString("content"), json.optString("createdAt"))).distinctBy { it.id } }, onTyping = { json: JSONObject -> if (json.optString("roomId") == selected.id) peerTyping = json.optBoolean("typing") }, onMatch = { scope.launch { rooms = repository.rooms() } }); ws.join(selected.id) } } catch (e: Exception) { info = e.userMessage() } } }
    LaunchedEffect(Unit) { try { rooms = repository.rooms() } catch (e: Exception) { info = e.userMessage() } }
    DisposableEffect(Unit) { onDispose { socket?.disconnect() } }
    Row(Modifier.fillMaxSize().padding(12.dp)) { Column(Modifier.width(130.dp)) { Text("Kết nối", fontWeight = FontWeight.Bold); rooms.forEach { item -> TextButton(onClick = { select(item) }) { Text("Chat ${item.id.take(4)}") } }; if (rooms.isEmpty()) Text("Chưa có match", color = Color.Gray) }; Column(Modifier.weight(1f)) { Text(if (room == null) "Chọn một kết nối" else "Chat ẩn danh", style = MaterialTheme.typography.titleLarge); if (peerTyping) Text("Đang nhập…", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall); LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) { items(messages) { item -> Surface(color = if (item.senderId.isBlank()) Color.LightGray else MaterialTheme.colorScheme.secondaryContainer, shape = RoundedCornerShape(12.dp)) { Text(item.content, Modifier.padding(10.dp)) } } }; if (room != null) { Row { OutlinedTextField(value = text, onValueChange = { text = it; socket?.typing(room!!.id, it.isNotBlank()) }, label = { Text("Tin nhắn") }, modifier = Modifier.weight(1f)); Button(onClick = { val value = text.trim(); val currentRoom = room; if (value.isNotEmpty() && currentRoom != null) { scope.launch { try { if (socket?.isConnected() == true) socket?.send(currentRoom.id, value) else messages = messages + repository.sendMessage(currentRoom.id, value); text = "" } catch (e: Exception) { info = e.userMessage() } } } }) { Text("Gửi") } }; TextButton(onClick = { scope.launch { try { repository.reveal(room!!.matchId); info = "Đã gửi yêu cầu Reveal" } catch (e: Exception) { info = e.userMessage() } } }) { Text("Yêu cầu Reveal danh tính") } }; if (info.isNotBlank()) Text(info, color = MaterialTheme.colorScheme.error) } }
}

@Composable private fun Field(label: String, value: String, password: Boolean = false, onChange: (String) -> Unit) { OutlinedTextField(value = value, onValueChange = onChange, label = { Text(label) }, modifier = Modifier.fillMaxWidth(), visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None, singleLine = label != "Giới thiệu") }
@Composable private fun PrimaryButton(text: String, loading: Boolean, onClick: () -> Unit) { Button(onClick = onClick, enabled = !loading, modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) { if (loading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text(text) } }
private suspend fun runUi(action: suspend () -> Unit, failure: (String) -> Unit, loading: (Boolean) -> Unit) { loading(true); try { action() } catch (e: Exception) { failure(e.userMessage()) } finally { loading(false) } }
private fun Exception.userMessage(): String = message?.replace("HTTP ", "Lỗi ") ?: "Không thể kết nối máy chủ"

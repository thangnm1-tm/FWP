package vn.edu.ptit.fwp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import kotlinx.coroutines.launch
import org.json.JSONObject
import retrofit2.HttpException
import vn.edu.ptit.fwp.data.*
import vn.edu.ptit.fwp.realtime.ChatSocket
import vn.edu.ptit.fwp.ui.FwpTheme
import java.io.IOException

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { FwpTheme { FwpApp() } }
    }
}

private enum class Tab { DISCOVER, PROFILE, CHAT }

@Composable
private fun FwpApp() {
    val context = androidx.compose.ui.platform.LocalContext.current
    val session = remember { SessionStore(context) }
    val repository = remember { FwpRepository(context, session) }
    val scope = rememberCoroutineScope()
    var signedIn by remember { mutableStateOf(false) }
    var checkingSession by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        signedIn = session.accessToken() != null
        checkingSession = false
    }

    when {
        checkingSession -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        signedIn -> Home(repository) {
            scope.launch {
                repository.logout()
                signedIn = false
            }
        }
        else -> Auth(repository) { signedIn = true }
    }
}

@Composable
private fun Auth(repository: FwpRepository, onAuthenticated: () -> Unit) {
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf("register") }
    var pendingId by remember { mutableStateOf<String?>(null) }
    var demoOtp by remember { mutableStateOf<String?>(null) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }

    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("fw", fontSize = 42.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)
                Text("p", fontSize = 42.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.secondary)
                Icon(Icons.Default.Favorite, contentDescription = null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(32.dp))
            }
            Spacer(Modifier.height(8.dp))
            Text("Tìm người cùng tần số", style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
            Spacer(Modifier.height(8.dp))
            Text("Kết nối bạn bè PTIT theo cách của bạn", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
            Spacer(Modifier.height(28.dp))

            if (mode == "otp") {
                Text("Xác thực tài khoản", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text(
                    if (demoOtp == null) "Nhập mã OTP đã gửi tới " + email else "Chế độ demo · Mã OTP: " + demoOtp,
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(12.dp))
                FwpField(
                    label = "Mã OTP 6 số",
                    value = otp,
                    onValueChange = { otp = it.filter(Char::isDigit).take(6); error = "" },
                    keyboardType = KeyboardType.Number,
                    imeAction = ImeAction.Done,
                )
                PrimaryButton("Xác thực", loading, enabled = otp.length == 6) {
                    val userId = pendingId
                    if (userId == null) error = "Phiên đăng ký không còn hợp lệ. Hãy đăng ký lại."
                    else scope.launch {
                        runUi({ repository.verifyOtp(userId, otp); onAuthenticated() }, { error = it }, { loading = it })
                    }
                }
                TextButton(onClick = { mode = "register"; pendingId = null; demoOtp = null; otp = ""; error = "" }) {
                    Text("Đổi email đăng ký")
                }
            } else {
                Text(if (mode == "login") "Chào mừng bạn trở lại" else "Tạo tài khoản FwP", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(18.dp))
                FwpField(
                    label = "Email PTIT",
                    value = email,
                    onValueChange = { email = it.trim(); error = "" },
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next,
                )
                Spacer(Modifier.height(12.dp))
                FwpField(
                    label = "Mật khẩu",
                    value = password,
                    onValueChange = { password = it; error = "" },
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done,
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility, contentDescription = if (passwordVisible) "Ẩn mật khẩu" else "Hiện mật khẩu")
                        }
                    },
                )
                Spacer(Modifier.height(6.dp))
                Text("Dùng email sinh viên PTIT để tạo tài khoản.", modifier = Modifier.fillMaxWidth(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                PrimaryButton(
                    if (mode == "login") "Đăng nhập" else "Tạo tài khoản và gửi OTP",
                    loading,
                    enabled = email.isNotBlank() && password.isNotBlank(),
                ) {
                    if (!email.contains('@')) error = "Vui lòng nhập email hợp lệ."
                    else if (password.length < 8) error = "Mật khẩu cần có ít nhất 8 ký tự."
                    else scope.launch {
                        runUi({
                            if (mode == "login") {
                                repository.login(email, password)
                                onAuthenticated()
                            } else {
                                val result = repository.register(email, password)
                                pendingId = result.userId
                                demoOtp = result.devOtp
                                mode = "otp"
                            }
                        }, { error = it }, { loading = it })
                    }
                }
                TextButton(onClick = { mode = if (mode == "login") "register" else "login"; error = "" }) {
                    Text(if (mode == "login") "Chưa có tài khoản? Đăng ký" else "Đã có tài khoản? Đăng nhập")
                }
            }
            if (error.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
            }
            Spacer(Modifier.height(20.dp))
            Text("Kết nối an toàn · Chủ động theo cách của bạn", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun Home(repository: FwpRepository, onLogout: () -> Unit) {
    var tab by remember { mutableStateOf(Tab.DISCOVER) }
    var pendingRoomId by remember { mutableStateOf<String?>(null) }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                tonalElevation = 0.dp,
            ) {
                listOf(
                    Triple(Tab.DISCOVER, Icons.Default.Favorite, "Khám phá"),
                    Triple(Tab.PROFILE, Icons.Default.Person, "Hồ sơ"),
                    Triple(Tab.CHAT, Icons.AutoMirrored.Filled.Chat, "Chat"),
                ).forEach { (item, icon, label) ->
                    NavigationBarItem(
                        selected = tab == item,
                        onClick = { tab = item },
                        icon = { Icon(icon, contentDescription = label) },
                        label = { Text(label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.primary,
                            indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                        ),
                    )
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (tab) {
                Tab.DISCOVER -> Discover(repository, onOpenProfile = { tab = Tab.PROFILE }, onOpenChat = { roomId -> pendingRoomId = roomId; tab = Tab.CHAT }, onSessionExpired = onLogout)
                Tab.PROFILE -> ProfileScreen(repository, onLogout)
                Tab.CHAT -> ChatScreen(repository, pendingRoomId, onInitialRoomOpened = { pendingRoomId = null }, onSessionExpired = onLogout)
            }
        }
    }
}

@Composable
private fun Discover(repository: FwpRepository, onOpenProfile: () -> Unit, onOpenChat: (String) -> Unit, onSessionExpired: () -> Unit) {
    val scope = rememberCoroutineScope()
    var candidates by remember { mutableStateOf<List<Candidate>>(emptyList()) }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var swiping by remember { mutableStateOf(false) }
    var matchId by remember { mutableStateOf<String?>(null) }
    var matchedCandidate by remember { mutableStateOf<Candidate?>(null) }
    var matchedPeer by remember { mutableStateOf<ChatPeer?>(null) }
    var matchedRoomId by remember { mutableStateOf<String?>(null) }
    var selectedCandidate by remember { mutableStateOf<Candidate?>(null) }
    var preferences by remember { mutableStateOf(Preferences()) }
    var showFilters by remember { mutableStateOf(false) }

    suspend fun load() {
        loading = true
        error = ""
        try {
            preferences = repository.preferences()
            candidates = repository.recommendations().candidates
        } catch (e: Exception) {
            error = e.userMessage()
            if (e.isUnauthorized()) onSessionExpired()
        } finally {
            loading = false
        }
    }

    suspend fun swipe(candidate: Candidate, action: String): Boolean {
        if (swiping) return false
        swiping = true
        error = ""
        try {
            val result = repository.swipe(candidate, action)
            candidates = candidates.filterNot { it.candidateId == candidate.candidateId }
            if (result.matched) {
                matchId = result.matchId
                matchedCandidate = candidate
                matchedPeer = result.peer
                matchedRoomId = result.roomId
            }
            return true
        } catch (e: Exception) {
            error = e.userMessage()
            if (e.isUnauthorized()) onSessionExpired()
            return false
        } finally {
            swiping = false
        }
    }

    LaunchedEffect(Unit) { load() }

    when {
        loading -> LoadingState("Đang tìm người cùng tần số")
        candidates.isEmpty() -> EmptyDiscoverState(
            message = if (error.isNotBlank()) error else "Bạn đã xem hết gợi ý hiện tại. Hãy thử tải lại sau nhé.",
            hasError = error.isNotBlank(),
            onRetry = { scope.launch { load() } },
            onProfile = onOpenProfile,
        )
        else -> {
            val candidate = candidates.first()
            Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp)) {
                Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Khám phá", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text("Những kết nối dành cho bạn", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Surface(shape = CircleShape, color = MaterialTheme.colorScheme.surfaceVariant) {
                        Text(candidates.size.toString() + " gợi ý", modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    IconButton(onClick = { showFilters = true }, modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)) {
                        Icon(Icons.Default.Tune, contentDescription = "Bộ lọc")
                    }
                }
                Spacer(Modifier.height(8.dp))
                SwipeCard(
                    key = candidate.candidateId,
                    enabled = !swiping,
                    onSwipe = { action -> swipe(candidate, action) },
                    modifier = Modifier.fillMaxWidth().weight(1f),
                ) {
                    CandidateCard(
                        candidate = candidate,
                        isBusy = swiping,
                        onOpenDetails = { selectedCandidate = candidate },
                    )
                }
                Row(
                    Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 4.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(
                        modifier = Modifier.size(56.dp).clickable(enabled = !swiping) { scope.launch { swipe(candidate, "PASS") } },
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.surface,
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                        shadowElevation = 3.dp,
                    ) { Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Close, "Bỏ qua", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(27.dp)) } }
                    Spacer(Modifier.width(24.dp))
                    Surface(
                        modifier = Modifier.size(64.dp).clickable(enabled = !swiping) { scope.launch { swipe(candidate, "LIKE") } },
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary,
                        shadowElevation = 6.dp,
                    ) { Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Favorite, "Thích", tint = Color.White, modifier = Modifier.size(29.dp)) } }
                }
                if (error.isNotBlank()) Text(error, Modifier.fillMaxWidth().padding(top = 4.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
            }
        }
    }

    selectedCandidate?.let { candidate ->
        CandidateDetails(candidate, onDismiss = { selectedCandidate = null }, onLike = {
            selectedCandidate = null
            scope.launch { swipe(candidate, "LIKE") }
        })
    }
    if (matchId != null) {
        MatchDialog(
            candidate = matchedCandidate,
            peer = matchedPeer,
            onDismiss = { matchId = null },
            onOpenChat = {
                matchedRoomId?.let { roomId ->
                    matchId = null
                    onOpenChat(roomId)
                }
            },
        )
    }
    if (showFilters) {
        FilterDialog(
            preferences = preferences,
            onDismiss = { showFilters = false },
            onSave = { updated ->
                try {
                    preferences = repository.updatePreferences(updated)
                    showFilters = false
                    load()
                    true
                } catch (e: Exception) {
                    error = e.userMessage()
                    if (e.isUnauthorized()) onSessionExpired()
                    false
                }
            },
        )
    }
}

@Composable
private fun CandidateCard(candidate: Candidate, isBusy: Boolean, onOpenDetails: () -> Unit) {
    var photoIndex by remember(candidate.candidateId) { mutableIntStateOf(0) }
    val photos = candidate.photos
    Card(shape = RoundedCornerShape(28.dp), elevation = CardDefaults.cardElevation(defaultElevation = 5.dp)) {
        Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceVariant)) {
            val photo = photos.getOrNull(photoIndex)
            if (photo != null) {
                SubcomposeAsyncImage(
                    model = photo,
                    contentDescription = "Ảnh hồ sơ của " + (candidate.displayName ?: "thành viên FwP"),
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                ) {
                    when (painter.state) {
                        is coil.compose.AsyncImagePainter.State.Loading -> PhotoPlaceholder("Đang tải ảnh…")
                        is coil.compose.AsyncImagePainter.State.Error -> PhotoPlaceholder("Ảnh này chưa tải được")
                        else -> SubcomposeAsyncImageContent()
                    }
                }
            } else PhotoPlaceholder("FwP")

            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent, Color(0xE6000000)))))
            if (photos.size > 1) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    photos.forEachIndexed { index, _ ->
                        Box(Modifier.weight(1f).height(3.dp).clip(CircleShape).background(if (index <= photoIndex) Color.White else Color.White.copy(alpha = .42f)))
                    }
                }
                Row(Modifier.fillMaxWidth().fillMaxHeight(.72f)) {
                    Box(Modifier.weight(1f).fillMaxHeight().clickable { photoIndex = (photoIndex - 1).coerceAtLeast(0) })
                    Box(Modifier.weight(1f).fillMaxHeight().clickable { photoIndex = (photoIndex + 1).coerceAtMost(photos.lastIndex) })
                }
            }
            Column(
                Modifier.align(Alignment.BottomStart).fillMaxWidth().clickable(onClick = onOpenDetails).padding(horizontal = 20.dp, vertical = 22.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if (!candidate.faculty.isNullOrBlank() || !candidate.university.isNullOrBlank()) {
                    Text(
                        listOfNotNull(candidate.faculty, candidate.university).joinToString(" · "),
                        color = Color.White.copy(alpha = .9f),
                        style = MaterialTheme.typography.labelLarge,
                        maxLines = 1,
                    )
                }
                Text(
                    (candidate.displayName ?: "Bạn cùng tần số") + (candidate.age?.let { ", " + it } ?: ""),
                    color = Color.White,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                )
                candidate.distanceKm?.let { distance ->
                    Text("Cách bạn %.1f km".format(distance), color = Color.White.copy(alpha = .9f), style = MaterialTheme.typography.bodySmall)
                }
                if (!candidate.bio.isNullOrBlank()) Text(candidate.bio, color = Color.White, maxLines = 2, style = MaterialTheme.typography.bodyMedium)
                if (candidate.interests.isNotEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        candidate.interests.take(3).forEach { interest ->
                            Surface(color = Color.White.copy(alpha = .2f), shape = CircleShape) {
                                Text(interest, Modifier.padding(horizontal = 10.dp, vertical = 5.dp), color = Color.White, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                            }
                        }
                    }
                }
                Text("Chạm để xem hồ sơ", color = Color.White.copy(alpha = .82f), style = MaterialTheme.typography.labelSmall)
            }
            if (isBusy) Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .22f)), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color.White)
            }
        }
    }
}

@Composable
private fun PhotoPlaceholder(label: String) {
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFFFFA8B7), Color(0xFF7153D9)))), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Default.Favorite, contentDescription = null, tint = Color.White.copy(alpha = .92f), modifier = Modifier.size(38.dp))
            Text(label, color = Color.White, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun SwipeCard(
    key: String,
    enabled: Boolean,
    onSwipe: suspend (String) -> Boolean,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    var dragX by remember(key) { mutableFloatStateOf(0f) }
    var locked by remember(key) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val animatedX by animateFloatAsState(dragX, animationSpec = spring(dampingRatio = .72f, stiffness = 360f), label = "cardDrag")
    Box(
        modifier
            .graphicsLayer { translationX = animatedX; rotationZ = animatedX / 34f }
            .pointerInput(key, enabled, locked) {
                detectDragGestures(
                    onDragEnd = {
                        val threshold = size.width * .24f
                        val direction = when {
                            !enabled || locked -> null
                            dragX > threshold -> "LIKE"
                            dragX < -threshold -> "PASS"
                            else -> null
                        }
                        if (direction == null) dragX = 0f
                        else {
                            locked = true
                            dragX = if (direction == "LIKE") size.width * 1.15f else -size.width * 1.15f
                            scope.launch {
                                val accepted = onSwipe(direction)
                                if (!accepted) {
                                    dragX = 0f
                                    locked = false
                                }
                            }
                        }
                    },
                    onDragCancel = { dragX = 0f },
                ) { change, amount ->
                    if (enabled && !locked) {
                        change.consume()
                        dragX = (dragX + amount.x).coerceIn(-size.width * .8f, size.width * .8f)
                    }
                }
            },
    ) {
        content()
        if (animatedX > 18f) SwipeStamp("LIKE", MaterialTheme.colorScheme.secondary, Alignment.TopStart, animatedX)
        if (animatedX < -18f) SwipeStamp("NOPE", Color.White, Alignment.TopEnd, animatedX)
    }
}

@Composable
private fun BoxScope.SwipeStamp(label: String, color: Color, alignment: Alignment, offset: Float) {
    val tint by animateColorAsState(color.copy(alpha = (kotlin.math.abs(offset) / 120f).coerceIn(.55f, 1f)), label = "stampTint")
    Surface(
        Modifier.align(alignment).padding(24.dp).graphicsLayer { rotationZ = if (label == "LIKE") -14f else 14f },
        shape = RoundedCornerShape(10.dp),
        color = if (label == "NOPE") Color(0xFFD84C64).copy(alpha = .88f) else Color.White.copy(alpha = .92f),
        border = BorderStroke(3.dp, tint),
    ) { Text(label, Modifier.padding(horizontal = 12.dp, vertical = 6.dp), color = if (label == "NOPE") Color.White else tint, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleMedium) }
}

@Composable
private fun CandidateDetails(candidate: Candidate, onDismiss: () -> Unit, onLike: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(candidate.displayName ?: "Hồ sơ thành viên") },
        text = {
            Column(Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                candidate.photos.firstOrNull()?.let { photo ->
                    SubcomposeAsyncImage(model = photo, contentDescription = "Ảnh hồ sơ", modifier = Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(20.dp)), contentScale = ContentScale.Crop) {
                        when (painter.state) {
                            is coil.compose.AsyncImagePainter.State.Error -> PhotoPlaceholder("Ảnh chưa tải được")
                            is coil.compose.AsyncImagePainter.State.Loading -> PhotoPlaceholder("Đang tải ảnh…")
                            else -> SubcomposeAsyncImageContent()
                        }
                    }
                }
                Text(listOfNotNull(candidate.age?.let { it.toString() + " tuổi" }, candidate.faculty, candidate.university).joinToString(" · "), color = MaterialTheme.colorScheme.onSurfaceVariant)
                candidate.distanceKm?.let { Text("Cách bạn %.1f km".format(it), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                candidate.bio?.takeIf { it.isNotBlank() }?.let { Text(it) }
                if (candidate.interests.isNotEmpty()) {
                    Text("Sở thích", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    candidate.interests.forEach { Text("•  " + it) }
                }
            }
        },
        confirmButton = { Button(onClick = onLike) { Icon(Icons.Default.Favorite, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("Thích") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Đóng") } },
    )
}

@Composable
private fun MatchDialog(candidate: Candidate?, peer: ChatPeer?, onDismiss: () -> Unit, onOpenChat: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Favorite, contentDescription = null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(42.dp)) },
        title = { Text("Hai bạn vừa kết nối!", textAlign = TextAlign.Center) },
        text = {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                val displayName = peer?.displayName?.takeIf { it.isNotBlank() } ?: candidate?.displayName ?: "Người bạn mới"
                val photo = peer?.avatarUrl?.takeIf { it.isNotBlank() } ?: peer?.photos?.firstOrNull() ?: candidate?.photos?.firstOrNull()
                photo?.let {
                    SubcomposeAsyncImage(model = it, contentDescription = "Ảnh của $displayName", modifier = Modifier.size(104.dp).clip(CircleShape), contentScale = ContentScale.Crop) {
                        when (painter.state) {
                            is coil.compose.AsyncImagePainter.State.Error -> PhotoPlaceholder("Ảnh chưa tải được")
                            is coil.compose.AsyncImagePainter.State.Loading -> PhotoPlaceholder("Đang tải ảnh…")
                            else -> SubcomposeAsyncImageContent()
                        }
                    }
                }
                Text(displayName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Hai bạn đã kết nối. Gửi lời chào đầu tiên nhé!", textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        confirmButton = { Button(onClick = onOpenChat) { Text("Nhắn tin") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Tiếp tục khám phá") } },
    )
}

@Composable
private fun FilterDialog(preferences: Preferences, onDismiss: () -> Unit, onSave: suspend (Preferences) -> Boolean) {
    val scope = rememberCoroutineScope()
    var minAge by remember(preferences) { mutableStateOf(preferences.minAge.toString()) }
    var maxAge by remember(preferences) { mutableStateOf(preferences.maxAge.toString()) }
    var distance by remember(preferences) { mutableStateOf(preferences.maxDistanceKm.toString()) }
    var gender by remember(preferences) { mutableStateOf(preferences.genderPreference ?: "all") }
    var sameUniversity by remember(preferences) { mutableStateOf(preferences.sameUniversityOnly) }
    var error by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!saving) onDismiss() },
        title = { Text("Bộ lọc khám phá") },
        text = {
            Column(Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Ai có thể xuất hiện?", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf("all" to "Tất cả", "female" to "Nữ", "male" to "Nam").forEach { (value, label) ->
                        FilterChip(selected = gender == value, onClick = { gender = value }, label = { Text(label) })
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FwpField("Tuổi từ", minAge, { minAge = it.filter(Char::isDigit).take(2) }, modifier = Modifier.weight(1f), keyboardType = KeyboardType.Number)
                    FwpField("Đến", maxAge, { maxAge = it.filter(Char::isDigit).take(2) }, modifier = Modifier.weight(1f), keyboardType = KeyboardType.Number)
                }
                FwpField("Khoảng cách tối đa (km)", distance, { distance = it.filter(Char::isDigit).take(3) }, keyboardType = KeyboardType.Number)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Ưu tiên cùng PTIT", modifier = Modifier.weight(1f))
                    Switch(checked = sameUniversity, onCheckedChange = { sameUniversity = it })
                }
                if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        },
        confirmButton = {
            TextButton(enabled = !saving, onClick = {
                val low = minAge.toIntOrNull() ?: 18
                val high = maxAge.toIntOrNull() ?: 30
                val km = distance.toIntOrNull() ?: 20
                if (low < 18 || high < low || km !in 1..100) error = "Tuổi phải từ 18 trở lên và khoảng cách từ 1 đến 100 km."
                else scope.launch {
                    saving = true
                    val saved = onSave(Preferences(gender, low, high, km, sameUniversity))
                    saving = false
                    if (!saved) error = "Không lưu được bộ lọc. Hãy thử lại."
                }
            }) { Text(if (saving) "Đang lưu…" else "Áp dụng") }
        },
        dismissButton = { TextButton(enabled = !saving, onClick = onDismiss) { Text("Hủy") } },
    )
}

@Composable
private fun LoadingState(label: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
            CircularProgressIndicator()
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun EmptyDiscoverState(message: String, hasError: Boolean, onRetry: () -> Unit, onProfile: () -> Unit) {
    Box(Modifier.fillMaxSize().padding(28.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primaryContainer, modifier = Modifier.size(76.dp)) {
                Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.FavoriteBorder, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(34.dp)) }
            }
            Text(if (hasError) "Chưa tải được gợi ý" else "Tạm hết gợi ý", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(message, textAlign = TextAlign.Center, color = if (hasError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
            OutlinedButton(onClick = onRetry) { Icon(Icons.Default.Refresh, null); Spacer(Modifier.width(8.dp)); Text("Thử lại") }
            if (!hasError) TextButton(onClick = onProfile) { Text("Hoàn thiện hồ sơ") }
        }
    }
}

@Composable
private fun ProfileScreen(repository: FwpRepository, onLogout: () -> Unit) {
    val scope = rememberCoroutineScope()
    var profile by remember { mutableStateOf<Profile?>(null) }
    var options by remember { mutableStateOf<ProfileOptions?>(null) }
    var name by remember { mutableStateOf("") }
    var bio by remember { mutableStateOf("") }
    var birth by remember { mutableStateOf("") }
    var gpa by remember { mutableStateOf("") }
    var faculty by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("other") }
    var discoverable by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var messageIsError by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var uploading by remember { mutableStateOf(false) }

    suspend fun refreshProfile() {
        loading = true
        try {
            profile = repository.profile()
            options = repository.profileOptions()
            name = profile?.displayName.orEmpty()
            bio = profile?.bio.orEmpty()
            birth = profile?.dateOfBirth.orEmpty()
            gpa = profile?.gpa?.toString().orEmpty()
            faculty = profile?.facultyId ?: options?.faculties?.firstOrNull()?.id.orEmpty()
            gender = profile?.gender ?: "other"
            discoverable = profile?.discoverable ?: false
            message = ""
        } catch (e: Exception) {
            message = e.userMessage()
            messageIsError = true
            if (e.isUnauthorized()) onLogout()
        } finally {
            loading = false
        }
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) scope.launch {
            uploading = true
            try {
                repository.uploadPhoto(uri)
                profile = repository.profile()
                message = "Ảnh đã được tải lên."
                messageIsError = false
            } catch (e: Exception) {
                message = e.userMessage()
                messageIsError = true
                if (e.isUnauthorized()) onLogout()
            } finally {
                uploading = false
            }
        }
    }

    LaunchedEffect(Unit) { refreshProfile() }

    if (loading && profile == null) LoadingState("Đang tải hồ sơ")
    else LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 18.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text("Hồ sơ của bạn", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("Hãy chia sẻ điều khiến bạn là chính mình.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        item {
            Text("Ảnh của bạn", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            if (profile?.photos.isNullOrEmpty()) {
                Surface(
                    Modifier.fillMaxWidth().height(180.dp).clickable(enabled = !uploading) { picker.launch("image/*") },
                    shape = RoundedCornerShape(22.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Icon(Icons.Default.Person, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(42.dp))
                        Text(if (uploading) "Đang tải ảnh…" else "Thêm ảnh đại diện", fontWeight = FontWeight.SemiBold)
                        Text("Ảnh rõ mặt giúp mọi người nhận ra bạn", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    profile?.photos?.take(4)?.forEachIndexed { index, photo ->
                        SubcomposeAsyncImage(
                            model = photo,
                            contentDescription = if (index == 0) "Ảnh đại diện" else "Ảnh hồ sơ " + (index + 1),
                            modifier = Modifier.weight(1f).height(150.dp).clip(RoundedCornerShape(18.dp)),
                            contentScale = ContentScale.Crop,
                        ) {
                            when (painter.state) {
                                is coil.compose.AsyncImagePainter.State.Error -> PhotoPlaceholder("Ảnh lỗi")
                                is coil.compose.AsyncImagePainter.State.Loading -> PhotoPlaceholder("Đang tải…")
                                else -> SubcomposeAsyncImageContent()
                            }
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = { picker.launch("image/*") }, enabled = !uploading, modifier = Modifier.fillMaxWidth()) {
                    Text(if (uploading) "Đang tải ảnh…" else "Thêm ảnh")
                }
            }
        }
        item {
            Text("Thông tin cơ bản", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            FwpField("Tên hiển thị", name, { name = it; message = "" })
            Spacer(Modifier.height(10.dp))
            FwpField("Giới thiệu về bạn", bio, { bio = it; message = "" }, singleLine = false, minLines = 3)
            Spacer(Modifier.height(10.dp))
            FwpField("Ngày sinh (YYYY-MM-DD)", birth, { birth = it; message = "" })
            Spacer(Modifier.height(10.dp))
            FwpField("GPA (không bắt buộc)", gpa, { gpa = it; message = "" }, keyboardType = KeyboardType.Decimal)
        }
        item {
            Text("Giới tính", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("female" to "Nữ", "male" to "Nam", "other" to "Khác").forEach { (value, label) ->
                    FilterChip(selected = gender == value, onClick = { gender = value }, label = { Text(label) })
                }
            }
        }
        if (!options?.faculties.isNullOrEmpty()) item {
            Text("Khoa", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                options?.faculties?.distinctBy { it.id }?.forEach { option ->
                    FilterChip(selected = faculty == option.id, onClick = { faculty = option.id }, label = { Text(option.name) })
                }
            }
        }
        item {
            Surface(shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Xuất hiện trong Khám phá", fontWeight = FontWeight.SemiBold)
                        Text("Bạn có thể tắt bất cứ lúc nào.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(checked = discoverable, onCheckedChange = { discoverable = it })
                }
            }
        }
        item {
            Button(
                onClick = {
                    val universityId = profile?.universityId ?: options?.universities?.firstOrNull()?.id
                    if (universityId == null) {
                        message = "Chưa tải được thông tin trường. Hãy thử tải lại hồ sơ."
                        messageIsError = true
                    } else scope.launch {
                        saving = true
                        try {
                            repository.updateProfile(
                                ProfileUpdate(
                                    displayName = name.trim(), bio = bio.trim(), dateOfBirth = birth.ifBlank { null },
                                    gender = gender, gpa = gpa.toDoubleOrNull(), universityId = universityId,
                                    facultyId = faculty.ifBlank { null }, academicYear = profile?.academicYear ?: 1,
                                    purpose = profile?.purpose ?: "friendship", discoverable = discoverable,
                                ),
                            )
                            profile = repository.profile()
                            message = "Đã lưu hồ sơ."
                            messageIsError = false
                        } catch (e: Exception) {
                            message = e.userMessage()
                            messageIsError = true
                            if (e.isUnauthorized()) onLogout()
                        } finally {
                            saving = false
                        }
                    }
                },
                enabled = !saving && !uploading,
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                shape = RoundedCornerShape(16.dp),
            ) { Text(if (saving) "Đang lưu…" else "Lưu thay đổi") }
            if (message.isNotBlank()) Text(message, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), color = if (messageIsError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary, textAlign = TextAlign.Center)
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) { Text("Đăng xuất") }
        }
    }
}

@Composable
private fun ChatScreen(repository: FwpRepository, initialRoomId: String?, onInitialRoomOpened: () -> Unit, onSessionExpired: () -> Unit) {
    val scope = rememberCoroutineScope()
    var rooms by remember { mutableStateOf<List<ChatRoom>>(emptyList()) }
    var room by remember { mutableStateOf<ChatRoom?>(null) }
    var messages by remember { mutableStateOf<List<ChatMessage>>(emptyList()) }
    var text by remember { mutableStateOf("") }
    var info by remember { mutableStateOf("") }
    var infoIsError by remember { mutableStateOf(false) }
    var peerTyping by remember { mutableStateOf(false) }
    var socket by remember { mutableStateOf<ChatSocket?>(null) }
    var loading by remember { mutableStateOf(true) }
    var sending by remember { mutableStateOf(false) }
    var currentUserId by remember { mutableStateOf("") }

    suspend fun loadRooms() {
        loading = true
        try {
            rooms = repository.rooms()
            currentUserId = repository.profile().userId.orEmpty()
            info = ""
        } catch (e: Exception) {
            info = e.userMessage()
            infoIsError = true
            if (e.isUnauthorized()) onSessionExpired()
        } finally {
            loading = false
        }
    }

    fun select(selected: ChatRoom) {
        room = selected
        messages = emptyList()
        info = ""
        peerTyping = false
        scope.launch {
            try {
                messages = repository.messages(selected.id)
                val token = repository.token() ?: return@launch
                socket?.disconnect()
                val ws = ChatSocket(BuildConfig.API_BASE_URL, token)
                socket = ws
                ws.connect(
                    onMessage = { json: JSONObject ->
                        if (json.optString("chatRoomId") == selected.id) {
                            messages = (messages + ChatMessage(json.optString("id"), selected.id, json.optString("senderId"), json.optString("content"), json.optString("createdAt"))).distinctBy { it.id }
                        }
                    },
                    onTyping = { json: JSONObject -> if (json.optString("roomId") == selected.id) peerTyping = json.optBoolean("typing") },
                    onMatch = { scope.launch { loadRooms() } },
                )
                ws.join(selected.id)
            } catch (e: Exception) {
                info = e.userMessage()
                infoIsError = true
                if (e.isUnauthorized()) onSessionExpired()
            }
        }
    }

    LaunchedEffect(Unit) { loadRooms() }
    LaunchedEffect(initialRoomId, rooms, loading) {
        if (initialRoomId != null && !loading) {
            val targetRoom = rooms.firstOrNull { it.id == initialRoomId }
            if (targetRoom != null) {
                select(targetRoom)
            } else {
                info = "Không tìm thấy phòng chat vừa kết nối. Hãy tải lại danh sách."
                infoIsError = true
            }
            onInitialRoomOpened()
        }
    }
    DisposableEffect(Unit) { onDispose { socket?.disconnect() } }

    val currentRoom = room
    if (currentRoom == null) {
        Column(Modifier.fillMaxSize().padding(horizontal = 18.dp, vertical = 16.dp)) {
            Text("Kết nối", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("Những cuộc trò chuyện của bạn", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(14.dp))
            when {
                loading -> LoadingState("Đang tải cuộc trò chuyện")
                rooms.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Icon(Icons.AutoMirrored.Filled.Chat, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(42.dp))
                        Text(if (infoIsError) "Chưa tải được cuộc trò chuyện" else "Chưa có cuộc trò chuyện", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(if (infoIsError) info else "Khi hai bạn cùng thích nhau, kết nối sẽ xuất hiện tại đây.", textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        OutlinedButton(onClick = { scope.launch { loadRooms() } }) { Text("Tải lại") }
                    }
                }
                else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(rooms, key = { it.id }) { chatRoom ->
                        Surface(
                            Modifier.fillMaxWidth().clickable { select(chatRoom) },
                            shape = RoundedCornerShape(18.dp),
                            color = MaterialTheme.colorScheme.surface,
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                        ) {
                            Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                ChatAvatar(chatRoom.peerAvatarUrl ?: chatRoom.peerPhotos.firstOrNull(), chatRoom.peerDisplayName, Modifier.size(54.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(chatRoom.peerDisplayName?.takeIf { it.isNotBlank() } ?: "Người dùng FwP", fontWeight = FontWeight.SemiBold)
                                    Text(
                                        chatRoom.lastMessage?.takeIf { it.isNotBlank() } ?: "Đã kết nối · Chạm để trò chuyện",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 1,
                                    )
                                }
                                Icon(Icons.AutoMirrored.Filled.Chat, null, tint = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
            }
        }
    } else {
        Column(Modifier.fillMaxSize().imePadding()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { socket?.disconnect(); socket = null; room = null; peerTyping = false }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Quay lại") }
                ChatAvatar(currentRoom.peerAvatarUrl ?: currentRoom.peerPhotos.firstOrNull(), currentRoom.peerDisplayName, Modifier.size(42.dp))
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(currentRoom.peerDisplayName?.takeIf { it.isNotBlank() } ?: "Người dùng FwP", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(if (peerTyping) "Đang nhập…" else "Đã kết nối", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            LazyColumn(
                Modifier.weight(1f).fillMaxWidth().padding(horizontal = 14.dp),
                contentPadding = PaddingValues(vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (messages.isEmpty()) item {
                    Text("Bắt đầu bằng một lời chào thân thiện.", Modifier.fillMaxWidth().padding(top = 32.dp), textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                items(messages, key = { it.id }) { item ->
                    val isMine = currentUserId.isNotBlank() && item.senderId == currentUserId
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (isMine) Arrangement.End else Arrangement.Start) {
                        Surface(
                            shape = if (isMine) RoundedCornerShape(18.dp, 18.dp, 5.dp, 18.dp) else RoundedCornerShape(18.dp, 18.dp, 18.dp, 5.dp),
                            color = if (isMine) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                        ) {
                            Text(item.content, Modifier.widthIn(max = 280.dp).padding(horizontal = 14.dp, vertical = 10.dp))
                        }
                    }
                }
            }
            if (info.isNotBlank()) Text(info, Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp), color = if (infoIsError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it; socket?.typing(currentRoom.id, it.isNotBlank()) },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Nhập tin nhắn…") },
                    shape = RoundedCornerShape(24.dp),
                    maxLines = 4,
                )
                FilledIconButton(
                    onClick = {
                        val value = text.trim()
                        if (value.isNotEmpty() && !sending) scope.launch {
                            sending = true
                            try {
                                val activeSocket = socket
                                if (activeSocket?.isConnected() == true) activeSocket.send(currentRoom.id, value)
                                else messages = messages + repository.sendMessage(currentRoom.id, value)
                                text = ""
                                info = ""
                            } catch (e: Exception) {
                                info = e.userMessage()
                                infoIsError = true
                                if (e.isUnauthorized()) onSessionExpired()
                            } finally {
                                sending = false
                            }
                        }
                    },
                    enabled = text.isNotBlank() && !sending,
                ) { Icon(Icons.AutoMirrored.Filled.Send, "Gửi tin nhắn") }
            }
        }
    }
}

@Composable
private fun ChatAvatar(photoUrl: String?, displayName: String?, modifier: Modifier = Modifier) {
    val shape = CircleShape
    if (!photoUrl.isNullOrBlank()) {
        SubcomposeAsyncImage(
            model = photoUrl,
            contentDescription = "Ảnh đại diện ${displayName?.takeIf { it.isNotBlank() } ?: "đối phương"}",
            modifier = modifier.clip(shape),
            contentScale = ContentScale.Crop,
        ) {
            when (painter.state) {
                is coil.compose.AsyncImagePainter.State.Error -> PhotoPlaceholder("Ảnh lỗi")
                is coil.compose.AsyncImagePainter.State.Loading -> PhotoPlaceholder("Đang tải…")
                else -> SubcomposeAsyncImageContent()
            }
        }
    } else {
        Surface(shape = shape, color = MaterialTheme.colorScheme.primaryContainer, modifier = modifier) {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Person, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(28.dp))
            }
        }
    }
}

@Composable
private fun FwpField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier.fillMaxWidth(),
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Next,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailingIcon: (@Composable () -> Unit)? = null,
    singleLine: Boolean = true,
    minLines: Int = 1,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        label = { Text(label) },
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction),
        visualTransformation = visualTransformation,
        trailingIcon = trailingIcon,
        singleLine = singleLine,
        minLines = minLines,
        shape = RoundedCornerShape(15.dp),
    )
}

@Composable
private fun PrimaryButton(text: String, loading: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = Modifier.fillMaxWidth().padding(top = 12.dp).heightIn(min = 52.dp),
        shape = RoundedCornerShape(16.dp),
    ) {
        if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
        else Text(text, fontWeight = FontWeight.SemiBold)
    }
}

private suspend fun runUi(action: suspend () -> Unit, failure: (String) -> Unit, loading: (Boolean) -> Unit) {
    loading(true)
    try {
        action()
    } catch (e: Exception) {
        failure(e.userMessage())
    } finally {
        loading(false)
    }
}

private fun Exception.userMessage(): String = when (this) {
    is HttpException -> when (code()) {
        400 -> "Thông tin chưa đúng. Vui lòng kiểm tra lại."
        401 -> "Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại."
        403 -> "Tài khoản chưa được phép thực hiện thao tác này."
        404 -> "Không tìm thấy dữ liệu yêu cầu."
        409 -> "Tài khoản này đã tồn tại hoặc thao tác bị trùng. Hãy đăng nhập nếu bạn đã có tài khoản."
        429 -> "Bạn thao tác quá nhanh. Hãy đợi một chút rồi thử lại."
        in 500..599 -> "Máy chủ đang gặp sự cố. Vui lòng thử lại sau."
        else -> "Không thể hoàn tất yêu cầu. Vui lòng thử lại."
    }
    is IOException -> "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại."
    else -> "Đã có lỗi xảy ra. Vui lòng thử lại."
}

private fun Exception.isUnauthorized(): Boolean = this is HttpException && code() == 401

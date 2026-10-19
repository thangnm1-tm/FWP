package vn.edu.ptit.fwp.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val FwpColors = lightColorScheme(
    primary = Color(0xFFE94F70),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFE1E7),
    onPrimaryContainer = Color(0xFF541224),
    secondary = Color(0xFF7054D8),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFEAE4FF),
    onSecondaryContainer = Color(0xFF25145E),
    background = Color(0xFFFFF9F8),
    onBackground = Color(0xFF21191B),
    surface = Color.White,
    onSurface = Color(0xFF21191B),
    surfaceVariant = Color(0xFFF4ECEE),
    onSurfaceVariant = Color(0xFF6E6063),
    outline = Color(0xFF85777A),
    outlineVariant = Color(0xFFE4D9DC),
    error = Color(0xFFBA1A1A),
)

@Composable
fun FwpTheme(content: @Composable () -> Unit) = MaterialTheme(
    colorScheme = FwpColors,
    content = content,
)

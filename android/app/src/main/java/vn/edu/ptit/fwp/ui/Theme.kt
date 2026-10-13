package vn.edu.ptit.fwp.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val FwpColors = lightColorScheme(primary = Color(0xFF6C4BD9), secondary = Color(0xFFEE5376), background = Color(0xFFFFF9FC), surface = Color.White)
@Composable fun FwpTheme(content: @Composable () -> Unit) = MaterialTheme(colorScheme = FwpColors, content = content)

package vn.edu.ptit.fwp.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.dataStore by preferencesDataStore("fwp_session")
class SessionStore(private val context: Context) {
    private val accessToken = stringPreferencesKey("access_token")
    private val refreshToken = stringPreferencesKey("refresh_token")
    suspend fun accessToken() = context.dataStore.data.first()[accessToken]
    suspend fun refreshToken() = context.dataStore.data.first()[refreshToken]
    suspend fun save(tokens: TokenResponse) { context.dataStore.edit { it[accessToken] = tokens.accessToken; it[refreshToken] = tokens.refreshToken } }
    suspend fun clear() { context.dataStore.edit { preferences -> preferences.remove(accessToken); preferences.remove(refreshToken) } }
}

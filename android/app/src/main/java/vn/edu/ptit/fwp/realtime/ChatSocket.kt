package vn.edu.ptit.fwp.realtime

import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URLEncoder

class ChatSocket(baseUrl: String, token: String) {
    private val socket: Socket = IO.socket(baseUrl.removeSuffix("/") + "/chat?token=" + URLEncoder.encode(token, "UTF-8"))
    private var pendingRoomId: String? = null
    fun connect(onMessage: (JSONObject) -> Unit, onTyping: (JSONObject) -> Unit, onMatch: () -> Unit) {
        socket.on("message:new") { args -> (args.firstOrNull() as? JSONObject)?.let(onMessage) }
        socket.on("typing") { args -> (args.firstOrNull() as? JSONObject)?.let(onTyping) }
        socket.on("match:new") { onMatch() }
        socket.on(Socket.EVENT_CONNECT) { _ -> pendingRoomId?.let(::joinNow) }
        socket.connect()
    }
    fun join(roomId: String) { pendingRoomId = roomId; if (socket.connected()) joinNow(roomId) }
    private fun joinNow(roomId: String) = socket.emit("room:join", JSONObject().put("roomId", roomId))
    fun send(roomId: String, content: String) = socket.emit("message:send", JSONObject().put("roomId", roomId).put("content", content))
    fun typing(roomId: String, active: Boolean) = socket.emit(if (active) "typing:start" else "typing:stop", JSONObject().put("roomId", roomId))
    fun isConnected() = socket.connected()
    fun disconnect() = socket.disconnect()
}

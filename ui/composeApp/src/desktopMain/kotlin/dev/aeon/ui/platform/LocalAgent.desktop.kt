package dev.aeon.ui.platform

import java.io.File
import java.net.InetSocketAddress
import java.net.Socket
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/** The two files the desktop agent needs: a Node.js runtime and the compiled agent's entry point (see tools/package-agent.mjs). */
internal class AgentFiles(val runtime: File, val entry: File) {
    val complete: Boolean get() = runtime.isFile && entry.isFile
}

/**
 * Where the installer put the agent. The installer carries `agent/runtime/node(.exe)` and `agent/project/node/mobile-main.js`
 * next to the app (decision D36). `AEON_AGENT_DIR` points at such a folder instead (a developer's, or a test's).
 */
internal fun findAgentFiles(env: (String) -> String? = System::getenv, property: (String) -> String? = System::getProperty): AgentFiles? {
    val dir = env("AEON_AGENT_DIR")?.takeIf { it.isNotBlank() }?.let(::File)
        ?: property("compose.application.resources.dir")?.takeIf { it.isNotBlank() }?.let { File(it, "agent") }
        ?: return null
    val runtime = File(dir, "runtime/" + if (System.getProperty("os.name").orEmpty().startsWith("Windows")) "node.exe" else "node")
    return AgentFiles(runtime, File(dir, "project/node/mobile-main.js")).takeIf { it.complete }
}

/** Where the agent keeps its data and where it may work: its own folder in the user's settings, and "Documents/Aeon". */
internal fun defaultAgentFolders(env: (String) -> String? = System::getenv, home: String = System.getProperty("user.home")): Pair<File, File> {
    val windows = System.getProperty("os.name").orEmpty().startsWith("Windows")
    val settings = if (windows) File(env("APPDATA")?.takeIf { it.isNotBlank() } ?: "$home/AppData/Roaming", "Aeon")
    else File(env("XDG_CONFIG_HOME")?.takeIf { it.isNotBlank() } ?: "$home/.config", "aeon")
    return File(settings, "agent") to File(home, "Documents/Aeon")
}

/**
 * The agent running on this computer: the app starts the Node.js runtime that came with it on the compiled server, on the
 * loopback address only (nothing else on the network can reach it), and takes its pairing code from a file that only this
 * user can read. The same arrangement as on a phone (see LocalAgent.android.kt); only the way the process is started differs.
 * The agent is stopped when the app ends; what it was doing is on disk and continues the next time.
 */
internal class DesktopLocalAgent(
    private val files: AgentFiles?,
    private val configDir: File,
    private val workspace: File,
    private val port: Int = 7421,
    private val startupMs: Long = 30_000,
) : LocalAgentHost {
    override val available: Boolean get() = files?.complete == true
    override val deviceNoun: String get() = "이 컴퓨터"
    override val isComputer: Boolean get() = true

    override var onProgress: ((Int, String) -> Unit)? = null
    private fun say(stage: Int, line: String) { onProgress?.invoke(stage, line) }

    private val lock = Mutex()
    @Volatile private var process: Process? = null

    /** Registered the first time an agent is started: the agent goes when the app does. */
    private val stopWithApp: Unit by lazy { Runtime.getRuntime().addShutdownHook(Thread { stop() }) }

    /** One plain HTTP request to the loopback agent; a raw socket keeps it free of proxy and certificate settings. */
    private fun answers(): Boolean = try {
        Socket().use { s ->
            s.connect(InetSocketAddress("127.0.0.1", port), 400)
            s.soTimeout = 800
            s.getOutputStream().apply { write("GET /v1/hello HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n".toByteArray()); flush() }
            String(s.getInputStream().readBytes()).contains("\"api\"")
        }
    } catch (e: Exception) {
        false
    }

    private fun tail(file: File, n: Int = 12): List<String> =
        runCatching { file.readLines().filter { it.isNotBlank() }.takeLast(n) }.getOrDefault(emptyList())

    override suspend fun start(): String? = withContext(Dispatchers.IO) {
        lock.withLock {
            val f = files?.takeIf { it.complete } ?: return@withLock "이 앱에는 에이전트가 들어 있지 않아요. 설치 파일로 설치한 앱에서 쓸 수 있어요."
            try {
                if (answers()) {
                    say(2, "에이전트가 이미 켜져 있어요")
                    return@withLock null
                }
                say(0, "에이전트 파일을 확인해요")
                configDir.mkdirs()
                workspace.mkdirs()
                File(configDir, "node-error.log").delete()
                forgetPairingCode()
                say(1, "에이전트를 켜요")
                val log = File(configDir, "agent.log")
                val p = ProcessBuilder(f.runtime.absolutePath, f.entry.absolutePath, configDir.absolutePath, workspace.absolutePath, port.toString())
                    .directory(configDir)
                    .redirectErrorStream(true)
                    .redirectOutput(log)
                    .start()
                process = p
                stopWithApp
                say(2, "응답을 기다려요 (최대 ${startupMs / 1000}초)")
                val end = System.currentTimeMillis() + startupMs
                while (System.currentTimeMillis() < end) {
                    if (answers()) {
                        say(2, "에이전트가 응답했어요")
                        return@withLock null
                    }
                    if (!p.isAlive) {
                        val lines = tail(File(configDir, "node-error.log")) + tail(log, 6)
                        lines.forEach { say(2, it) }
                        return@withLock if (lines.any { it.contains("EADDRINUSE") }) "이 컴퓨터의 $port 번 연결 통로를 다른 프로그램이 쓰고 있어서 시작하지 못했어요. 그 프로그램을 끄고 다시 시도해 주세요."
                        else "에이전트가 시작하자마자 멈췄어요. 아래 로그를 복사해서 알려 주세요."
                    }
                    delay(300)
                }
                tail(File(configDir, "node-error.log")).forEach { say(2, it) }
                "${startupMs / 1000}초 안에 에이전트가 응답하지 않았어요. 아래 로그를 복사해서 알려 주세요."
            } catch (e: Throwable) {
                say(2, "예외: ${e.message}")
                "에이전트를 시작하지 못했어요: ${e.message}"
            }
        }
    }

    override suspend fun pairingCode(): String? = withContext(Dispatchers.IO) {
        val code = File(configDir, "pairing-code.txt")
        code.delete()
        File(configDir, "pairing-code.txt.request").writeText("1")
        repeat(60) {
            delay(150)
            val text = runCatching { code.readText().trim() }.getOrDefault("")
            if (text.length == 16) return@withContext text
        }
        null
    }

    /** The one-time code is of no use once the app has paired or ended: do not leave it lying in the folder. */
    private fun forgetPairingCode() {
        File(configDir, "pairing-code.txt").delete()
        File(configDir, "pairing-code.txt.request").delete()
    }

    /** Stops the agent this app started (not one that was already running). */
    fun stop() {
        process?.let { p -> runCatching { p.destroy(); if (!p.waitFor(2, java.util.concurrent.TimeUnit.SECONDS)) p.destroyForcibly() } }
        process = null
        forgetPairingCode()
    }
}

actual fun localAgentHost(): LocalAgentHost {
    val (cfg, ws) = defaultAgentFolders()
    return DesktopLocalAgent(findAgentFiles(), cfg, ws)
}

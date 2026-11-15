package dev.aeon.ui

import dev.aeon.ui.platform.AgentFiles
import dev.aeon.ui.platform.DesktopLocalAgent
import dev.aeon.ui.platform.defaultAgentFolders
import dev.aeon.ui.platform.findAgentFiles
import kotlinx.coroutines.runBlocking
import java.io.File
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.file.Files
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The agent that runs inside the desktop app (decision D36): found next to the app, started on the Node.js runtime that
 * came with it, paired by a file, stopped with the app. The real compiled agent (`npm run build:mobile`) runs here; the
 * CI job builds it first.
 */
class DesktopLocalAgentTest {
    private val cleanup = mutableListOf<() -> Unit>()

    @AfterTest
    fun tearDown() = cleanup.reversed().forEach { runCatching(it) }

    private fun tmp(): File = Files.createTempDirectory("aeon-desktop-agent").toFile().also { d -> cleanup += { d.deleteRecursively() } }

    private fun freePort(): Int = ServerSocket(0, 0, java.net.InetAddress.getLoopbackAddress()).use { it.localPort }

    private fun node(): File {
        val exe = if (System.getProperty("os.name").startsWith("Windows")) "node.exe" else "node"
        return System.getenv("PATH").orEmpty().split(File.pathSeparator).map { File(it, exe) }.firstOrNull { it.isFile } ?: error("no node on PATH")
    }

    private fun compiledEntry(): File {
        val root = File(System.getProperty("aeon.repoRoot") ?: error("aeon.repoRoot not set"))
        return File(root, "dist-mobile/node/mobile-main.js").also { check(it.isFile) { "run `npm run build:mobile` first: ${it.path} is missing" } }
    }

    private fun portOpen(port: Int): Boolean = try {
        Socket().use { it.connect(InetSocketAddress("127.0.0.1", port), 300); true }
    } catch (e: Exception) {
        false
    }

    @Test
    fun theInstallersAgentFolderIsFoundNextToTheAppOrWherePointedTo() {
        val dir = tmp()
        val exe = if (System.getProperty("os.name").startsWith("Windows")) "node.exe" else "node"
        File(dir, "agent/runtime").mkdirs(); File(dir, "agent/project/node").mkdirs()
        // nothing set: no agent
        assertNull(findAgentFiles(env = { null }, property = { null }))
        // a folder with only half of it is no agent either
        File(dir, "agent/runtime/$exe").writeText("x")
        assertNull(findAgentFiles(env = { null }, property = { if (it == "compose.application.resources.dir") dir.path else null }))
        File(dir, "agent/project/node/mobile-main.js").writeText("x")
        val next = findAgentFiles(env = { null }, property = { if (it == "compose.application.resources.dir") dir.path else null })
        assertNotNull(next, "found beside the app")
        assertEquals(File(dir, "agent/project/node/mobile-main.js"), next.entry)
        val pointed = findAgentFiles(env = { if (it == "AEON_AGENT_DIR") File(dir, "agent").path else null }, property = { null })
        assertNotNull(pointed, "found where AEON_AGENT_DIR points")
    }

    @Test
    fun theAgentKeepsItsDataInItsOwnFolderAndWorksInDocumentsAeon() {
        val (cfg, ws) = defaultAgentFolders(env = { if (it == "APPDATA") "C:/Users/x/AppData/Roaming" else null }, home = "C:/Users/x")
        assertTrue(cfg.path.replace('\\', '/').endsWith("/Aeon/agent") || cfg.path.replace('\\', '/').endsWith("/aeon/agent"), cfg.path)
        assertEquals(File("C:/Users/x/Documents/Aeon"), ws)
    }

    @Test
    fun withoutTheAgentItSaysSoInsteadOfFailingSilently() = runBlocking {
        val host = DesktopLocalAgent(null, tmp(), tmp())
        assertFalse(host.available)
        assertTrue(host.start()!!.contains("들어 있지 않아요"))
    }

    @Test
    fun startsTheRealAgentPairsAndStopsIt() = runBlocking {
        val dir = tmp()
        val port = freePort()
        val steps = mutableListOf<Int>()
        val host = DesktopLocalAgent(AgentFiles(node(), compiledEntry()), File(dir, "cfg"), File(dir, "ws"), port)
        host.onProgress = { stage, _ -> steps += stage }
        cleanup += { host.stop() }
        assertTrue(host.available)
        assertNull(host.start(), "the agent answers")
        assertTrue(portOpen(port))
        assertTrue(steps.containsAll(listOf(0, 1, 2)), "the three stages were reported: $steps")
        assertNull(host.start(), "starting again finds it running and starts no second one")
        val code = host.pairingCode()
        assertNotNull(code, "a pairing code came back")
        assertEquals(16, code.length)
        assertTrue(File(dir, "ws").isDirectory, "its work folder was made")
        assertEquals(File(dir, "ws").absolutePath, host.workFolder, "the app can tell the person where it is")
        host.stop()
        // the port is closed once the process is gone
        repeat(50) { if (portOpen(port)) Thread.sleep(100) }
        assertFalse(portOpen(port), "the agent stopped with stop()")
        assertFalse(File(dir, "cfg/pairing-code.txt").exists(), "the one-time code is not left lying in the folder")
    }

    @Test
    fun anAgentThatStopsAtOnceIsReportedAtOnceWithItsLog() = runBlocking {
        val dir = tmp()
        val broken = File(dir, "broken.js").apply { writeText("console.error('boom: the agent could not load'); process.exit(3);") }
        val host = DesktopLocalAgent(AgentFiles(node(), broken), File(dir, "cfg"), File(dir, "ws"), freePort(), startupMs = 20_000)
        val lines = mutableListOf<String>()
        host.onProgress = { _, line -> lines += line }
        val began = System.currentTimeMillis()
        val message = host.start()
        assertNotNull(message)
        assertTrue(message.contains("멈췄어요"), message)
        assertTrue(System.currentTimeMillis() - began < 15_000, "it did not wait for the whole time")
        assertTrue(lines.any { it.contains("boom") }, "the log lines reached the screen: $lines")
    }

    @Test
    fun anAgentStartedSomeOtherWayIsNamedInsteadOfAFileErrorOnTheScreen() = runBlocking {
        // e.g. a developer's `aeon serve` in a terminal: it answers, but it never reads this app's pairing file
        val foreign = com.sun.net.httpserver.HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        foreign.createContext("/v1/hello") { ex ->
            val body = """{"name":"Aeon","api":1,"pairingRequired":true}""".toByteArray()
            ex.sendResponseHeaders(200, body.size.toLong()); ex.responseBody.use { it.write(body) }
        }
        foreign.start()
        cleanup += { foreign.stop(0) }
        val dir = tmp()
        val host = DesktopLocalAgent(AgentFiles(node(), compiledEntry()), File(dir, "cfg-that-does-not-exist-yet"), File(dir, "ws"), foreign.address.port)
        val message = host.start()
        assertNotNull(message, "it does not pretend to have started its own agent")
        assertTrue(message.contains("이미 켜져 있어요"), message)
        assertFalse(message.contains("pairing-code"), "no file path on the screen")
        // and asking for a code when the folder is missing gives no code and no exception
        assertNull(host.pairingCode())
    }

    @Test
    fun anotherProgramOnThePortIsNamedAsTheReason() = runBlocking {
        val dir = tmp()
        val busy = ServerSocket(0, 0, java.net.InetAddress.getLoopbackAddress())
        cleanup += { busy.close() }
        val host = DesktopLocalAgent(AgentFiles(node(), compiledEntry()), File(dir, "cfg"), File(dir, "ws"), busy.localPort, startupMs = 20_000)
        cleanup += { host.stop() }
        val message = host.start()
        assertNotNull(message, "it could not start")
        assertTrue(message.contains("다른 프로그램"), message)
    }
}

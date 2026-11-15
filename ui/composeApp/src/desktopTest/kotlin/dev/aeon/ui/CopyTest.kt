package dev.aeon.ui

import dev.aeon.ui.api.Approval
import dev.aeon.ui.design.quotaWaitWord
import dev.aeon.ui.design.taskRefused
import dev.aeon.ui.design.thousands
import dev.aeon.ui.screens.Fix
import dev.aeon.ui.screens.GOAL_LIMIT
import dev.aeon.ui.screens.SUGGESTIONS
import dev.aeon.ui.screens.friendlyError
import dev.aeon.ui.screens.goalTooLong
import dev.aeon.ui.screens.friendlyProblem
import dev.aeon.ui.screens.findingWords
import dev.aeon.ui.screens.recentLabel
import dev.aeon.ui.screens.friendlySetupProblem
import dev.aeon.ui.screens.conversationListWidth
import androidx.compose.ui.unit.dp
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** The words an ordinary user reads when something stops: Korean, plain, and no raw English from the engine. */
class CopyTest {
    @Test
    fun aSnappedDesktopKeepsSpaceForTheConversation() {
        assertTrue(conversationListWidth(820.dp) <= 280.dp)
        assertEquals(380.dp, conversationListWidth(1180.dp))
    }
    @Test
    fun taskErrorsAreShownInPlainKorean() {
        assertEquals("에이전트가 끝냈다고 했지만, 결과를 확인해 보니 맞지 않았어요.", friendlyError("The agent reported success but verification failed."))
        assertEquals("같은 동작을 계속 되풀이해서 멈췄어요.", friendlyError("the agent kept repeating fs.read with the same result"))
        assertEquals("정해 둔 단계 수를 다 써서 멈췄어요.", friendlyError("step budget exhausted (10 steps)"))
        assertEquals("작업 계획을 세우지 못했어요. 다시 시도해 보세요.", friendlyError("model did not produce a valid plan"))
        assertEquals("모델에 연결하지 못했어요.", friendlyError("모델에 연결하지 못했어요."), "a Korean message is kept as it is")
        val unknown = friendlyError("EACCES: permission denied, open 'x'")
        assertTrue(unknown.startsWith("문제가 생겨서 멈췄어요."), unknown)
        assertTrue(unknown.endsWith("EACCES: permission denied, open 'x'"), "an unknown error is not hidden: the plain sentence comes first, the original follows")
    }

    @Test
    fun problemsWithTheAiServiceSayWhatToDoAndHideWhatTheServiceSaid() {
        val auth = friendlyProblem("exaone: auth: HTTP 401: {\"error\":{\"message\":\"invalid api key format\",\"code\":\"invalid_api_key\"}}")
        assertTrue(auth.fixInSettings, "a wrong key has a fix")
        assertEquals(Fix.Key, auth.fix, "a wrong key is changed on the page of the access keys, where a stored key can be replaced")
        assertEquals(Fix.Ai, friendlyProblem("exaone: bad_request: HTTP 422: x").fix)
        assertTrue("키" in auth.text && "401" !in auth.text && "{" !in auth.text, auth.text)
        assertTrue(friendlyProblem("router: consent_required: no model provider is permitted: exaone").fixInSettings)
        assertTrue(friendlyProblem("exaone: bad_request: HTTP 422: x").fixInSettings)
        for (kind in listOf("network: network error: fetch failed", "timeout: request timed out", "server: HTTP 503: <html>", "invalid_response: response was not valid JSON", "rate_limited: HTTP 429", "unavailable: x")) {
            val p = friendlyProblem("exaone-proxy: $kind")
            assertFalse(p.fixInSettings, kind)
            assertTrue(p.text.any { it in '가'..'힣' } && "HTTP" !in p.text && "<html>" !in p.text && "JSON" !in p.text, "$kind -> ${p.text}")
        }
        assertEquals("인터넷에 연결되지 않아 AI 서비스에 닿지 못했어요. 연결을 확인하고 다시 해 보세요.", friendlyError("exaone: network: network error: fetch failed"))
        assertTrue(friendlyError("exaone: weird: x").startsWith("문제가 생겨서 멈췄어요."), "an unknown kind is not mistaken for a known one")
    }

    @Test
    fun aMissingAiIsExplainedWithoutEnvironmentVariablesOrCommands() {
        for (raw in listOf("Provider 'exaone' needs EXAONE_API_KEY in the environment.", "Provider 'Upstage' needs AEON_EP_UPSTAGE_KEY.")) {
            val t = friendlySetupProblem(raw)
            assertTrue("키" in t && "_KEY" !in t && "environment" !in t, t)
        }
        assertTrue("허락" in friendlySetupProblem("no model provider is permitted: consent is missing"))
        assertTrue(friendlySetupProblem("Unknown provider: x").any { it in '가'..'힣' })
    }

    @Test
    fun aMessageTooLongForTheServerIsStoppedBeforeSending() {
        assertEquals(4000, GOAL_LIMIT, "the same limit as the server's goal")
        assertFalse(goalTooLong("가".repeat(4000)))
        assertTrue(goalTooLong("가".repeat(4001)))
        assertFalse(goalTooLong("  " + "가".repeat(4000) + "  "), "spaces around it do not count, the server trims them too")
    }

    @Test
    fun theWaitForTheAiServiceNamesItsReason() {
        assertEquals("AI가 붐벼요", quotaWaitWord("busy: the model service is busy; trying again soon"))
        assertEquals("AI가 붐벼요", quotaWaitWord(null), "an older server's note still reads as a short wait")
        assertEquals("오늘 사용량 가득", quotaWaitWord("limit: the model's allowance is used up for now"))
    }

    @Test
    fun theListOfRecentDecisionsNamesWhatItWasNotTheServersEnglish() {
        fun ap(tool: String, risk: String, summary: String, vararg res: String) = Approval(id = "a", taskId = "t", tool = tool, summary = summary, risk = risk, resources = res.toList(), status = "approved")
        assertEquals("삭제 · to-delete.txt", recentLabel(ap("fs.delete", "delete", "DELETE file C:/Users/x/ws/to-delete.txt", "C:/Users/x/ws/to-delete.txt")))
        assertEquals("쓰기 · a.txt 외 1개", recentLabel(ap("fs.write", "write", "WRITE 2 files", "/w/a.txt", "/w/b.txt")))
        assertEquals("스킬 만들기", recentLabel(ap("skill.create", "write", "Create skill \"x\": …")))
        assertEquals("기억하기", recentLabel(ap("memory.save", "write", "Remember: …")))
        assertEquals("어느 파일을 정리할까요?", recentLabel(Approval(id = "q", taskId = "t", tool = "ask", summary = "어느 파일을 정리할까요?", risk = "read", kind = "question", status = "approved")))
    }

    @Test
    fun whatTheSkillScanFoundIsReadInKorean() {
        assertEquals("인터넷에서 프로그램을 내려받아 바로 실행해요", findingWords("downloads a program and runs it"))
        assertEquals("파일을 지워요 (격리된 상자 안에서는 임시 폴더만 지울 수 있어요)", findingWords("deletes files (only the scratch folder is writable in Docker)"))
        assertEquals("a sentence the app does not know", findingWords("a sentence the app does not know"), "an unknown sentence is shown as sent")
        assertFalse(findingWords("uses the network (blocked in the Docker sandbox)").contains("Docker"), "no developer word in the Korean text")
    }

    @Test
    fun aLongNumberIsReadInGroupsOfThree() {
        assertEquals("0", thousands(0))
        assertEquals("999", thousands(999))
        assertEquals("1,000", thousands(1000))
        assertEquals("233,040", thousands(233040))
        assertEquals("1,234,567", thousands(1234567))
    }

    @Test
    fun aTaskWhoseLastActionWasRefusedIsNotShownAsPlainDone() {
        assertTrue(taskRefused("COMPLETED", "refused: the last action was not carried out"))
        assertFalse(taskRefused("COMPLETED", null), "a finished task with no note is done")
        assertFalse(taskRefused("COMPLETED", "retry 1/3"), "another note does not make it refused")
        assertFalse(taskRefused("FAILED", "refused: the last action was not carried out"), "only a finished task is shown as not done")
        assertFalse(taskRefused("RUNNING", "refused: x"))
    }

    @Test
    fun theSuggestedFirstTasksMakeSenseInTheWorkFolderWithNothingPrepared() {
        // The agent works only inside its work folder. "다운로드 폴더에서 …" as the first suggestion ended, in a real run of the
        // desktop app, in the agent asking where that folder is.
        assertEquals(3, SUGGESTIONS.size)
        assertTrue(SUGGESTIONS.all { it.contains("작업 폴더") }, SUGGESTIONS.toString())
        assertFalse(SUGGESTIONS.any { it.contains("다운로드") || it.contains("회의록 폴더") }, "no folder the agent cannot see")
    }
}

package com.margelo.nitro.audioanalyzer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.URL

class RedirectPolicyTest {
  private val headers = mapOf("Authorization" to "Bearer secret")
  private val original = URL("https://api.example.com/audio/1")

  private fun policy() = RedirectPolicy(original, headers)

  @Test
  fun keepsHeadersOnTheSameOrigin() {
    val policy = policy()
    assertEquals(headers, policy.headersFor(original))
    assertEquals(headers, policy.headersFor(URL("https://api.example.com/cdn/1.mp3")))
    assertEquals(headers, policy.headersFor(URL("https://API.example.com:443/x")))
  }

  @Test
  fun dropsHeadersForAnotherHost() {
    val policy = policy()
    policy.headersFor(original)
    assertTrue(policy.headersFor(URL("https://cdn.other.com/1.mp3")).isEmpty())
  }

  @Test
  fun dropsHeadersWhenDowngradingToHttp() {
    assertTrue(policy().headersFor(URL("http://api.example.com/audio/1")).isEmpty())
  }

  @Test
  fun dropsHeadersForAnotherPort() {
    assertTrue(policy().headersFor(URL("https://api.example.com:8443/audio/1")).isEmpty())
  }

  @Test
  fun keepsThemDroppedWhenARedirectComesBackToTheOrigin() {
    val policy = policy()
    policy.headersFor(original)
    policy.headersFor(URL("https://cdn.other.com/bounce"))
    assertTrue(policy.headersFor(URL("https://api.example.com/any/path")).isEmpty())
  }
}

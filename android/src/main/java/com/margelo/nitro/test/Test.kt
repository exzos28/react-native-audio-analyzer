package com.margelo.nitro.test
  
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class Test : HybridTestSpec() {
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }
}

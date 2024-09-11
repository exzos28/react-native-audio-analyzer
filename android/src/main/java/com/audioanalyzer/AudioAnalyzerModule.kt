package com.audioanalyzer

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.turbomodule.core.interfaces.CallInvokerHolder

class AudioAnalyzerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = NAME
    companion object {
        const val NAME = "AudioAnalyzer"
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun install(): Boolean {
        return try {
            System.loadLibrary("simple")

            this.reactApplicationContext.javaScriptContextHolder?.let { contextHolder ->
                this.reactApplicationContext.catalystInstance.jsCallInvokerHolder?.let { callInvokerHolder: CallInvokerHolder ->
                    this.nativeInstall(contextHolder.get(), callInvokerHolder)

                    Log.i(NAME, "Installed TestApp \uD83E\uDD84!")

                    return true
                }
            }

            false
        } catch (e: Exception) {
            return false
        }
    }

    private external fun nativeInstall(jsi: Long, callInvoker: CallInvokerHolder)
}

package com.goldkhatabook.app.classicbluetooth

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Registers ClassicBluetoothModule. This package is app-local rather than a published
 * npm module, so it cannot be autolinked — MainApplication adds it explicitly.
 */
class ClassicBluetoothPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == ClassicBluetoothModule.NAME) ClassicBluetoothModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        ClassicBluetoothModule.NAME to
            ReactModuleInfo(
                ClassicBluetoothModule.NAME,
                ClassicBluetoothModule.NAME,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                true, // isTurboModule
                ))
  }
}

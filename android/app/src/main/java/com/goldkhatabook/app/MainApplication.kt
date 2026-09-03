package com.goldkhatabook.app
import android.content.res.Configuration
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

import android.app.Application
import cl.json.ShareApplication
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.goldkhatabook.app.classicbluetooth.ClassicBluetoothPackage

class MainApplication : Application(), ReactApplication, ShareApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // App-local TurboModule (not an npm package, so not autolinked): Bluetooth
          // Classic/SPP printing for cheap thermal printers that do not speak BLE.
          add(ClassicBluetoothPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  // Tell react-native-share to use this app's own FileProvider (declared in
  // AndroidManifest.xml, authority "${applicationId}.provider") instead of
  // its bundled "<package>.rnshare.fileprovider", whose bundled paths file
  // has no external-files-path entry and can't resolve files under
  // getExternalFilesDir().
  override fun getFileProviderAuthority(): String = "$packageName.provider"

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}

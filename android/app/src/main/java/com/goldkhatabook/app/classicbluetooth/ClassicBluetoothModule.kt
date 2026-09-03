package com.goldkhatabook.app.classicbluetooth

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.util.Base64
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.goldkhatabook.app.specs.NativeClassicBluetoothSpec
import java.io.IOException
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import org.json.JSONArray
import org.json.JSONObject

/**
 * Bluetooth Classic (RFCOMM/SPP) printing.
 *
 * Cheap thermal printers overwhelmingly speak Bluetooth Classic rather than BLE, and
 * the two protocols cannot interoperate.
 *
 * The socket is kept open briefly between prints rather than torn down each time:
 * RFCOMM setup measured 0.8-3.0s and was 71% of a 2s print, and a shop printing several
 * bills in a row should pay it once. It is released after IDLE_CLOSE_MS because a held
 * socket makes the printer unavailable to any other phone in the shop.
 */
class ClassicBluetoothModule(reactContext: ReactApplicationContext) :
    NativeClassicBluetoothSpec(reactContext) {

  companion object {
    const val NAME = "ClassicBluetooth"

    /** The well-known Serial Port Profile UUID. Every SPP printer advertises this. */
    private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    /**
     * Writing in chunks with a short pause keeps small printer buffers from
     * overflowing, which shows up as truncated or garbled receipts rather than an
     * error.
     *
     * The original 256B/20ms was over-cautious: a 19KB rasterised receipt meant ~76
     * pauses, roughly 1.5s of pure sleeping, on a print that took 4.1s in total.
     * RFCOMM is already flow-controlled, so the pause is a safety margin for cheap
     * firmware rather than a protocol requirement — 512B/5ms keeps a margin while
     * cutting the sleep cost by about 8x.
     */
    private const val CHUNK_SIZE = 512
    private const val CHUNK_PAUSE_MS = 5L

    /** Below this luminance a pixel burns black. Receipts are black-on-white, so a
     * mid-point threshold avoids dithering artefacts. Matches raster.ts's JS fallback
     * so Android and iOS produce the same output. */
    private const val LUMA_THRESHOLD = 160

    /** Arbitrary but must be unique within the host Activity and fit in 16 bits. */
    private const val REQUEST_ENABLE_BT = 0xB7

    /**
     * How long the printer connection is held after a print.
     *
     * Long enough that a shop printing several bills in a row pays RFCOMM setup
     * (0.8-3.0s, measured as 71% of a 2s print) only once; short enough that a printer
     * shared between two phones is not blocked for long, since a held socket makes it
     * unavailable to everyone else.
     */
    private const val IDLE_CLOSE_MS = 20_000L
  }

  // Socket I/O blocks; never run it on the bridge thread. Single-threaded, so prints
  // and the idle close are serialised and cannot race over the cached socket.
  private val executor = Executors.newSingleThreadExecutor()

  /** Kept between prints so repeat prints skip RFCOMM setup entirely. */
  private var cachedSocket: BluetoothSocket? = null
  private var cachedAddress: String? = null
  private val idleCloser = Executors.newSingleThreadScheduledExecutor()
  private var idleClose: ScheduledFuture<*>? = null

  /** Set only while the system enable-Bluetooth dialog is on screen. */
  private var enablePromise: Promise? = null

  private val activityEventListener: ActivityEventListener =
      object : BaseActivityEventListener() {
        // `activity` is non-null in BaseActivityEventListener's signature; declaring it
        // nullable makes this override nothing and fails compilation.
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?
        ) {
          if (requestCode != REQUEST_ENABLE_BT) return
          val promise = enablePromise ?: return
          enablePromise = null
          promise.resolve(resultCode == Activity.RESULT_OK)
        }
      }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = NAME

  private fun adapter(): BluetoothAdapter? =
      (reactApplicationContext.getSystemService(android.content.Context.BLUETOOTH_SERVICE)
              as? android.bluetooth.BluetoothManager)
          ?.adapter

  /**
   * BLUETOOTH_CONNECT is only a runtime permission from API 31; below that the
   * install-time BLUETOOTH permission covers it. Checking unconditionally would make
   * older devices look unpermitted and fail for no reason.
   */
  private fun hasConnectPermission(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return ContextCompat.checkSelfPermission(
        reactApplicationContext, Manifest.permission.BLUETOOTH_CONNECT) ==
        PackageManager.PERMISSION_GRANTED
  }

  override fun isEnabled(promise: Promise) {
    val adapter = adapter()
    promise.resolve(adapter != null && adapter.isEnabled)
  }

  /**
   * Asks the OS to show its own enable-Bluetooth dialog. Deliberately does not try
   * adapter.enable(): that is deprecated and silently does nothing for apps targeting
   * Android 13+, which would look like the prompt simply never appeared.
   */
  override fun requestEnable(promise: Promise) {
    val adapter = adapter()
    if (adapter == null) {
      promise.resolve(false) // No Bluetooth hardware — nothing to turn on.
      return
    }
    if (adapter.isEnabled) {
      promise.resolve(true)
      return
    }
    // From API 31 the system dialog itself requires BLUETOOTH_CONNECT; without it the
    // startActivity throws SecurityException rather than prompting.
    if (!hasConnectPermission()) {
      promise.reject("permission", "Bluetooth permission not granted")
      return
    }
    val activity = currentActivity
    if (activity == null) {
      promise.reject("unknown", "No foreground activity to show the dialog")
      return
    }
    // A second call while the dialog is already up would strand the first promise.
    enablePromise?.let {
      enablePromise = null
      it.resolve(false)
    }
    enablePromise = promise
    try {
      activity.startActivityForResult(
          Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), REQUEST_ENABLE_BT)
    } catch (e: Exception) {
      enablePromise = null
      promise.reject("unknown", e.message, e)
    }
  }

  override fun getBondedDevices(promise: Promise) {
    if (!hasConnectPermission()) {
      promise.reject("permission", "Bluetooth permission not granted")
      return
    }
    val adapter = adapter()
    if (adapter == null || !adapter.isEnabled) {
      promise.reject("bluetooth-off", "Bluetooth is off")
      return
    }

    try {
      val devices = JSONArray()
      adapter.bondedDevices.forEach { device: BluetoothDevice ->
        devices.put(
            JSONObject().apply {
              put("id", device.address)
              put("name", device.name ?: device.address)
            })
      }
      // Serialised because the codegen spec keeps the bridge surface to plain strings.
      promise.resolve(devices.toString())
    } catch (e: SecurityException) {
      promise.reject("permission", "Bluetooth permission not granted", e)
    } catch (e: Exception) {
      promise.reject("unknown", e.message, e)
    }
  }

  override fun write(address: String, base64Data: String, promise: Promise) {
    if (!hasConnectPermission()) {
      promise.reject("permission", "Bluetooth permission not granted")
      return
    }
    val adapter = adapter()
    if (adapter == null || !adapter.isEnabled) {
      promise.reject("bluetooth-off", "Bluetooth is off")
      return
    }

    executor.execute {
      try {
        val bytes = Base64.decode(base64Data, Base64.DEFAULT)
        cancelIdleClose()

        var reused = cachedSocket?.isConnected == true && cachedAddress == address
        val connectStart = System.currentTimeMillis()
        var socket = if (reused) cachedSocket!! else openSocket(adapter, address)
        var connectMs = System.currentTimeMillis() - connectStart

        val writeStart = System.currentTimeMillis()
        try {
          sendBytes(socket, bytes)
        } catch (e: IOException) {
          // A cached socket can report isConnected while the printer has actually gone
          // (switched off, out of range, or it dropped us). Retry once on a fresh
          // connection rather than failing a print that would have succeeded.
          if (!reused) throw e
          closeCached()
          reused = false
          val retryStart = System.currentTimeMillis()
          socket = openSocket(adapter, address)
          connectMs = System.currentTimeMillis() - retryStart
          sendBytes(socket, bytes)
        }
        val writeMs = System.currentTimeMillis() - writeStart

        // Held open so the next print skips RFCOMM setup, which measured 0.8-3.0s and
        // was 71% of a 2s print. Released after a short idle so a shop sharing one
        // printer between phones is not blocked for long.
        cachedSocket = socket
        cachedAddress = address
        scheduleIdleClose()

        promise.resolve(
            JSONObject()
                .apply {
                  put("connectMs", connectMs)
                  put("writeMs", writeMs)
                  put("bytes", bytes.size)
                  put("reused", reused)
                }
                .toString())
      } catch (e: SecurityException) {
        closeCached()
        promise.reject("permission", "Bluetooth permission not granted", e)
      } catch (e: IOException) {
        closeCached()
        promise.reject("unreachable", e.message ?: "Could not reach the printer", e)
      } catch (e: Exception) {
        closeCached()
        promise.reject("unknown", e.message, e)
      }
    }
  }

  /**
   * Warms the connection so a following write skips RFCOMM setup entirely.
   *
   * Deliberately silent: this runs speculatively when a bill screen opens, and a
   * printer that is off or out of range at that moment is not an error — the user may
   * not even intend to print.
   */
  override fun connect(address: String, promise: Promise) {
    if (!hasConnectPermission()) {
      promise.resolve(null)
      return
    }
    val adapter = adapter()
    if (adapter == null || !adapter.isEnabled) {
      promise.resolve(null)
      return
    }

    executor.execute {
      try {
        cancelIdleClose()
        if (cachedSocket?.isConnected != true || cachedAddress != address) {
          cachedSocket = openSocket(adapter, address)
          cachedAddress = address
        }
        scheduleIdleClose()
      } catch (_: Exception) {
        closeCached()
      }
      promise.resolve(null)
    }
  }

  private fun openSocket(adapter: BluetoothAdapter, address: String): BluetoothSocket {
    closeCached()
    // Cancel discovery first: an in-progress scan starves the connection attempt and is
    // the usual cause of an otherwise inexplicable connect timeout.
    try {
      adapter.cancelDiscovery()
    } catch (_: SecurityException) {
      // Not fatal — connecting may still succeed.
    }
    val socket = adapter.getRemoteDevice(address).createRfcommSocketToServiceRecord(SPP_UUID)
    socket.connect()
    return socket
  }

  private fun sendBytes(socket: BluetoothSocket, bytes: ByteArray) {
    val out = socket.outputStream
    var offset = 0
    while (offset < bytes.size) {
      val end = minOf(offset + CHUNK_SIZE, bytes.size)
      out.write(bytes, offset, end - offset)
      out.flush()
      offset = end
      if (offset < bytes.size) Thread.sleep(CHUNK_PAUSE_MS)
    }
    // Let the printer drain its buffer before anything else happens on the socket,
    // otherwise the tail of the receipt can be lost.
    Thread.sleep(120)
  }

  private fun closeCached() {
    try {
      cachedSocket?.close()
    } catch (_: IOException) {
      // Best effort.
    }
    cachedSocket = null
    cachedAddress = null
  }

  private fun cancelIdleClose() {
    idleClose?.cancel(false)
    idleClose = null
  }

  private fun scheduleIdleClose() {
    cancelIdleClose()
    idleClose =
        idleCloser.schedule(
            { executor.execute { closeCached() } }, IDLE_CLOSE_MS, TimeUnit.MILLISECONDS)
  }

  /**
   * Decodes any BitmapFactory-supported image to 1-bit rows for ESC/POS.
   *
   * Exists because a shop logo could not be printed at all otherwise: rendering it in
   * an off-screen React view fires onLoad but never paints, since Android's image
   * backend detaches drawables for views it treats as invisible — so the captured
   * bitmap contained blank paper where the logo should be. Decoding here skips view
   * rendering entirely, and also handles JPEG/WebP/GIF, which a JS PNG decoder cannot.
   */
  override fun decodeImageToBilevel(
      base64Image: String,
      maxWidth: Double,
      maxHeight: Double,
      promise: Promise
  ) {
    executor.execute {
      try {
        // Tolerates a full data URI as well as bare base64.
        val payload = base64Image.substringAfter("base64,", base64Image)
        val raw = Base64.decode(payload, Base64.DEFAULT)
        val source =
            BitmapFactory.decodeByteArray(raw, 0, raw.size)
                ?: throw IllegalArgumentException("Unsupported or corrupt image")

        val maxW = maxWidth.toInt().coerceAtLeast(8)
        val maxH = maxHeight.toInt().coerceAtLeast(8)
        val scale = minOf(maxW.toFloat() / source.width, maxH.toFloat() / source.height, 1f)
        // Width is rounded down to a byte boundary: GS v 0 addresses whole bytes.
        val targetW = ((source.width * scale).toInt() / 8 * 8).coerceAtLeast(8)
        val targetH = (source.height * scale).toInt().coerceAtLeast(1)
        val bitmap = Bitmap.createScaledBitmap(source, targetW, targetH, true)

        val bytesPerRow = targetW / 8
        val packed = ByteArray(bytesPerRow * targetH)
        val pixels = IntArray(targetW * targetH)
        bitmap.getPixels(pixels, 0, targetW, 0, 0, targetW, targetH)

        for (y in 0 until targetH) {
          for (x in 0 until targetW) {
            val p = pixels[y * targetW + x]
            val a = (p ushr 24) and 0xFF
            // Transparent pixels are paper, not ink.
            if (a < 128) continue
            val r = (p ushr 16) and 0xFF
            val g = (p ushr 8) and 0xFF
            val b = p and 0xFF
            val luma = (0.299 * r + 0.587 * g + 0.114 * b)
            if (luma < LUMA_THRESHOLD) {
              val i = y * bytesPerRow + (x / 8)
              packed[i] = (packed[i].toInt() or (0x80 shr (x % 8))).toByte()
            }
          }
        }

        if (bitmap != source) bitmap.recycle()
        source.recycle()

        promise.resolve(
            JSONObject()
                .apply {
                  put("width", targetW)
                  put("height", targetH)
                  put("data", Base64.encodeToString(packed, Base64.NO_WRAP))
                }
                .toString())
      } catch (e: Exception) {
        promise.reject("decode", e.message ?: "Could not decode image", e)
      }
    }
  }

  override fun invalidate() {
    // Release the printer before the executor dies, or a held socket would keep it
    // claimed until the OS tears the process down.
    cancelIdleClose()
    idleCloser.shutdownNow()
    closeCached()
    executor.shutdownNow()
    reactApplicationContext.removeActivityEventListener(activityEventListener)
    // A promise left unsettled here would hang the setup screen's scan forever.
    enablePromise?.let {
      enablePromise = null
      it.resolve(false)
    }
    super.invalidate()
  }
}

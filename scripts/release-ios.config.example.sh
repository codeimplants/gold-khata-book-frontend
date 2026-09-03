# iOS release configuration.
#
# SETUP: copy to scripts/release-ios.config.sh and fill in.
#   cp scripts/release-ios.config.example.sh scripts/release-ios.config.sh
#
# release-ios.config.sh is gitignored. It holds identifiers, not secrets —
# the private key itself lives outside the repo (see APP_STORE_KEY_ID below).

# --- App Store Connect API key -----------------------------------------------
# Required for CLI upload. Without it the only route is Xcode Organizer by hand,
# which is what this script exists to replace.
#
# Create at: App Store Connect > Users and Access > Integrations >
#            App Store Connect API > Team Keys > "+"
#   Role: "App Manager" (Developer is not sufficient to upload builds)
#
# The .p8 downloads ONCE and cannot be re-downloaded. Save it as:
#   ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
# and chmod 600. altool/notarytool look there automatically.
#
# Both values are shown on that same page after creating the key.
APP_STORE_KEY_ID=""        # e.g. "ABCD123456" — the key's Key ID
APP_STORE_ISSUER_ID=""     # UUID at the top of the API keys page

# --- CocoaPods Ruby -----------------------------------------------------------
# CocoaPods needs a Ruby new enough to parse the Podfile. Since expo-contacts
# was added, `use_expo_modules!` pulls in Expo's CocoaPods plugin, which calls
# Array#filter_map — added in Ruby 2.7. macOS system Ruby is 2.6.10, so it now
# fails while merely parsing the Podfile, before resolving a single pod.
#
# This is prepended to PATH for the pod install step only, and the script runs
# a bare `pod` rather than `bundle exec`: the bundled gems are still stranded
# under system Ruby in vendor/bundle/ruby/2.6.0, and Gemfile.lock pins BUNDLED
# WITH 1.17.2, which cannot run on Ruby 3.2+ at all.
#
# Pinned rather than autodetected so a toolchain change fails loudly here
# instead of silently switching Ruby mid-release.
POD_RUBY_BIN="/opt/homebrew/bin"

# --- Project ------------------------------------------------------------------
SCHEME="GoldKhataBook"
WORKSPACE="ios/GoldKhataBook.xcworkspace"
XCODE_PROJECT="ios/GoldKhataBook.xcodeproj"
EXPORT_OPTIONS="ios/ExportOptions.plist"

# Where archives and exports are written (gitignored).
BUILD_DIR="ios/build"

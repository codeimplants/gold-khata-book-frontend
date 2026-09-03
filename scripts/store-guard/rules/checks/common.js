'use strict';

// Checks that read the app's own source rather than native config, and so apply
// to both stores.
//
// These are pattern matches over source, which means they can be wrong in both
// directions. Where a false positive is likely the rule's severity is `warn`, so
// a human decides. Where the pattern is unambiguous — a hardcoded key, a
// localhost URL — it fails the build.

function placeholderContent(ctx, rule, report) {
  const { files, scan, root } = ctx;
  const found = scan.grep(files, /coming soon|lorem ipsum|placeholder text|TODO:.*(screen|button)|FIXME/i, { root });
  if (!found.total) return report.pass(rule, 'no placeholder content found');
  report.violation(
    rule,
    `${found.total} placeholder string(s) — a reviewer reaching these reads the app as unfinished`,
    scan.formatHits(found)
  );
}

function otherPlatformMentions(ctx, rule, report) {
  const { files, scan, root } = ctx;
  // Only user-facing text matters. `android` appears constantly in RN code as a
  // platform key, so match it as a word in a quoted sentence-like string.
  const found = scan.grep(files, /["'`][^"'`]*\b(available on Android|Google Play|Play Store|on Android devices)\b[^"'`]*["'`]/i, { root });
  if (!found.total) return report.pass(rule, 'no references to other platforms in user-facing strings');
  report.violation(rule, `${found.total} reference(s) to another platform in app strings`, scan.formatHits(found));
}

function externalPayment(ctx, rule, report) {
  const { files, scan, root } = ctx;
  const found = scan.grep(files, /(razorpay|stripe\.com|checkout\.stripe|paytm|phonepe|upi:\/\/|payu|instamojo|cashfree)/i, { root });
  if (!found.total) return report.pass(rule, 'no external payment provider found in source');
  report.violation(
    rule,
    `external payment provider referenced while profile.sellsDigitalGoods is true`,
    `${scan.formatHits(found)}\nDigital content must be sold through In-App Purchase. External providers are only permitted for physical goods and services.`
  );
}

function webviewOnly(ctx, rule, report) {
  const { files, scan, root } = ctx;
  const webview = scan.grep(files, /react-native-webview|<WebView/, { root });
  if (!webview.total) return report.pass(rule, 'not a web-view wrapper');
  // A handful of web views inside a native app is normal. A tiny source tree
  // that is mostly web view is the 4.2 problem.
  if (files.length < 15 && webview.total > 2) {
    return report.violation(
      rule,
      `app is ${webview.total} web-view reference(s) across only ${files.length} source files`,
      scan.formatHits(webview)
    );
  }
  report.pass(rule, `web views present but the app has ${files.length} source files of native code`);
}

function privacyPolicyLink(ctx, rule, report) {
  const { files, scan, root } = ctx;
  const found = scan.grep(files, /privacy[-_ ]?policy|privacyPolicy/i, { root });
  if (!found.total) {
    return report.violation(rule, 'no privacy policy link found anywhere in source');
  }
  // The policy can be reachable two ways: an external URL, or a screen rendering
  // it natively. Both satisfy "reachable in-app" — only requiring a URL flagged
  // an app that ships a full PrivacyPolicyScreen.
  const url = scan.grep(files, /https?:\/\/[^\s"'`]*privacy/i, { root });
  if (url.total) {
    return report.pass(rule, `privacy policy URL present (${url.total} reference(s))`);
  }
  const screen = scan.grep(files, /PrivacyPolicyScreen|name=["']PrivacyPolicy["']/, { root });
  if (screen.total) {
    return report.pass(rule, 'privacy policy reachable via a dedicated in-app screen');
  }
  report.warn(
    rule,
    'privacy policy referenced but neither a URL nor a dedicated screen was found',
    scan.formatHits(found)
  );
}

function accountDeletion(ctx, rule, report) {
  const { files, scan, root } = ctx;
  const code = scan.grep(files, /deleteAccount|delete_account|deleteOwnAccount|removeAccount/i, { root });
  if (!code.total) {
    return report.violation(
      rule,
      'no account deletion code found, but the app supports account creation',
      'Both stores require the user to be able to start deletion from inside the app.'
    );
  }
  // Deletion code that nothing renders is the failure mode worth catching: the
  // endpoint exists, the button was never wired up, and the reviewer cannot
  // find it. SoneBill 1.0.10 shipped exactly this shape deliberately.
  //
  // The limit matters here. With the default of 8, a translations file with
  // dozens of deleteAccount* keys consumed every slot and the real settings
  // screen never appeared in the hits — the check reported "no screen exposes
  // it" for an app that plainly did. Filter over all matches, not a page of them.
  const ui = scan.grep(files, /delete.{0,20}account|account.{0,20}delete/i, { root, limit: 500 });
  const inScreens = ui.hits.filter((h) => /screen|page|settings|profile|component|\(tabs\)/i.test(h.file));
  if (!inScreens.length) {
    return report.warn(
      rule,
      'account deletion code exists but no screen appears to expose it',
      `${scan.formatHits(code)}\nIf the app creates accounts, the deletion path must be reachable in the UI.`
    );
  }
  report.pass(rule, `account deletion reachable from ${inScreens.length} screen reference(s)`);
}

function hardcodedSecrets(ctx, rule, report) {
  const { files, scan, root } = ctx;
  const patterns = [
    { re: /AIza[0-9A-Za-z_-]{35}/, what: 'Google API key' },
    { re: /sk_live_[0-9a-zA-Z]{20,}/, what: 'Stripe live secret key' },
    { re: /rzp_live_[0-9a-zA-Z]{10,}/, what: 'Razorpay live key' },
    { re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, what: 'private key' },
    { re: /(secret|password|passwd|apiKey|api_key)\s*[:=]\s*["'][^"'$\s]{12,}["']/i, what: 'hardcoded credential' },
  ];
  let any = false;
  for (const { re, what } of patterns) {
    const found = scan.grep(files, re, { root });
    if (found.total) {
      any = true;
      report.violation(rule, `${what} appears in source (${found.total} occurrence(s))`, scan.formatHits(found));
    }
  }
  if (!any) report.pass(rule, 'no hardcoded secrets matched');
}

function piiInAnalytics(ctx, rule, report) {
  const { files, scan, root } = ctx;
  // Must look like a CALL carrying the field, not merely a line mentioning both.
  // Matching a bare `analytics.` prefix flagged a JSX render of a variable that
  // happened to be named `analytics` — the call parenthesis is what makes this
  // a send rather than a read.
  const found = scan.grep(
    files,
    /\b(logEvent|logUserEvent|trackEvent|setUserPropert\w*)\s*\([^\n]{0,160}\b(phone|mobile|email|fullName|customerName|aadhaar|pan)\b/i,
    { root }
  );
  if (!found.total) return report.pass(rule, 'no personal fields found in analytics calls');
  report.violation(
    rule,
    `${found.total} analytics call(s) appear to carry personal data`,
    `${scan.formatHits(found)}\nIf this is intentional it must be declared on both stores' privacy forms.`
  );
}

function devEndpoints(ctx, rule, report) {
  const { files, scan, root } = ctx;
  const found = scan.grep(files, /https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+)/, { root });

  // `startsWith('http://')` is a scheme TEST, not a shipped endpoint. Requiring
  // at least one host character after the slashes separates the two — a real
  // endpoint always has a host, a scheme comparison never does.
  const http = scan.grep(
    files,
    /["'`]http:\/\/(?!localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.|schemas\.android|www\.w3\.org|xmlns)[a-z0-9][^"'`\s]*["'`]/i,
    { root }
  );

  if (found.total) {
    report.violation(rule, `${found.total} local/dev URL(s) in source`, scan.formatHits(found));
  }
  if (http.total) {
    report.violation(rule, `${http.total} plaintext http:// endpoint(s) in source`, scan.formatHits(http));
  }
  if (!found.total && !http.total) {
    report.pass(rule, 'no dev or plaintext endpoints in source');
  }
}

// The counterpart to hardcodedSecrets: that rule pushed the Nexus API key out
// of git and into a gitignored secrets.ts, which was right. What it could not
// see is that the template it left behind defaults to '', and an empty key is a
// perfectly valid build. 1.0.15 shipped that way — version checks 401'd and
// telemetry disabled itself for twelve days, with no fix short of a new
// release, because the app cannot be told anything once it cannot authenticate.
//
// Nexus can now identify an app by its package name, so version control
// survives a blank key, but engagement telemetry still does not. A release
// build with no key is never intentional, so fail rather than warn.
function versionControlKeyPresent(ctx, rule, report) {
  const fs = require('fs');
  const path = require('path');
  const rel = 'src/config/secrets.ts';
  const file = path.join(ctx.root, rel);

  if (!fs.existsSync(file)) {
    return report.violation(
      rule,
      `${rel} is missing`,
      `It is gitignored, so a fresh clone does not have it:\n` +
      `  cp src/config/secrets.example.ts ${rel}\n` +
      `then set VITE_VC_API_KEY to this app's Nexus key.`
    );
  }

  const src = fs.readFileSync(file, 'utf8');
  const match = src.match(/VITE_VC_API_KEY\s*=\s*['"`]([^'"`]*)['"`]/);

  if (!match) {
    return report.violation(
      rule,
      `VITE_VC_API_KEY not found in ${rel}`,
      `Expected a line like:\n  export const VITE_VC_API_KEY = '<key>';`
    );
  }
  if (!match[1].trim()) {
    return report.violation(
      rule,
      `VITE_VC_API_KEY is empty in ${rel}`,
      `An empty key compiles into the binary and cannot be corrected after release:\n` +
      `engagement telemetry switches itself off and every /sdk write is rejected.\n` +
      `Set the app's Nexus key (Applications → the app → API key in the Nexus console).`
    );
  }

  report.pass(rule, 'version-control API key is set for the release build');
}

module.exports = {
  placeholderContent,
  otherPlatformMentions,
  externalPayment,
  webviewOnly,
  privacyPolicyLink,
  accountDeletion,
  hardcodedSecrets,
  piiInAnalytics,
  devEndpoints,
  versionControlKeyPresent,
};

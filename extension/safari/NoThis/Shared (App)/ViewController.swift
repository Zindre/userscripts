//
//  ViewController.swift
//  Shared (App)
//
//  Created by Sindre Sørensen on 2026-10-25.
//

import WebKit

#if os(iOS)
import UIKit
import SafariServices
typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
import SafariServices
typealias PlatformViewController = NSViewController
#endif

let extensionBundleIdentifier = "no.sedb.NoThis.Extension"

class ViewController: PlatformViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self

#if os(iOS)
        self.webView.scrollView.isScrollEnabled = false
        // Coming back from Settings: show whether the extension is on now. Safari can report the change a moment
        // after the app is back, so it is also asked again every 1.5 s while the app is open.
        for name in [UIApplication.didBecomeActiveNotification, UIScene.didActivateNotification, UIApplication.willEnterForegroundNotification] {
            NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.showIOSState()
            }
        }
        Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            if UIApplication.shared.applicationState == .active { self.showIOSState() }
        }
#endif

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
#if os(iOS)
        pageLoaded = true
        showIOSState()
#elseif os(macOS)
        webView.evaluateJavaScript("show('mac')")

        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            guard let state = state, error == nil else {
                // Insert code to inform the user that something went wrong.
                return
            }

            DispatchQueue.main.async {
                if #available(macOS 13, *) {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), true)")
                } else {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), false)")
                }
            }
        }
#endif
    }

#if os(iOS)
    private var pageLoaded = false

    // iOS 26.2 can tell whether the extension is on and open its page in Settings; older iOS gets directions only.
    private func showIOSState() {
        guard pageLoaded else { return }
        showAccess()
        if #available(iOS 26.2, *) {
            SFSafariExtensionManager.getStateOfExtension(withIdentifier: extensionBundleIdentifier) { state, error in
                let enabled = error == nil ? state.map { String($0.isEnabled) } : nil
                DispatchQueue.main.async {
                    self.webView.evaluateJavaScript("show('ios', \(enabled ?? "undefined"), true)")
                }
            }
        } else {
            webView.evaluateJavaScript("show('ios')")
        }
    }

    // Whether the extension may run on all websites, as it last told us (SafariWebExtensionHandler): Safari reports it to
    // the extension only, and only when Safari has started the extension since the setting changed.
    private func showAccess() {
        let group = "group." + (Bundle.main.bundleIdentifier ?? "")
        guard let access = UserDefaults(suiteName: group)?.dictionary(forKey: "access"), let all = access["all"] as? Bool else { return }
        webView.evaluateJavaScript("showAccess(\(all))")
    }
#endif

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
#if os(iOS)
        if message.body as? String == "open-settings", #available(iOS 26.2, *) {
            SFSafariSettings.openExtensionsSettings(forIdentifiers: [extensionBundleIdentifier]) { error in
                if error != nil, let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
        }
#endif
#if os(macOS)
        if (message.body as! String != "open-preferences") {
            return
        }

        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            guard error == nil else {
                // Insert code to inform the user that something went wrong.
                return
            }

            DispatchQueue.main.async {
                NSApp.terminate(self)
            }
        }
#endif
    }

}

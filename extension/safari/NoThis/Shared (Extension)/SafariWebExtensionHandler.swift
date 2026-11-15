//
//  SafariWebExtensionHandler.swift
//  Shared (Extension)
//
//  Created by Sindre Sørensen on 2026-10-25.
//

import SafariServices
import os.log

// The app group the app and its extension share: "group." and the app's bundle ID (so a renamed copy, such as the
// development build, gets its own).
func sharedDefaults() -> UserDefaults? {
    let id = (Bundle.main.bundleIdentifier ?? "").replacingOccurrences(of: ".Extension", with: "")
    return UserDefaults(suiteName: "group." + id)
}

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

#if os(iOS)
        // background.js: whether the extension may run on all websites. Kept where the app can read it (the app's
        // first screen), since iOS has no way for the app to ask Safari that.
        if let m = message as? [String: Any], m["type"] as? String == "access", let all = m["all"] as? Bool {
            sharedDefaults()?.set(["all": all, "at": Date().timeIntervalSince1970], forKey: "access")
        }
#endif

        // background.js: Read later, Bookmarks, what has been read and the section layouts, kept in iCloud so they
        // follow the user to their other devices (one small JSON document; background.js merges it). Without the iCloud
        // entitlement (development builds) the store stays empty and nothing syncs.
        var reply: [String: Any] = [ "echo": message as Any ]
        if let m = message as? [String: Any], let type = m["type"] as? String {
            let store = NSUbiquitousKeyValueStore.default
            if type == "sync-get" {
                store.synchronize()
                if let data = store.string(forKey: "wd-sync") { reply["data"] = data }
            } else if type == "sync-put", let data = m["data"] as? String {
                store.set(data, forKey: "wd-sync")
                store.synchronize()
                reply["ok"] = true
            }
        }

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: reply ]
        } else {
            response.userInfo = [ "message": reply ]
        }

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }

}

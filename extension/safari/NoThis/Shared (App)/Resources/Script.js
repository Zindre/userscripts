// On the Mac the third argument means "Safari Settings" instead of "Preferences"; on iOS it means
// the app can open the extension's page in Settings.
function show(platform, enabled, useSettingsInsteadOfPreferences) {
    document.body.classList.add(`platform-${platform}`);
    document.body.classList.toggle('can-open', platform === 'ios' && !!useSettingsInsteadOfPreferences);

    if (platform === 'mac' && useSettingsInsteadOfPreferences) {
        document.getElementsByClassName('platform-mac state-on')[0].innerText = "Web Detox’s extension is currently on. You can turn it off in the Extensions section of Safari Settings.";
        document.getElementsByClassName('platform-mac state-off')[0].innerText = "Web Detox’s extension is currently off. You can turn it on in the Extensions section of Safari Settings.";
        document.getElementsByClassName('platform-mac state-unknown')[0].innerText = "You can turn on Web Detox’s extension in the Extensions section of Safari Settings.";
        document.getElementsByClassName('platform-mac open-preferences')[0].innerText = "Quit and Open Safari Settings…";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

// iOS: what the extension last reported about its access to all websites (true or false).
function showAccess(all) {
    document.body.classList.toggle('access-on', all === true);
    document.body.classList.toggle('access-off', all === false);
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);
document.querySelector("button.open-settings").addEventListener("click", () => {
    webkit.messageHandlers.controller.postMessage("open-settings");
});

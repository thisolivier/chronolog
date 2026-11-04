import XCTest

/// Drives the installed Chronolog shell (dev.thisolivier.chronolog) with real taps and typing, so
/// the iOS shell can be checked in the simulator even with the Mac's screen locked (sprint 048).
/// Inputs come through TEST_RUNNER_* environment variables (run.sh sets them); screenshots go to
/// SHOT_DIR on the host. The tests run in order and expect seed-dev-user.sh's data.
/// test5 needs a page with a link to https://example.com/ and one to /time at
/// <SHELL_URL>/ios-link-test.html (run.sh writes it to static/ for the run and removes it).
final class ShellTests: XCTestCase {
    let environment = ProcessInfo.processInfo.environment
    lazy var app: XCUIApplication = {
        let application = XCUIApplication(bundleIdentifier: "dev.thisolivier.chronolog")
        if let url = environment["SHELL_URL"] { application.launchEnvironment["CHRONOLOG_SHELL_URL"] = url }
        return application
    }()

    func shot(_ name: String) {
        guard let directory = environment["SHOT_DIR"] else { return }
        let data = XCUIScreen.main.screenshot().pngRepresentation
        try? data.write(to: URL(fileURLWithPath: directory).appendingPathComponent(name + ".png"))
    }

    func dumpTree(_ name: String) {
        guard let directory = environment["DUMP_DIR"] else { return }
        try? app.debugDescription.write(toFile: directory + "/" + name + ".txt", atomically: true, encoding: .utf8)
    }

    func field(_ placeholder: String) -> XCUIElement {
        let secure = app.webViews.secureTextFields[placeholder]
        return secure.waitForExistence(timeout: 2) ? secure : app.webViews.textFields[placeholder]
    }

    override func setUp() { continueAfterFailure = false }

    func test1_unlockAndSignIn() {
        app.launch()
        let keyField = field("Paste the key")
        XCTAssertTrue(keyField.waitForExistence(timeout: 60), "unlock page")
        shot("02-unlock-gate")
        keyField.tap()
        keyField.typeText(environment["DEVICE_KEY"] ?? "")
        app.webViews.buttons["Unlock"].tap()

        let emailField = field("you@example.com")
        XCTAssertTrue(emailField.waitForExistence(timeout: 60), "login page")
        emailField.tap()
        emailField.typeText(environment["USER_EMAIL"] ?? "")
        let passwordField = field("Your password")
        passwordField.tap()
        passwordField.typeText(environment["USER_PASSWORD"] ?? "")
        shot("03-sign-in")
        app.webViews.buttons["Sign in"].tap()
        XCTAssertTrue(app.webViews.buttons["Time Entries"].waitForExistence(timeout: 60), "signed in: workspace menu")
        sleep(2)
        shot("04-timesheet")
        dumpTree("timesheet")
    }

    func test2_timesheet() {
        app.activate()
        for _ in 0..<3 where !app.webViews.buttons["Time Entries"].exists {
            let back = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Back to'")).firstMatch
            if back.waitForExistence(timeout: 3) { back.tap(); sleep(1) }
        }
        let entries = app.webViews.buttons["Time Entries"].firstMatch
        if entries.waitForExistence(timeout: 10) { entries.tap() }
        sleep(4)
        dumpTree("timesheet")
        XCTAssertTrue(app.webViews.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS 'Kick-off workshop'")).firstMatch.waitForExistence(timeout: 30), "timesheet shows the seeded entry")
        shot("04-timesheet")
        dumpTree("timesheet")
    }

    func test3_openNote() {
        app.activate()
        let back = app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'back' OR label CONTAINS[c] 'menu'")).firstMatch
        if !app.webViews.buttons["Website rebuild Acme Studio 1"].exists && back.exists { back.tap() }
        let contract = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Website rebuild'")).firstMatch
        XCTAssertTrue(contract.waitForExistence(timeout: 20), "contract in sidebar")
        contract.tap()
        sleep(3)
        shot("05-note-list")
        dumpTree("notelist")
    }

    func test4_editNote() {
        app.activate()
        let note = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Kick-off notes'")).firstMatch
        XCTAssertTrue(note.waitForExistence(timeout: 20), "note in list")
        note.tap()
        let editor = app.webViews.textViews.firstMatch
        XCTAssertTrue(editor.waitForExistence(timeout: 20), "note editor")
        sleep(2)
        let lastLine = app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS 'wireframes by Friday'")).firstMatch
        if lastLine.exists { lastLine.coordinate(withNormalizedOffset: CGVector(dx: 0.99, dy: 0.5)).tap() } else { editor.tap() }
        app.typeText(" Typed in the iOS shell.")
        sleep(4)
        shot("06-note-edited")
        dumpTree("note")
    }

    func test5_externalLinkOpensSafari() {
        app.terminate()
        app.launchEnvironment["CHRONOLOG_SHELL_URL"] = "http://localhost:5248/ios-link-test.html"
        app.launch()
        let link = app.webViews.links["Open example.com"]
        XCTAssertTrue(link.waitForExistence(timeout: 30), "test page")
        link.tap()
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 20), "Safari came to the front")
        sleep(3)
        shot("09-external-link-in-safari")
        app.activate()
        XCTAssertTrue(app.webViews.links["Open example.com"].waitForExistence(timeout: 10), "shell stayed on its page")
        app.webViews.links["Stay in app: timesheet"].tap()
        XCTAssertTrue(app.webViews.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Week'")).firstMatch.waitForExistence(timeout: 30), "same-origin link stays in the shell")
        XCTAssertNotEqual(safari.state, .runningForeground)
    }
}

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SESSIONS_DIR = path.join(__dirname, "sessions");

if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function createSessionId() {
    return crypto.randomBytes(8).toString("base64url");
}

function saveSession(authDir) {
    const sessionId = createSessionId();
    const sessionFile = path.join(
        SESSIONS_DIR,
        `${sessionId}.json`
    );

    const files = [];

    function readDirectory(directory, relativePath = "") {
        const entries = fs.readdirSync(directory, {
            withFileTypes: true
        });

        for (const entry of entries) {
            const fullPath = path.join(
                directory,
                entry.name
            );

            const filePath = path.join(
                relativePath,
                entry.name
            );

            if (entry.isDirectory()) {
                readDirectory(
                    fullPath,
                    filePath
                );
            } else {
                files.push({
                    path: filePath.replace(/\\/g, "/"),
                    data: fs
                        .readFileSync(fullPath)
                        .toString("base64")
                });
            }
        }
    }

    readDirectory(authDir);

    fs.writeFileSync(
        sessionFile,
        JSON.stringify({
            version: 1,
            files
        }),
        {
            encoding: "utf8",
            mode: 0o600
        }
    );

    return sessionId;
}

function loadSession(sessionId, destination) {
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
        throw new Error("Invalid session ID");
    }

    const sessionFile = path.join(
        SESSIONS_DIR,
        `${sessionId}.json`
    );

    if (!fs.existsSync(sessionFile)) {
        throw new Error("Session not found");
    }

    const session = JSON.parse(
        fs.readFileSync(sessionFile, "utf8")
    );

    fs.mkdirSync(destination, {
        recursive: true
    });

    for (const file of session.files) {
        const output = path.resolve(
            destination,
            file.path
        );

        const root = path.resolve(
            destination
        );

        if (!output.startsWith(root + path.sep)) {
            throw new Error("Invalid session path");
        }

        fs.mkdirSync(
            path.dirname(output),
            {
                recursive: true
            }
        );

        fs.writeFileSync(
            output,
            Buffer.from(file.data, "base64"),
            {
                mode: 0o600
            }
        );
    }
}

module.exports = {
    saveSession,
    loadSession
};

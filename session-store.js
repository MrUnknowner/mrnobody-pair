const fs = require("fs");
const path = require("path");

const SESSIONS_DIR = path.join(__dirname, "sessions");

if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, {
        recursive: true
    });
}

function saveSession(sessionId, sourceDir) {
    const destination = path.join(
        SESSIONS_DIR,
        sessionId
    );

    fs.rmSync(destination, {
        recursive: true,
        force: true
    });

    fs.cpSync(sourceDir, destination, {
        recursive: true
    });

    return destination;
}

function getSession(sessionId) {
    const sessionPath = path.join(
        SESSIONS_DIR,
        sessionId
    );

    if (!fs.existsSync(sessionPath)) {
        return null;
    }

    return sessionPath;
}

function deleteSession(sessionId) {
    const sessionPath = path.join(
        SESSIONS_DIR,
        sessionId
    );

    fs.rmSync(sessionPath, {
        recursive: true,
        force: true
    });
}

module.exports = {
    saveSession,
    getSession,
    deleteSession
};

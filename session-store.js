const fs = require("fs");
const path = require("path");

const SESSIONS_DIR = path.join(__dirname, "sessions");

if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, {
        recursive: true
    });
}

function normalizeSessionId(sessionId) {
    if (!sessionId) {
        throw new Error("Session ID is required");
    }

    const id = String(sessionId);

    if (!/^MrNobody~[A-Za-z0-9_-]+$/.test(id)) {
        throw new Error("Invalid session ID");
    }

    return id;
}

function getSessionPath(sessionId) {
    const safeSessionId = normalizeSessionId(sessionId);

    return path.join(
        SESSIONS_DIR,
        safeSessionId
    );
}

function saveSession(sessionId, sourceDir) {
    if (!sourceDir) {
        throw new Error("Source directory is required");
    }

    if (!fs.existsSync(sourceDir)) {
        throw new Error("Source session directory does not exist");
    }

    const destination = getSessionPath(sessionId);

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
    const sessionPath = getSessionPath(sessionId);

    if (!fs.existsSync(sessionPath)) {
        return null;
    }

    return sessionPath;
}

function deleteSession(sessionId) {
    const sessionPath = getSessionPath(sessionId);

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

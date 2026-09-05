const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SESSIONS_DIR = path.join(__dirname, "sessions");

if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function validSessionId(id) {
    return typeof id === "string" && /^[A-Za-z0-9_-]{6,40}$/.test(id);
}

function getSessionFile(id) {
    if (!validSessionId(id)) {
        throw new Error("Invalid session ID");
    }

    return path.join(SESSIONS_DIR, `${id}.json`);
}

function collectFiles(dir, baseDir = dir) {
    const result = {};

    if (!fs.existsSync(dir)) {
        return result;
    }

    const entries = fs.readdirSync(dir, {
        withFileTypes: true
    });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
            Object.assign(
                result,
                collectFiles(fullPath, baseDir)
            );
        } else if (entry.isFile()) {
            const content = fs.readFileSync(fullPath);

            result[relativePath] = content.toString("base64");
        }
    }

    return result;
}

function writeFiles(dir, files) {
    if (!files || typeof files !== "object") {
        throw new Error("Invalid session files");
    }

    fs.mkdirSync(dir, {
        recursive: true
    });

    for (const [relativePath, base64Data] of Object.entries(files)) {
        if (
            typeof relativePath !== "string" ||
            typeof base64Data !== "string"
        ) {
            continue;
        }

        const cleanPath = path.normalize(relativePath);

        if (
            cleanPath.startsWith("..") ||
            path.isAbsolute(cleanPath)
        ) {
            continue;
        }

        const filePath = path.join(dir, cleanPath);

        fs.mkdirSync(path.dirname(filePath), {
            recursive: true
        });

        fs.writeFileSync(
            filePath,
            Buffer.from(base64Data, "base64")
        );
    }
}

function createSessionId() {
    return crypto
        .randomBytes(6)
        .toString("base64url")
        .replace(/[^A-Za-z0-9]/g, "")
        .slice(0, 10);
}

function saveSessionFolder(sessionDir, existingId = null) {
    if (!fs.existsSync(sessionDir)) {
        throw new Error("Session folder does not exist");
    }

    const files = collectFiles(sessionDir);

    if (!files["creds.json"]) {
        throw new Error("creds.json not found");
    }

    const sessionId =
        existingId && validSessionId(existingId)
            ? existingId
            : createSessionId();

    const data = {
        version: 1,
        createdAt: new Date().toISOString(),
        files
    };

    const filePath = getSessionFile(sessionId);
    const tempPath = `${filePath}.tmp`;

    fs.writeFileSync(
        tempPath,
        JSON.stringify(data)
    );

    fs.renameSync(tempPath, filePath);

    console.log(
        `✅ Full session saved: ${sessionId}`
    );

    return sessionId;
}

function loadSession(sessionId) {
    const filePath = getSessionFile(sessionId);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    const raw = fs.readFileSync(
        filePath,
        "utf8"
    );

    return JSON.parse(raw);
}

function restoreSession(sessionId, destination) {
    const session = loadSession(sessionId);

    if (!session) {
        throw new Error("Session not found");
    }

    writeFiles(
        destination,
        session.files
    );

    return true;
}

function updateSession(sessionId, files) {
    const existing = loadSession(sessionId);

    if (!existing) {
        throw new Error("Session not found");
    }

    const data = {
        ...existing,
        updatedAt: new Date().toISOString(),
        files
    };

    const filePath = getSessionFile(sessionId);
    const tempPath = `${filePath}.tmp`;

    fs.writeFileSync(
        tempPath,
        JSON.stringify(data)
    );

    fs.renameSync(
        tempPath,
        filePath
    );

    return true;
}

module.exports = {
    saveSessionFolder,
    loadSession,
    restoreSession,
    updateSession,
    collectFiles,
    validSessionId
};

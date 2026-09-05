const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SESSIONS_DIR = path.join(__dirname, "sessions");

if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function generateSessionId() {
    return crypto.randomBytes(8).toString("hex");
}

function getSessionFile(id) {
    return path.join(SESSIONS_DIR, `${id}.json`);
}

async function readSessionFolder(folder) {
    const files = {};

    if (!fs.existsSync(folder)) {
        return files;
    }

    const entries = fs.readdirSync(folder, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isFile()) continue;

        const filePath = path.join(folder, entry.name);

        try {
            files[entry.name] = fs.readFileSync(filePath).toString("base64");
        } catch (error) {
            console.error(`Failed reading ${entry.name}:`, error);
        }
    }

    return files;
}

async function saveSessionFolder(folder) {
    const files = await readSessionFolder(folder);

    if (!files["creds.json"]) {
        throw new Error("creds.json not found");
    }

    let id;

    do {
        id = generateSessionId();
    } while (fs.existsSync(getSessionFile(id)));

    const data = {
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        files
    };

    await writeSessionFile(id, data);

    return id;
}

async function loadSession(id) {
    const file = getSessionFile(id);

    if (!fs.existsSync(file)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
        console.error("Session read error:", error);
        return null;
    }
}

async function updateSession(id, files) {
    const existing = await loadSession(id);

    if (!existing) {
        throw new Error("Session not found");
    }

    existing.files = files;
    existing.updatedAt = Date.now();

    await writeSessionFile(id, existing);

    return true;
}

async function writeSessionFile(id, data) {
    const file = getSessionFile(id);
    const tempFile = `${file}.tmp`;

    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempFile, file);
}

async function restoreSession(id, folder) {
    const session = await loadSession(id);

    if (!session) {
        throw new Error("Session not found");
    }

    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }

    for (const [filename, encoded] of Object.entries(session.files)) {
        const filePath = path.join(folder, filename);
        fs.writeFileSync(filePath, Buffer.from(encoded, "base64"));
    }

    return true;
}

module.exports = {
    generateSessionId,
    saveSessionFolder,
    loadSession,
    updateSession,
    restoreSession
};
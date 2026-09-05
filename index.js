const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 8000;

require("events").EventEmitter.defaultMaxListeners = 500;

app.use(cors());
app.use(bodyParser.json({ limit: "25mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "25mb" }));

const pair = require("./pair");
const qr = require("./qr");

app.use("/code", pair);
app.use("/qr", qr);

const { loadSession, updateSession } = require("./session-store");

app.get("/", (req, res) => {
    res.send("MRNOBODY MD API is successfully running!");
});

app.get("/session/:id", async (req, res) => {
    try {
        const sessionId = req.params.id;

        if (!sessionId || !/^[a-zA-Z0-9_-]{8,64}$/.test(sessionId)) {
            return res.status(400).json({ error: "Invalid session ID" });
        }

        const session = await loadSession(sessionId);

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        return res.json({
            success: true,
            id: sessionId,
            files: session.files
        });
    } catch (error) {
        console.error("GET SESSION ERROR:", error);
        return res.status(500).json({ error: "Failed to load session" });
    }
});

app.put("/session/:id", async (req, res) => {
    try {
        const sessionId = req.params.id;
        const files = req.body?.files;

        if (!sessionId || !/^[a-zA-Z0-9_-]{8,64}$/.test(sessionId)) {
            return res.status(400).json({ error: "Invalid session ID" });
        }

        if (!files || typeof files !== "object") {
            return res.status(400).json({ error: "Invalid session data" });
        }

        if (!files["creds.json"]) {
            return res.status(400).json({ error: "creds.json is required" });
        }

        await updateSession(sessionId, files);

        return res.json({
            success: true,
            message: "Session updated"
        });
    } catch (error) {
        console.error("UPDATE SESSION ERROR:", error);
        return res.status(500).json({ error: "Failed to update session" });
    }
});

app.listen(PORT, () => {
    console.log(`⏩ Server running on port ${PORT}`);
});

module.exports = app;
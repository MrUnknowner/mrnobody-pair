const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");

const {
    loadSession,
    updateSession,
    validSessionId
} = require("./session-store");

const PORT = process.env.PORT || 8000;

let code = require("./pair");
let qr = require("./qr");

require("events").EventEmitter.defaultMaxListeners = 500;

app.use(cors());

app.use(bodyParser.json({
    limit: "10mb"
}));

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use("/code", code);
app.use("/qr", qr);

/*
|--------------------------------------------------------------------------
| GET SESSION
|--------------------------------------------------------------------------
| Bot එක SESSION_ID එකෙන් full creds + keys ගන්න මෙතනට එනවා.
*/

app.get("/session/:id", (req, res) => {
    try {
        const id = req.params.id;

        if (!validSessionId(id)) {
            return res.status(400).json({
                error: "Invalid session ID"
            });
        }

        const session = loadSession(id);

        if (!session) {
            return res.status(404).json({
                error: "Session not found"
            });
        }

        return res.json(session);

    } catch (error) {
        console.error(
            "GET SESSION ERROR:",
            error
        );

        return res.status(500).json({
            error: "Failed to load session"
        });
    }
});

/*
|--------------------------------------------------------------------------
| UPDATE SESSION
|--------------------------------------------------------------------------
| Bot එක running වෙද්දී Signal keys වෙනස් වෙනවා.
| ඒ updates backend එකට ආපහු save කරනවා.
*/

app.put("/session/:id", (req, res) => {
    try {
        const id = req.params.id;

        if (!validSessionId(id)) {
            return res.status(400).json({
                error: "Invalid session ID"
            });
        }

        const files = req.body?.files;

        if (!files || typeof files !== "object") {
            return res.status(400).json({
                error: "Invalid session data"
            });
        }

        updateSession(
            id,
            files
        );

        return res.json({
            success: true
        });

    } catch (error) {
        console.error(
            "UPDATE SESSION ERROR:",
            error
        );

        return res.status(500).json({
            error: "Failed to update session"
        });
    }
});

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
    res.send(
        "MRNOBODY MD API is successfully running!"
    );
});

app.listen(PORT, () => {
    console.log(
        `⏩ Server running on port ${PORT}`
    );
});

module.exports = app;

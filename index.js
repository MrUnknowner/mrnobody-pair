const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const { spawn } = require("child_process");

const {
    getSession
} = require("./session-store");

const PORT =
    process.env.PORT || 8000;

const code = require("./pair");
const qr = require("./qr");

require("events")
    .EventEmitter
    .defaultMaxListeners = 500;

app.use(cors());

app.use(bodyParser.json());

app.use(
    bodyParser.urlencoded({
        extended: true
    })
);

app.use("/code", code);
app.use("/qr", qr);

/*
 * Download a complete Baileys session.
 *
 * Example:
 *
 * /session/MrNobody~XXXX
 */
app.get(
    "/session/:sessionId",
    (req, res) => {
        try {
            const sessionId =
                req.params.sessionId;

            const sessionPath =
                getSession(sessionId);

            if (!sessionPath) {
                return res.status(404).send({
                    error:
                        "Session not found"
                });
            }

            /*
             * Send the complete session
             * as a compressed archive.
             */
            res.setHeader(
                "Content-Type",
                "application/gzip"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${sessionId}.tar.gz"`
            );

            const archive =
                spawn(
                    "tar",
                    [
                        "-czf",
                        "-",
                        "-C",
                        require("path").dirname(
                            sessionPath
                        ),
                        require("path").basename(
                            sessionPath
                        )
                    ],
                    {
                        stdio: [
                            "ignore",
                            "pipe",
                            "pipe"
                        ]
                    }
                );

            archive.stdout.pipe(res);

            archive.stderr.on(
                "data",
                (data) => {
                    console.error(
                        "Session archive:",
                        data.toString()
                    );
                }
            );

            archive.on(
                "error",
                (error) => {
                    console.error(
                        "Archive error:",
                        error
                    );

                    if (
                        !res.headersSent
                    ) {
                        res.status(500).send({
                            error:
                                "Failed to package session"
                        });
                    } else {
                        res.destroy(error);
                    }
                }
            );

            archive.on(
                "close",
                (exitCode) => {
                    if (
                        exitCode !== 0 &&
                        !res.destroyed
                    ) {
                        console.error(
                            "Archive process exited with code:",
                            exitCode
                        );

                        res.destroy();
                    }
                }
            );

        } catch (error) {
            console.error(
                "Session download error:",
                error
            );

            if (
                !res.headersSent
            ) {
                res.status(400).send({
                    error:
                        "Invalid session ID"
                });
            }
        }
    }
);

/*
 * API health check
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

const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");

const {
  getSession
} = require("./session-store");

const PORT =
  process.env.PORT || 8000;

let code = require("./pair");
let qr = require("./qr");

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
 * Get a stored WhatsApp session.
 *
 * Example:
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

      res.json({
        success: true,
        sessionId,
        sessionPath
      });

    } catch (error) {
      console.error(
        "Session lookup error:",
        error.message
      );

      return res.status(400).send({
        error:
          "Invalid session ID"
      });
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

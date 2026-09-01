const express = require("express");
const app = express();
const path = require("path");
const PORT = process.env.PORT || 8000;
let code = require("./pair");

require("events").EventEmitter.defaultMaxListeners = 500;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/code", code);

app.use("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "pair.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`⏩ Server running on port ${PORT}`);
});

module.exports = app;

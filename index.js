const express = require("express");
const app = express();
const path = require("path");
const PORT = process.env.PORT || 8000;
const pairRoute = require("./pair");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/code", pairRoute);

app.use("/", (req, res) => {
  res.sendFile(path.join(__dirname, "pair.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 MrNobody Pair Server running on port ${PORT}`);
});

module.exports = app;

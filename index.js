const express = require('express');
const cors = require('cors');
const path = require('path');
const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Zanta එකේ වගේම /pair ගියපු ගමන් pair.html එක පේන්න
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

// Pair route එක
const pairRouter = require('./pair');
app.use('/code', pairRouter);

app.listen(PORT, () => {
    console.log(`MrNobody Server running on port ${PORT}`);
});

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import Groq from 'groq-sdk';

const app = express();
const port = 3000;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Use CORS middleware
app.use(cors());

app.use(bodyParser.json());

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: message },
      ],
    });

    res.json(response);
  } catch (error) {
    console.error('Error calling Groq API:', error);
    res.status(500).json({ error: 'Error calling Groq API' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
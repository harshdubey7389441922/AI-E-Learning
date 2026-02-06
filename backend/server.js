import Note from "./models/Note.js";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import cors from "cors";
import PDFDocument from "pdfkit";
import authenticate from "./middleware/authenticate.js"; // JWT middleware


import User from "./models/User.js";
import Progress from "./models/Progress.js";


// Auth middleware
const auth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    // JWT verify karte hain
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // decoded me user info aayegi
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};


dotenv.config();

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ Mongo Error", err));



const app = express();
app.use(cors());
app.use(express.json());

/* ================= AI API ================= */

app.post("/ask-ai", async (req, res) => {
  const { question } = req.body;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `
You are an expert teacher.
Explain the topic in detail with:
1. Clear definition
2. Step-by-step explanation
3. Real-life examples
4. Diagram explanation in text form with labels
5. Short summary
Use simple student-friendly language.
`
          },
          { role: "user", content: question }
        ],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({
      answer: response.data.choices[0].message.content
    });

  } catch (error) {
    console.log(error.response?.data || error.message);
    res.status(500).json({ error: "Groq API error" });
  }
});

/* ================= PDF API ================= */


// POST /download-pdf
app.post("/download-pdf", authenticate, (req, res) => {
  const { topic, content } = req.body;

  if (!topic || !content) {
    return res.status(400).json({ error: "Topic and content required" });
  }

  try {
    const doc = new PDFDocument();
    
    // Set headers to force download
    res.setHeader("Content-Disposition", `attachment; filename=${topic}.pdf`);
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res); // pipe PDF to response

    doc.fontSize(20).text(`Topic: ${topic}`, { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(content, { lineGap: 4 });

    doc.end(); // finalize PDF
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF generation failed" });
  }
});

app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});

app.post("/chat",authMiddleware, async (req, res) => {
  try {
    const messages = req.body.messages;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages must be an array" });
    }

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are a helpful AI study assistant. Remember previous context."
          },
          ...messages
        ],
        temperature: 0.6
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply = response.data.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(500).json({ error: "Empty AI reply" });
    }

    res.json({ reply });

  } catch (error) {
    console.log("CHAT ERROR FULL:", error.response?.data || error.message);
    res.status(500).json({ error: "Chatbot backend failed" });
  }
});

app.post("/generate-quiz",authMiddleware, async (req, res) => {
  const { topic } = req.body;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
  role: "user",
  content: `
Generate a 5-question MCQ quiz on "${topic}".

Return ONLY valid JSON in this EXACT format:

[
  {
    "question": "string",
    "options": [
      { "key": "A", "text": "option text" },
      { "key": "B", "text": "option text" },
      { "key": "C", "text": "option text" },
      { "key": "D", "text": "option text" }
    ],
    "correct": "A",
    "concept": "weak topic name"
  }
]

STRICT RULES:
- No explanation
- No markdown
- No text outside JSON
`
}

        ],
        temperature: 0.3
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const raw = response.data.choices[0].message.content.trim();

    // 🔥 SAFETY CHECK
    const quiz = JSON.parse(raw);

    res.json({ quiz });

  } catch (error) {
    console.log("QUIZ ERROR:", error.message);
    res.status(500).json({ error: "Quiz generation failed" });
  }
});

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(400).json({ error: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({
    name,
    email,
    password: hashedPassword
  });

  await user.save();

  res.json({ message: "Signup successful" });
});

// Example login route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  // send name and email with token
  res.json({ token, user: { name: user.name, email: user.email } });
});



function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Unauthorized" });

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}



// GET notes for logged-in user
app.get("/notes", authenticate, async (req, res) => {
  try {
    const note = await Note.findOne({ userId: req.user.id });
    if (!note) return res.json({ content: "" });
    res.json({ content: note.content });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST / update notes
app.post("/notes", authenticate, async (req, res) => {
  const { content } = req.body;
  try {
    let note = await Note.findOne({ userId: req.user.id });
    if (!note) {
      note = new Note({ userId: req.user.id, content });
    } else {
      note.content = content;
    }
    await note.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

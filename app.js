const express = require("express");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const multer = require("multer");
const excelToJson = require("convert-excel-to-json");
const csvToJson = require("csvtojson");
const mongoose = require("mongoose");
const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");
const cors = require("cors");
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);
app.use(express.json());
app.use("/Json", express.static(path.join(__dirname, "Json")));
app.use(express.static("public"));

// Uploads folder setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});
const uploads = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid File Type"));
    }
  },
});

// MongoDB setup
mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log(" MongoDB connected"))
  .catch((err) => console.error(" MongoDB error:", err));

const dataSchema = mongoose.Schema(
  {
    uploadedAt: { type: Date, default: Date.now },
    data: { type: mongoose.Schema.Types.Mixed },
  },
  { strict: false }
);
const dataModel = mongoose.model("Data", dataSchema);

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/", uploads.single("file"), async (req, res) => {
  const file = req.file;
  console.log(file);

  console.log("📁 File uploaded:", file.originalname);
  let parsedData;

  try {
    if (
      file.mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      const result = excelToJson({
        sourceFile: file.path,
      });
      let firstSheetName = Object.keys(result)[0];
      // Store in MongoDB
      const newData = new dataModel({ data: result });
      await newData.save();

      console.log("🧾 Excel parsed");

      // Delete uploaded file
      fs.unlink(file.path, (err) =>
        err ? console.error(err) : console.log("🧹 File deleted")
      );

      return res.json({
        message: "File uploaded and parsed data saved to MongoDB",
        _id: newData._id,
        sheetname: firstSheetName,
      });
    }

    // CSV Parsing (kept separately)
    if (file.mimetype === "text/csv") {
      parsedData = await csvToJson().fromFile(file.path);
      console.log("🧾 CSV parsed");
      let firstSheetName = [parsedData[0]];
      const doc = new dataModel({ data: parsedData });
      const saved = await doc.save();
      const id = saved._id.toString();

      // Delete uploaded file
      fs.unlink(file.path, (err) =>
        err ? console.error(err) : console.log("🧹 File deleted")
      );

      return res.json({
        message: "CSV uploaded and saved to MongoDB",
        _id: id,
      });
    }
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

const apiKey = process.env.GROQ_API_KEY;
const anApi = process.env.GROQ_API;
app.post("/dashboard", async (req, res) => {
  const { _id } = req.body;
  console.log("📩 Request for dashboard:", _id);

  try {
    const data = await dataModel.findOne({ _id });
    if (!data) return res.status(404).json({ error: "Data not found" });
    const sheetData = data.data;
    let cleanData = Array.isArray(sheetData)
      ? sheetData
      : typeof sheetData === "object"
      ? sheetData[Object.keys(sheetData)[0]]
      : (() => {
          throw new Error("Unexpected data format.");
        })();

    const filepath = path.join(__dirname, "Json", `${_id}.json`);
    fs.writeFileSync(filepath, JSON.stringify(cleanData, null, 2));
    const sampleData = [cleanData[0]];
    console.log(sampleData);

    const randomBg = [
      "rgba(255, 255, 255, 0.7)", // Frosted White
      "rgba(240, 248, 255, 0.6)", // Soft Blue Tint
      "rgba(250, 250, 250, 0.75)", // Cloudy Silver
      "rgba(245, 255, 250, 0.65)", // Mint Whisper
      "rgba(255, 255, 240, 0.7)", // Creamy Glow
      "rgba(240, 255, 255, 0.65)", // Icy Sky
      "rgba(255, 250, 250, 0.8)", // Snow Mist
      "rgba(253, 253, 253, 0.85)", // Pure Frost
      "rgba(230, 240, 250, 0.65)", // Powder Blue
      "rgba(245, 245, 255, 0.7)", // Lavender Haze
      "rgba(255, 245, 238, 0.75)", // Peach Glass
      "rgba(255, 255, 255, 0.6)", // Classic Glass
    ];

    const randomColor = randomBg[Math.floor(Math.random() * randomBg.length)];
    const prompt = `Step 1
    You are given this dataset in JSON format: ${JSON.stringify(
      sampleData,
      null,
      2
    )} 
    Analyze the structure of the dataset and infer its type — for example, sales data, customer analytics, employee records, etc.
Step 2:Based on the dataset type, generate: A clear and meaningful dashboard title.A short summary paragraph (3-4 lines) describing what the dataset represents and what insights can be expected.
Step 3:Identify and calculate 5 key KPIs
Step 4:Determine 5 insightful visualizations based on trends, patterns, or categories in the dataset. Choose the most suitable chart types.
Step 5:Now build a single HTML file that Fetches data using await fetch('/Json/${_id}.json') and stores it in a variable .Waits for Chart.js (\`https://cdn.jsdelivr.net/npm/chart.js\`) to fully load before rendering.Dynamically uses the fetched data for plotting — do not hardcode any chart values Includes all 5 charts that were suggested in Step 4 Displays a short, meaningful insight below each chart explaining its significance.A responsive grid of 5 KPI cards form Step 3.Each card includes: Metric title (e.g., "Total Users"),Metric value,(Optional) small trend/indicator
Use a modern glassmorphism UI design with a stylish background color using ${randomColor}. Use modern web fonts like Poppins, Inter, or Roboto.Ensure the layout is clean, responsive, and elegant.Use card or grid-based layout with proper spacing .Avoid oversized charts and maintain appropriate width and height for all screen sizes. Use modern web fonts, subtle shadows, rounded corners, and hover effects for chart cards and buttons.Ensure visual consistency and avoid overlapping or cluttered graphs.Select the most suitable chart types for clarity.
    
    Output only the full HTML code for this with no extra explanation or comments
    
    `;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );
    const datas = await response.json();
    const output = datas.choices[0].message.content;
    const cleanedOutput = output.replace(/```html\n|\|/g, "");
    const fileName = `dashboard-${_id}.html`;
    const filePath = path.join(__dirname, "public", fileName);
    fs.writeFileSync(filePath, cleanedOutput);
    console.log("✅ Dashboard saved:", fileName);
    console.log("By Non Prompt Dashboard is called");
    res.json({
      message: "✅ Dashboard generated",
      url: `http://${req.headers.host}/${fileName}`,
    });

    // const result = await model.generate({ fullPrompt, data: data.data });

    // 🔍 Determine what to chunk

    // const finalResponse = await result.response;
    // const finalDashboard = finalResponse.text();

    // // console.log("✅ Final merged dashboard ready!");

    // // const fileName = `dashboard-${_id}.html`;
    // // const filePath = path.join(__dirname, "public", fileName);
    // // fs.writeFileSync(filePath, finalDashboard);
    // // console.log("✅ Dashboard saved:", fileName);

    // res.json({
    //   message: "✅ Dashboard generated",
    //   url: `http://${req.headers.host}/${fileName}`,
    //   data: finalDashboard,
    // });
  } catch (err) {
    console.error("❌ Error in /dashboard:", err);
    res.status(500).json({ error: "Dashboard generation failed" });
  }
});

app.post("/userupdate", async (req, res) => {
  const { _id, prompt } = req.body;

  const filename = `dashboard-${_id}.html`;
  const filePath = path.join(__dirname, "public", filename);
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Original dashboard not found." });
    }
    const oldHTML = fs.readFileSync(filePath, "utf-8");
    const updatePrompt = `Here's the current dashboard HTML:\n${oldHTML}\n The User wants the following changes ${prompt} Please return the updated full HTML with changes .Keep the original logic and Layout unless specified.output only the new HTML CSS JS , no explanation `;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anApi}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "user",
              content: updatePrompt,
            },
          ],
        }),
      }
    );

    const datas = await response.json();
    const updatedOutput = datas.choices[0].message.content;
    const cleanedOutput = updatedOutput.replace(/```html\n|\|/g, "");

    // Save new version (or overwrite)
    const updatedFileName = `dashboard-${_id}-v2.html`;
    const updatedFilePath = path.join(__dirname, "public", updatedFileName);
    fs.writeFileSync(updatedFilePath, cleanedOutput);

    res.json({
      message: "✅ Dashboard updated successfully",
      url: `http://${req.headers.host}/${updatedFileName}`,
    });
  } catch (error) {
    res.json({
      msg: "Error In updating Dashboard",
      error,
    });
  }
});

app.listen(port, () => {
  console.log(` Server running at ${port}`);
});

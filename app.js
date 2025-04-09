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
      "Slate Gray",
      "Midnight Purple",
      "Dark Navy",
      "Charcoal Black",
      "Soft Gradient", // Assuming it's a custom gradient you made
      "Deep Teal",
      "Gunmetal",
      "Steel Blue",
      "Space Black",
      "Obsidian",
      "Electric Indigo",
      "Royal Blue",
      "Crimson Red",
      "Rose Quartz",
      "Pine Green",
      "Graphite Gray",
      "Ocean Blue",
      "Mystic Bronze",
      "Frosted Glass", // for that pure glass feel
      "Warm Sand",
      "Aurora Fade", // name for custom gradient
    ];
    const randomColor = randomBg[Math.floor(Math.random() * randomBg.length)];
    const promt = `Step-1 This is the structure of ${JSON.stringify(
      sampleData,
      null,
      2
    )} data in JSON format.  Understand the structure and suggest five key data visualization metrics that would be the best fit to create an interactive dashboard.
    Step-2 now Create a single HTML file that displays All five data visualization which you had tell in step 1. Use the Plotly CDN (https://cdn.plot.ly/plotly-2.19.0.min.js).Use await fetch() to get JSON data from /Json/${_id}.json and store it in a variable. The JSON contains an array of objects.Only plot graphs after data is successfully fetched and Plotly is fully loaded. Do not hardcode any chart data.Use the fetched data variable in all charts. Apply a modern glassmorphism UI with background color ${randomColor}. Layout must be clean, responsive, well-spaced, and stylish. Output only the full HTML — no explanation.`;

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
              content: promt,
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

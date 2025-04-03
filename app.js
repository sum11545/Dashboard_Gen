const express = require("express");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const multer = require("multer");
const excelToJson = require("convert-excel-to-json");
const csvToJson = require("csvtojson");
const mongoose = require("mongoose");
const fs = require("fs");
const Groq = require("groq-sdk");
const fetch = require("node-fetch");

app.use(express.json());

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
  limits: { fileSize: 50000000 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
      cb(new Error("Invaild Type Of File"));
    }
  },
});

mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log(err);
  });

const dataSchema = mongoose.Schema({}, { strict: false });
const dataModel = mongoose.model("Data", dataSchema);

app.post("/", uploads.single("file"), async (req, res) => {
  const file = req.file;
  console.log(file);
  let parsedData = [];
  let format = "";

  if (
    file.mimetype ==
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    format = "Excel";
    const result = await excelToJson({
      sourceFile: file.path,
    });
    let sheetName = Object.keys(result)[0]; // Get first sheet name
    parsedData = result[sheetName];
    console.log(parsedData);
    if (parsedData.length > 1200) {
      return res
        .status(400)
        .json({ error: "File too large. Must have ≤ 1200 rows." });
    }

    const newSchema = new dataModel({
      data: result,
    });

    const saveData = await newSchema.save();
    if (saveData) {
      fs.unlink(file.path, (err) => {
        if (err) console.log(err);
        else console.log("File deleted");
      });
    }
    const ids = saveData._id.toString();
    const match = ids.match(/[0-9a-fA-F]{24}/);
    const id = match[0];
    res.json({ id: id });

    console.log("Excel Type called");
  } else if (file.mimetype == "text/csv") {
    format = "CSV";
    const result = await csvToJson().fromFile(file.path);
    let sheetName = Object.keys(result)[0]; // Get first sheet name
    parsedData = result[sheetName];
    console.log(parsedData);
    if (parsedData.length > 1200) {
      return res
        .status(400)
        .json({ error: "File too large. Must have ≤ 1200 rows." });
    }
    console.log(result);

    const newDocument = new dataModel({ data: result });

    const saveData = await newDocument.save();
    console.log("Saved data:", saveData);

    if (saveData) {
      fs.unlink(file.path, (err) => {
        if (err) console.log(err);
        else console.log("File deleted");
      });
    }
    console.log(saveData._id);
    const ids = saveData._id.toString();
    const match = ids.match(/[0-9a-fA-F]{24}/);
    const id = match[0];
    res.json({ id: id });

    console.log("CSV type is called");
    res.json({
      message: "CSV file uploaded and saved to MongoDB",
      data: result,
    });
  }
});

const apikey = process.env.GROQ_API_KEY;
console.log(apikey);

app.post("/dashboard", async (req, res) => {
  const { _id, propmt } = req.body;
  console.log(_id);
  console.log("prompt is", propmt);

  const data = await dataModel.findOne({ _id }).exec();
  console.log(data);
  const stringifiedData = JSON.stringify(data);

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apikey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are an AI that generates only functional HTML and JavaScript code, which can be inserted into div later on. Ensure all scripts execute properly.",
          },
          {
            role: "user",
            content: `Generate a complete interactive data visualization dashboard in a single HTML, CSS, and JavaScript file using the following dataset: ${stringifiedData}. The dashboard should include multiple charts (bar, pie, and line charts), colorful text labels, filters, and tooltips for better user interaction. Use Chart.js or D3.js for charts, and ensure the UI has a modern, clean, and responsive design. Avoid extra explanations or working methods—only provide the complete code in one file.`,
          },
        ],
      }),
    }
  );

  const datas = await response.json();
  console.log(datas);

  const newDatas = datas.choices[0].message.content;
  console.log(newDatas);

  const regex = /<!DOCTYPE html>[\s\S]*?<\/html>/; // Corrected regex
  const match = newDatas.match(regex); // Apply match on newDatas
  if (match) {
    const code = match[0];
    console.log(code);
    res.json({
      message: "Data fetched from MongoDB and sent to Groq API",
      data: code,
    });
  }
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// const express = require("express");
// const app = express();
// require("dotenv").config();
// const port = process.env.PORT || 3000;
// const multer = require("multer");
// const excelToJson = require("convert-excel-to-json");
// const csvToJson = require("csvtojson");
// const mongoose = require("mongoose");
// const fs = require("fs");
// const Groq = require("groq-sdk");
// const fetch = require("node-fetch");

// app.use(express.json());

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "./uploads");
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + "_" + file.originalname);
//   },
// });
// const uploads = multer({
//   storage: storage,
//   limits: { fileSize: 50000000 },
//   fileFilter: (req, file, cb) => {
//     const allowedMimeTypes = [
//       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
//       "application/vnd.ms-excel", // .xls
//       "text/csv", // .csv
//     ];

//     if (allowedMimeTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(null, false);
//       cb(new Error("Invaild Type Of File"));
//     }
//   },
// });

// mongoose
//   .connect("mongodb://localhost:27017/Dashboard_Gen", {})
//   .then(() => {
//     console.log("Connected to MongoDB");
//   })
//   .catch((err) => {
//     console.log(err);
//   });

// const dataSchema = mongoose.Schema({}, { strict: false });
// const dataModel = mongoose.model("Data", dataSchema);

// app.get("/", (req, res) => {
//   res.send("Hello World!");
// });

// app.post("/", uploads.single("file"), async (req, res) => {
//   const file = req.file;
//   console.log(file);
//   let parsedData = [];
//   let format = "";

//   if (
//     file.mimetype ==
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//   ) {
//     format = "Excel";
//     const result = await excelToJson({
//       sourceFile: file.path,
//     });

//     const newSchema = new dataModel({
//       data: result,
//     });

//     const saveData = await newSchema.save();
//     if (saveData) {
//       fs.unlink(file.path, (err) => {
//         if (err) console.log(err);
//         else console.log("File deleted");
//       });
//     }
//     const ids = saveData._id.toString();
//     const match = ids.match(/[0-9a-fA-F]{24}/);
//     const id = match[0];
//     res.json({ id: id });

//     console.log("Excel Type called");
//   } else if (file.mimetype == "text/csv") {
//     format = "CSV";
//     const result = await csvToJson().fromFile(file.path);

//     console.log(result);

//     const newDocument = new dataModel({ data: result });

//     const saveData = await newDocument.save();
//     console.log("Saved data:", saveData);

//     if (saveData) {
//       fs.unlink(file.path, (err) => {
//         if (err) console.log(err);
//         else console.log("File deleted");
//       });
//     }
//     console.log(saveData._id);
//     const ids = saveData._id.toString();
//     const match = ids.match(/[0-9a-fA-F]{24}/);
//     const id = match[0];
//     res.json({ id: id });

//     console.log("CSV type is called");
//     res.json({
//       message: "CSV file uploaded and saved to MongoDB",
//       data: result,
//     });
//   }
// });

// app.post("/dashboard", async (req, res) => {
//   const { _id, propmt } = req.body;
//   console.log(_id);
//   console.log("prompt is", propmt);

//   const data = await dataModel.findOne({ _id }).exec();
//   console.log(data);
//   const stringifiedData = JSON.stringify(data, null, 2);

//   const response = await fetch(`http://localhost:11434/api/generate`, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       // Authorization: `Bearer ${apikey}`,
//     },
//     body: JSON.stringify({
//       model: "mixtral:8x7b",
//       prompt: `Generate a complete interactive data visualization dashboard in a single HTML, CSS, and JavaScript file using the following dataset: ${stringifiedData}. The dashboard should include multiple charts (bar, pie, and line charts), colorful text labels, filters, and tooltips for better user interaction. Use Chart.js or D3.js for charts, and ensure the UI has a modern, clean, and responsive design. Avoid extra explanations or working methods—only provide the complete code in one file.`,
//       stream: false,
//     }),
//   });

//   const datas = await response.json();
//   console.log(datas);

//   // const newDatas = datas.choices[0].message.content;
//   // console.log(newDatas);

//   // const regex = /<!DOCTYPE html>[\s\S]*?<\/html>/; // Corrected regex
//   // const match = newDatas.match(regex); // Apply match on newDatas
//   // if (match) {
//   //   const code = match[0];
//   //   console.log(code);
//   //   res.json({
//   //     message: "Data fetched from MongoDB and sent to Groq API",
//   //     data: code,
//   //   });
//   // }
// });
// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });

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

// Serve public folder
app.use(express.static("public"));
app.use(express.json());

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
  .connect("mongodb://localhost:27017/Dashboard_Gen")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

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
  res.send("Welcome to the Dashboard Generator API");
});

app.post("/", uploads.single("file"), async (req, res) => {
  const file = req.file;
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
      parsedData = result;
      console.log("🧾 Excel parsed");
    } else if (file.mimetype === "text/csv") {
      parsedData = await csvToJson().fromFile(file.path);
      console.log("🧾 CSV parsed");
    }

    const doc = new dataModel({ data: parsedData });
    const saved = await doc.save();
    const id = saved._id.toString();

    // Delete uploaded file
    fs.unlink(file.path, (err) =>
      err ? console.error(err) : console.log("🧹 File deleted")
    );

    res.json({ message: "✅ File parsed & saved", id });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/dashboard", async (req, res) => {
  const { _id, prompt } = req.body;
  console.log("📩 Request for dashboard:", _id);

  try {
    const data = await dataModel.findById(_id);
    if (!data) return res.status(404).json({ error: "Data not found" });

    const stringifiedData = JSON.stringify(data.data, null, 2);

    const fullPrompt = `
      Generate a complete interactive data visualization dashboard in a single HTML, CSS, and JavaScript file using the following dataset:
      ${stringifiedData}
      The dashboard should include multiple charts (bar, pie, and line charts), colorful text labels, filters, and tooltips.
      Use Chart.js or D3.js. The design should be modern, responsive, and clean.
      Do not include explanations — just return valid full HTML code.
      ${prompt || ""}
    `;

    const response = await fetch(`http://localhost:11434/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mixtral:8x7b",
        prompt: fullPrompt,
        stream: false,
      }),
    });

    const result = await response.json();
    const code = result.response;

    const fileName = `dashboard-${_id}.html`;
    const filePath = path.join(__dirname, "public", fileName);

    fs.writeFileSync(filePath, code);
    console.log("✅ Dashboard saved:", fileName);

    res.json({
      message: "✅ Dashboard generated",
      url: `http://${req.headers.host}/${fileName}`,
    });
  } catch (err) {
    console.error("❌ Error in /dashboard:", err);
    res.status(500).json({ error: "Dashboard generation failed" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});

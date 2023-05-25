const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const { google } = require("googleapis");
const app = express();
const port = 3001;

// Set up CORS
app.use(cors());

// Load Google Sheets API credentials
const credentials = require("./credentials.json");
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = "1VgRUocCvsSHNRdaCFfgla7JEx0YarDehbxssolTi94Q"; // Replace with your actual spreadsheet ID
const range = "Sheet1!A1"; // Replace with the cell range you want to update

app.get("/scrape", async (req, res) => {
  const url = req.query.url; // Get the URL from the query parameters

  try {
    const pageTitle = await scrapeWebsite(url);
    await updateGoogleSheet(spreadsheetId, range, [[pageTitle]]);
    res.send(pageTitle);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error occurred during web scraping.");
  }
});

const scrapeWebsite = async (url) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(url);

  const pageTitle = await page.title();

  await browser.close();

  return pageTitle;
};

const updateGoogleSheet = async (spreadsheetId, range, values) => {
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      resource: { values },
    });
    console.log("Google Sheets updated successfully");
  } catch (error) {
    console.error("Error updating Google Sheets:", error);
  }
};

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

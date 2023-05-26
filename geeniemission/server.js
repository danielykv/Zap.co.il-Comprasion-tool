const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const { google } = require("googleapis");
const app = express();
const port = 3001;

app.use(cors());

// Load Google Sheets API credentials
const credentials = require("./credentials.json");
const {
  pagespeedonline,
} = require("googleapis/build/src/apis/pagespeedonline");
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = "1VgRUocCvsSHNRdaCFfgla7JEx0YarDehbxssolTi94Q"; // Replace with your actual spreadsheet ID
const range = "Sheet1!A:B"; // Replace with the cell range that contains the product names and links

app.get("/scrape", async (req, res) => {
  const url = req.query.url; // Get the URL from the query parameters

  try {
    // Read product names and links from column A and B of the Google Sheets file
    const values = await getGoogleSheetValues(spreadsheetId, range);
    console.log(values + "check1!!!!!!!!!!!!");
    // Iterate over the rows starting from the second row
    for (let i = 1; i < values.length; i++) {
      const productName = values[i][0];
      const productLink = values[i][1];

      // Check if the product link is empty
      if (!productLink) {
        const newProductLink = await scrapeWebsite(url, productName);

        // Update the corresponding link in column B of the Google Sheets file
        await updateGoogleSheet(spreadsheetId, `Sheet1!B${i + 1}`, [
          [newProductLink],
        ]);
      }
    }

    res.send("Web scraping and updating completed successfully");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error occurred during web scraping and updating.");
  }
});

const getGoogleSheetValues = async (spreadsheetId, range) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const values = response.data.values;
    console.log(values);
    // Extract the product names from the retrieved values
    const productNames = values.map((row) => row[0]);
    console.log(productNames);
    return values;
  } catch (error) {
    console.error("Error retrieving Google Sheets values:", error);
    throw error;
  }
};

const scrapeWebsite = async (url, productName) => {
  const browser = await puppeteer.launch({ headless: false });
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();

  await page.goto(url);

  await page.click(".selection");
  await page.type(".select2-search__field", productName);
  await page.waitForSelector(".select2-result-complexText");
  await page.click(".select2-result-complexText");

  const href = page.url();

  await browser.close();

  return href;
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
    throw error;
  }
};

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

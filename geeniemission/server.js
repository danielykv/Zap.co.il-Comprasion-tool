const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const { google } = require("googleapis");

const app = express();
const port = 3001;

app.use(cors());

// Load Google Sheets API credentials
const credentials = require("./credentials.json");
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// Helper function to extract the spreadsheet ID from the URL
const extractSpreadsheetId = (spreadsheetUrl) => {
  const matches = spreadsheetUrl.url.match(/\/d\/(.+)\//);
  if (matches && matches.length > 1) {
    return matches[1];
  }
  throw new Error("Invalid spreadsheet URL");
};

app.get("/scrape", async (req, res) => {
  try {
    const spreadsheetUrl = req.query;
    if (!spreadsheetUrl) {
      throw new Error("Spreadsheet URL is required");
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    console.log(spreadsheetId);
    const range = "Sheet1!A:P"; // Replace with the cell range that contains the product names, links, store names, store positions, and previous store positions
    const url = "https://www.zap.co.il/";
    // Read product details from the Google Sheets file
    const values = await getGoogleSheetValues(spreadsheetId, range);
    console.log(values);

    // Create a browser instance
    const browser = await puppeteer.launch({ headless: false });

    // Iterate over the rows starting from the second row
    for (let i = 1; i < values.length; i++) {
      let [productName, productLink, myStoreName, , prevStorePosition] =
        values[i];

      // Check if the product link is empty
      if (!productLink) {
        const newProductLink = await scrapeWebsite(browser, url, productName);

        // Update the corresponding link in column B of the Google Sheets file
        await updateGoogleSheet(spreadsheetId, `Sheet1!B${i + 1}`, [
          [newProductLink],
        ]);

        productLink = newProductLink;
      }

      // Check if there is a product link
      if (productLink) {
        let storePrices = await getStorePrices(browser, productLink);
        let previousStorePosition;
        // Prepare the data for updating columns E to N of the Google Sheets file
        const updatedStoreData = [];

        // Update only the first 5 stores
        const maxStoreCount = 5;
        for (let j = 0; j < Math.min(storePrices.length, maxStoreCount); j++) {
          const { storeName, productPrice } = storePrices[j];
          updatedStoreData.push(storeName, productPrice);
        }
        const applyConditionalFormatting = async (
          spreadsheetId,
          range,
          color
        ) => {
          try {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              resource: {
                requests: [
                  {
                    repeatCell: {
                      range: {
                        sheetId: 0, // Replace with the sheet ID if necessary
                        ...range,
                      },
                      cell: {
                        userEnteredFormat: {
                          backgroundColor: {
                            red: color === "green" ? 0.6 : 1,
                            green: color === "green" ? 0.8 : 0,
                            blue: color === "green" ? 0.6 : 0,
                          },
                        },
                      },
                      fields: "userEnteredFormat.backgroundColor",
                    },
                  },
                ],
              },
            });
            console.log("Conditional formatting applied successfully");
          } catch (error) {
            console.error("Error applying conditional formatting:", error);
            throw error;
          }
        };
        const matchingStore = storePrices.find(
          (store) => store.storeName === myStoreName
        );

        if (matchingStore) {
          const rowIndex = i + 1; // Adjust the row index accordingly
          const columnDRange = `Sheet1!D${rowIndex}`;
          const columnORange = `Sheet1!O${rowIndex}`;
          const columnPRange = `Sheet1!P${rowIndex}`;
          const updatedDataD = [[matchingStore.productPrice]];
          const updatedDataO = [[matchingStore.storePosition]];

          await updateGoogleSheet(spreadsheetId, columnDRange, updatedDataD);

          // Get the existing value from Column O
          const existingValue = await getGoogleSheetValues(
            spreadsheetId,
            columnORange
          );
          if (
            existingValue &&
            existingValue.length > 0 &&
            existingValue[0] &&
            existingValue[0].length > 0
          ) {
            // Update Column P with the value from Column O
            await updateGoogleSheet(spreadsheetId, columnPRange, [
              [existingValue[0][0]],
            ]);
          }

          // Update the store's current position in Column O
          await updateGoogleSheet(spreadsheetId, columnORange, updatedDataO);

          const rowRange = {
            startRowIndex: rowIndex - 1,
            endRowIndex: rowIndex,
            startColumnIndex: 0,
            endColumnIndex: values[0].length,
          };

          // Get the previous store position from Column P
          const previousStorePosition =
            existingValue && existingValue.length > 0 && existingValue[0]
              ? existingValue[0][0]
              : null;

          if (
            String(previousStorePosition) ===
              String(matchingStore.storePosition) ||
            previousStorePosition === null
          ) {
            // No change between previous and current positions, color the row green
            await applyConditionalFormatting(spreadsheetId, rowRange, "green");
          } else {
            // Change in positions, color the row red
            await applyConditionalFormatting(spreadsheetId, rowRange, "red");
          }
        }

        // Update columns E to N with store names and prices
        await updateGoogleSheet(spreadsheetId, `Sheet1!E${i + 1}:N${i + 1}`, [
          updatedStoreData,
        ]);
      }
    }

    // Close the browser instance
    await browser.close();

    console.log("Web scraping and updating completed successfully");
    res.send("Web scraping and updating completed successfully");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error occurred during web scraping and updating.");
  }
});

const getStorePrices = async (browser, productLink) => {
  const page = await browser.newPage({ headless: false });

  await page.goto(productLink);

  const divElements = await page.$$(`.compare-item-row`);

  const storePrices = [];

  for (let i = 0; i < divElements.length; i++) {
    const divElement = divElements[i];
    const productStoreName = await page.evaluate(
      (element) => element.getAttribute("data-site-name"),
      divElement
    );

    // Check if the product store name is available
    if (productStoreName) {
      const productPrice = await page.evaluate(
        (element) => element.getAttribute("data-total-price"),
        divElement
      );
      const storePosition = i + 1; // Position based on the store's index in the array/list

      storePrices.push({
        storeName: productStoreName,
        productPrice,
        storePosition: i + 1, // Position based on the store's index in the array/list
      });
    }
  }

  console.log(storePrices);
  return storePrices;
};

const getGoogleSheetValues = async (spreadsheetId, range) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const values = response.data.values || [];
    return values;
  } catch (error) {
    console.error("Error retrieving Google Sheets values:", error);
    throw error;
  }
};

const scrapeWebsite = async (browser, url, productName) => {
  const page = await browser.newPage({ headless: false });

  await page.goto(url);

  await page.click(".selection");
  await page.type(".select2-search__field", productName);
  await page.waitForSelector(".select2-result-complexText");
  await page.click(".select2-result-complexText");

  const href = page.url();

  return href;
};

const updateGoogleSheet = async (spreadsheetId, range, values) => {
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      resource: {
        values,
      },
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

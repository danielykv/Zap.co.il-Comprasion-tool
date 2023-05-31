import React, { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [inputValue, setInputValue] = useState("");
  const [redRows, setRedRows] = useState([]); // State to get red rows
  const [showAnimation, setShowAnimation] = useState(false); // State to control animation
  const [resultMessage, setResultMessage] = useState(""); // State for result message
  const [loading, setLoading] = useState(false); // State for loading status

  const handleInputChange = (event) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setResultMessage("Loading...");

      const response = await fetch(
        `http://localhost:3001/scrape?url=${inputValue}`
      );
      const data = await response.json();
      setRedRows(data);

      if (data.length > 0) {
        setResultMessage(`We found ${data.length} changes in your file:`);
      } else {
        setResultMessage(
          "Scraping completed successfully! there are no any changes"
        );
      }
      if (!response.ok) {
        const errorData = await response.text();
        setResultMessage(`Error occurred during scraping: ${errorData}`);
      }
    } catch (error) {
      console.error("Error:", error);
      setResultMessage("Error occurred during scraping.");
    } finally {
      setLoading(false);
    }
  };

  const renderTable = () => {
    if (redRows.length === 0) {
      return null;
    }

    return (
      <table className={`table ${showAnimation ? "fadeInAnimation" : ""}`}>
        <thead>
          <tr>
            <th>Store Name</th>
            <th>Product Name</th>
            <th>Product Price</th>
            <th>Product Link</th>
            <th>Current Position</th>
            <th>Previous Position</th>
          </tr>
        </thead>
        <tbody>
          {redRows.map((row, index) => (
            <tr
              key={index}
              className={`${showAnimation ? "gradientAnimation" : ""}`}
            >
              <td>{row.storeName}</td>
              <td>{row.productName}</td>
              <td>{row.productPrice + "₪"}</td>
              <td>
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button-link"
                >
                  Visit Website
                </a>
              </td>
              <td>{row.currentPosition}</td>
              <td>{row.previousPosition}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  useEffect(() => {
    // Enable animation after the component mounts
    setShowAnimation(true);
  }, []);

  return (
    <div className={`background ${showAnimation ? "gradientAnimation" : ""}`}>
      <div className={`container ${showAnimation ? "fadeInAnimation" : ""}`}>
        <img src="geeniexzaplogo.png" alt="logo" />
        <h1>Welcome to our comparison tool!</h1>
        <p>Please enter your Google Spreadsheet link</p>
        <div for="search" className="input-container">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter the spreadsheet URL"
          />
          <button type="submit" onClick={handleSubmit}>
            Scrape Website
          </button>
        </div>
        {loading ? (
          <p className="result">Loading...</p>
        ) : (
          resultMessage && <p className="result">{resultMessage}</p>
        )}{" "}
        <h2 className="credit">Made by Daniel Yakubov</h2>
        {renderTable()}
      </div>
    </div>
  );
}

export default App;

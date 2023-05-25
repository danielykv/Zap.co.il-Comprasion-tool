import React, { useState } from "react";
import "./App.css";

function App() {
  const [inputValue, setInputValue] = useState("");
  const [result, setResult] = useState("");

  const handleInputChange = (event) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/scrape?url=${inputValue}`
      );
      const data = await response.text();
      setResult(data); // Update the component state with the scrape result
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="background">
      <div className="container">
        <h1>React Input Demo</h1>
        <div className="input-container">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter the website URL"
          />
          <button onClick={handleSubmit}>Scrape Website</button>
        </div>
        {result && <div className="result">{result}</div>}
      </div>
    </div>
  );
}

export default App;

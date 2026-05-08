import React, { useState } from "react";
import apiClient from "../api/apiClient";

export default function SearchWord() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    if (!query) return;
    try {
      const res = await apiClient.get("/search", { params: { query } });
      setResults(res.data);
    } catch (err) {
      setResults([]);
    }
  };

  return (
    <div>
      <h2>Search Word</h2>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button onClick={handleSearch}>Search</button>

      <ul>
        {results.map((r, i) => (
          <li key={i}>
            <strong>{r.wordform}</strong> → {r.lemma} ({r.pos}) [pos: {r.position}]
          </li>
        ))}
      </ul>
    </div>
  );
}
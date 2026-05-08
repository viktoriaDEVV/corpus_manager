import React, { useEffect, useState } from "react";
import apiClient from "../api/apiClient";

export default function Statistics() {
  const [stats, setStats] = useState({});

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await apiClient.get("/statistics");
        setStats(res.data);
      } catch (err) {
        setStats({});
      }
    }
    fetchStats();
  }, []);

  return (
    <div>
      <h2>Статистика корпуса</h2>
      <div className="stats-grid">
        <div className="stat-item"><div>Документы</div><div className="stat-val">{stats.documents_count || 0}</div></div>
        <div className="stat-item"><div>Токены</div><div className="stat-val">{stats.tokens_count || 0}</div></div>
        <div className="stat-item"><div>Леммы</div><div className="stat-val">{stats.lemmas_count || 0}</div></div>
        <div className="stat-item"><div>Словоформы</div><div className="stat-val">{stats.wordforms_count || 0}</div></div>
      </div>
    </div>
  );
}
import React, { useEffect, useState } from "react";
import apiClient from "../api/apiClient";

export default function DocumentList() {
  const [documents, setDocuments] = useState([]);

  const fetchDocuments = async () => {
    try {
      const res = await apiClient.get("/documents");
      setDocuments(res.data);
    } catch (err) {
      console.error("Ошибка при получении списка документов", err);
    }
  };

  useEffect(() => {
    fetchDocuments();
    
  }, []);

  return (
    <div className="section">
      <h2>Список документов в базе</h2>
      <button onClick={fetchDocuments} style={{ marginBottom: '10px' }}>Обновить список</button>
      <table className="doc-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Название файла</th>
            <th>Предпросмотр текста</th>
          </tr>
        </thead>
        <tbody>
          {documents.length > 0 ? (
            documents.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.id}</td>
                <td>{doc.filename}</td>
                <td className="text-preview">{doc.text?.substring(0, 100)}...</td>
              </tr>
            ))
          ) : (
            <tr><td colSpan="3" style={{textAlign: 'center'}}>Документов пока нет</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
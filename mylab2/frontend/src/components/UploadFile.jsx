import React, { useState } from "react";
import apiClient from "../api/apiClient";

export default function UploadFile({ onUploadSuccess }) { 
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await apiClient.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(res.data.status);
      
      // ВЫЗОВ ОБНОВЛЕНИЯ: сообщаем родительскому компоненту, что нужно обновить список
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err) {
      setMessage("Ошибка загрузки файла");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Upload File</h2>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Загрузка..." : "Upload"}
      </button>
      <p>{message}</p>
    </div>
  );
}
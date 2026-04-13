'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

const GOOGLE_DRIVE_FOLDER_ID = '1c6UlXHaiHkupmY2w4B4lZ3HeqUt-7PzQ';
const API_KEY = 'AIzaSyBfLbEn8rGFZNqhrE5MqZi3JMXBKBHHTF0'; // Public Google API key for Drive read-only

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink: string;
  modifiedTime: string;
  size?: string;
  thumbnailLink?: string;
}

export default function SemmarPage() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentFolder, setCurrentFolder] = useState(GOOGLE_DRIVE_FOLDER_ID);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([
    { id: GOOGLE_DRIVE_FOLDER_ID, name: 'Semmar' },
  ]);

  useEffect(() => {
    fetchFiles(currentFolder);
  }, [currentFolder]);

  async function fetchFiles(folderId: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&key=${API_KEY}&fields=files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size,thumbnailLink)&orderBy=folder,name&pageSize=100`
      );
      if (!res.ok) {
        throw new Error('Не удалось загрузить файлы');
      }
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e) {
      setError('Не удалось загрузить файлы из Google Drive');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function openFolder(file: DriveFile) {
    setCurrentFolder(file.id);
    setFolderPath((prev) => [...prev, { id: file.id, name: file.name }]);
  }

  function goToFolder(index: number) {
    const target = folderPath[index];
    setCurrentFolder(target.id);
    setFolderPath((prev) => prev.slice(0, index + 1));
  }

  function formatSize(bytes: string | undefined): string {
    if (!bytes) return '';
    const b = Number(bytes);
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function getFileIcon(mimeType: string): string {
    if (mimeType === 'application/vnd.google-apps.folder') return '📁';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('document') || mimeType.includes('word')) return '📄';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📑';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('video')) return '🎬';
    return '📎';
  }

  const isFolder = (f: DriveFile) => f.mimeType === 'application/vnd.google-apps.folder';

  return (
    <Layout>
      <div className="space-y-4 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Semmar</h1>
            <p className="text-sm text-gray-500">Документы, КП, заявки на расчёт</p>
          </div>
          <a
            href={`https://drive.google.com/drive/folders/${currentFolder}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Открыть в Google Drive
          </a>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm">
          {folderPath.map((folder, i) => (
            <span key={folder.id} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-400">/</span>}
              <button
                onClick={() => goToFolder(i)}
                className={`hover:underline ${
                  i === folderPath.length - 1
                    ? 'text-gray-900 font-semibold'
                    : 'text-blue-600'
                }`}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </div>

        {/* Files */}
        <div className="bg-white rounded-xl shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Загрузка файлов...</div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 mb-4">{error}</p>
              <a
                href={`https://drive.google.com/drive/folders/${GOOGLE_DRIVE_FOLDER_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition inline-block"
              >
                Открыть в Google Drive
              </a>
            </div>
          ) : files.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Папка пуста</div>
          ) : (
            <table className="w-full text-sm text-gray-900">
              <thead>
                <tr className="text-left text-gray-500 border-b bg-gray-50">
                  <th className="px-4 py-3 font-medium">Название</th>
                  <th className="px-4 py-3 font-medium w-28">Размер</th>
                  <th className="px-4 py-3 font-medium w-28">Дата</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      {isFolder(file) ? (
                        <button
                          onClick={() => openFolder(file)}
                          className="flex items-center gap-2 text-blue-600 hover:underline font-medium"
                        >
                          <span className="text-lg">{getFileIcon(file.mimeType)}</span>
                          {file.name}
                        </button>
                      ) : (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-gray-900 hover:text-blue-600 transition"
                        >
                          <span className="text-lg">{getFileIcon(file.mimeType)}</span>
                          {file.name}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatSize(file.size)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(file.modifiedTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}

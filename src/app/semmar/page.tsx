'use client';

import Layout from '@/components/Layout';

const GOOGLE_DRIVE_FOLDER_ID = '1c6UlXHaiHkupmY2w4B4lZ3HeqUt-7PzQ';

export default function SemmarPage() {
  return (
    <Layout>
      <div className="space-y-4 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Semmar</h1>
            <p className="text-sm text-gray-500">Документы, КП, заявки на расчёт</p>
          </div>
          <a
            href={`https://drive.google.com/drive/folders/${GOOGLE_DRIVE_FOLDER_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Открыть в Google Drive
          </a>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 180px)' }}>
          <iframe
            src={`https://drive.google.com/embeddedfolderview?id=${GOOGLE_DRIVE_FOLDER_ID}#grid`}
            className="w-full h-full border-0"
            title="Semmar Google Drive"
            allow="autoplay"
          />
        </div>
      </div>
    </Layout>
  );
}

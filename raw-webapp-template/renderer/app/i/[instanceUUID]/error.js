'use client';

export default function ErrorPage({ error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            {error.message || 'Unable to access interface'}
          </h2>
          
          {error.code && (
            <p className="mt-2 text-sm text-gray-500">
              Error Code: {error.code}
            </p>
          )}
          
          {error.details && (
            <div className="mt-4 p-4 bg-gray-50 rounded text-left">
              <p className="text-xs font-mono text-gray-600 break-all">
                {JSON.stringify(error.details, null, 2)}
              </p>
            </div>
          )}
          
          <div className="mt-6">
            <a
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Return to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

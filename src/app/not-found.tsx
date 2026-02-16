import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-900">
      <div className="max-w-md text-center">
        <p className="text-8xl font-bold text-gray-200 dark:text-gray-800">404</p>
        <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
          Page not found
        </h2>
        <p className="mt-2 text-gray-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

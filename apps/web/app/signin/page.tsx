import { SignInForm } from "./SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-semibold text-gray-900">
          Carelog
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Care coordination for families
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-gray-100 rounded-xl sm:px-10">
          {params.error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-700">
                {params.error === "auth_callback_failed"
                  ? "Something went wrong. Please try again."
                  : params.error}
              </p>
            </div>
          )}

          {params.message && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-sm text-blue-700">{params.message}</p>
            </div>
          )}

          <SignInForm />
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Private, secure, and ad-free. Your family&apos;s information never
          leaves your care team.
        </p>
      </div>
    </div>
  );
}

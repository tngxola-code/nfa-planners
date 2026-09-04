import { loginAction } from './actions'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-navy-900">NFA Console</h1>
          <p className="text-gray-500 mt-2">Sign in to review planning, land and spatial-intelligence opportunities.</p>
        </div>
        <form action={loginAction}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue="tngxola@gmail.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
              required
            />
          </div>
          <button type="submit" className="w-full bg-navy-900 text-white py-2 px-4 rounded-lg hover:bg-navy-800 transition font-medium">
            Sign In
          </button>
          <p className="text-xs text-gray-400 mt-4 text-center">Any email + any password works (testing only)</p>
        </form>
      </div>
    </main>
  )
}

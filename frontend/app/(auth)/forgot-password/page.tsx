"use client";

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    setMessage(data.message || 'Request received');
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center bg-white p-12">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-2">Forgot Password</h1>
        <p className="text-gray-500 mb-6">Enter your email to receive a reset link.</p>
        {message && <div className="p-3 mb-4 bg-green-50 border border-green-200 text-green-700 rounded-md">{message}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="p-3 border rounded-md" />
          <button type="submit" className="bg-[#157A52] text-white py-3 rounded-md font-semibold hover:bg-[#0F5C3D]">Send Reset Link</button>
        </form>
        <p className="text-sm mt-4 text-gray-500"><a href="/login" className="text-[#157A52] underline">Back to login</a></p>
      </div>
    </div>
  );
}

'use client'

export default function EmailCaptureForm() {
  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col sm:flex-row gap-3 max-w-md"
    >
      <label htmlFor="footer-email" className="sr-only">Email address</label>
      <input
        id="footer-email"
        type="email"
        placeholder="your@email.com"
        className="flex-1 bg-white/8 border border-white/45 text-white placeholder:text-white/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
      />
      <button
        type="submit"
        className="btn-accent shrink-0 justify-center"
      >
        Subscribe
      </button>
    </form>
  )
}

import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full fixed bottom-0 left-0 bg-primary text-white p-2">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/termsofservice">
          <span className="text-white/90 hover:text-white transition-colors duration-300">
            Terms of Service
          </span>
        </Link>
        <Link href="/privacy">
          <span className="text-white/90 hover:text-white transition-colors duration-300">
            Privacy Policy
          </span>
        </Link>
      </div>
    </footer>
  );
}
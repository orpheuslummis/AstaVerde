import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full bg-primary dark:bg-gray-800 text-white dark:text-gray-200 p-2">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/termsofservice">
          <span className="text-white/90 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors duration-300">
            Terms of Service
          </span>
        </Link>
        <Link href="/privacy">
          <span className="text-white/90 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors duration-300">
            Privacy Policy
          </span>
        </Link>
      </div>
    </footer>
  );
}

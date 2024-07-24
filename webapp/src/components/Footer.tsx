import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full flex-center p-4 bg-primary text-white shadow-md">
      <div className="container flex justify-between">
        <Link href="/termsofservice">Terms of Service</Link>
        <Link href="/privacy">Privacy Policy</Link>
      </div>
    </footer>
  );
}